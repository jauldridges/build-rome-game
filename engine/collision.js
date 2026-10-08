// Nobody walks through anybody, and nobody walks through walls, houses, the storehouse, trees or rocks.
//
// Two jobs:
//  1. Finding a way around things. Every unit that walks (farmers, soldiers, attackers) goes through navWalk(), which walks
//     straight when the way is clear and otherwise follows a path found on a coarse grid (A*) around whatever is in the way.
//  2. Keeping bodies apart. After everyone has moved each frame, resolveCollisions() pushes overlapping units apart and pushes
//     units out of buildings and nodes, so sprites can never sit on top of each other.
//
// The gate lets friendly units through but stops attackers (they have to break it). Walls stop everyone.
// Loaded after core.js; core.js and defense.js call navWalk() and resolveCollisions().

const UNIT_R = 8;                 // how big a person is, for bumping
const NAV = { cell: 16, sig: null, grids: {} };
NAV.cols = Math.ceil(MAP_W / NAV.cell); NAV.rows = Math.ceil(MAP_H / NAV.cell);

// ---- What is solid ----
// kind 'friend' (farmers and soldiers) or 'foe' (attackers). Returns rectangles and small circles.
// forPath: when attackers plan a route, walls and gates do not count: they walk straight at them and break them down
function solids(kind, forPath) {
  const rects = [], circles = [];
  buildings.forEach(b => {
    const art = BUILD[b.type] && BUILD[b.type].art;
    if (art === 'gate' && b.done && kind === 'friend') return;                     // a finished gate is open to friends
    if (forPath && kind === 'foe' && (art === 'gate' || art === 'wall')) return;
    rects.push({ x: b.x, y: b.y, w: b.w, h: b.h });
  });
  rects.push({ x: store.x, y: store.y, w: store.w, h: store.h });
  nodes.forEach(n => circles.push({ x: n.x, y: n.y + 8, r: 6 }));            // the foot of a tree or rock
  return { rects, circles };
}

// Push a point of radius r out of a rectangle or circle; returns true if it moved
function pushOutOfRect(p, rc, r) {
  const left = rc.x - r, right = rc.x + rc.w + r, top = rc.y - r, bottom = rc.y + rc.h + r;
  if (p.x <= left || p.x >= right || p.y <= top || p.y >= bottom) return false;
  const dl = p.x - left, dr = right - p.x, dt = p.y - top, db = bottom - p.y, m = Math.min(dl, dr, dt, db);
  if (m === dl) p.x = left; else if (m === dr) p.x = right; else if (m === dt) p.y = top; else p.y = bottom;
  return true;
}
function pushOutOfCircle(p, c, r) {
  const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy), min = c.r + r;
  if (d >= min) return false;
  if (d < 0.01) { p.x += min; return true; }
  p.x = c.x + dx / d * min; p.y = c.y + dy / d * min;
  return true;
}

// ---- The grid for finding paths ----
function navSignature() { return buildings.length + '|' + buildings.reduce((n, b) => n + (b.done ? 1 : 0), 0) + '|' + nodes.length; }

function navGrid(kind) {
  const sig = navSignature();
  if (NAV.sig !== sig) { NAV.sig = sig; NAV.grids = {}; NAV.version = (NAV.version || 0) + 1; }
  if (NAV.grids[kind]) return NAV.grids[kind];
  const { rects, circles } = solids(kind, true), blocked = new Uint8Array(NAV.cols * NAV.rows), c = NAV.cell, pad = UNIT_R + 1;
  for (let j = 0; j < NAV.rows; j++) for (let i = 0; i < NAV.cols; i++) {
    const px = i * c + c / 2, py = j * c + c / 2;
    let b = rects.some(r => px > r.x - pad && px < r.x + r.w + pad && py > r.y - pad && py < r.y + r.h + pad);
    if (!b) b = circles.some(k => Math.hypot(px - k.x, py - k.y) < k.r + pad);
    blocked[j * NAV.cols + i] = b ? 1 : 0;
  }
  return (NAV.grids[kind] = { blocked, kind });
}
const cellOf = v => Math.floor(v / NAV.cell);
function isBlockedAt(g, x, y) {
  const i = cellOf(x), j = cellOf(y);
  if (i < 0 || j < 0 || i >= NAV.cols || j >= NAV.rows) return true;
  return g.blocked[j * NAV.cols + i] === 1;
}
function clearLine(g, x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 6);
  for (let k = 1; k < n; k++) if (isBlockedAt(g, x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n)) return false;
  return true;
}
// The nearest open cell to a point (for when someone is sent to a spot inside a building)
function nearestOpen(g, x, y) {
  if (!isBlockedAt(g, x, y)) return { x, y };
  const ci = cellOf(x), cj = cellOf(y);
  for (let r = 1; r < 30; r++) {
    let best = null, bestD = Infinity;
    for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
      if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue;
      if (i < 0 || j < 0 || i >= NAV.cols || j >= NAV.rows || g.blocked[j * NAV.cols + i]) continue;
      const px = i * NAV.cell + NAV.cell / 2, py = j * NAV.cell + NAV.cell / 2, d = Math.hypot(px - x, py - y);
      if (d < bestD) { best = { x: px, y: py }; bestD = d; }
    }
    if (best) return best;
  }
  return { x, y };
}

// A*: eight directions; returns waypoints (cell centers) from a start to a goal, pulled tight where the way is clear
function findPath(g, x0, y0, x1, y1) {
  const cols = NAV.cols, rows = NAV.rows, c = NAV.cell;
  const start = nearestOpen(g, x0, y0), goal = nearestOpen(g, x1, y1);
  const si = cellOf(start.x), sj = cellOf(start.y), gi = cellOf(goal.x), gj = cellOf(goal.y);
  const idx = (i, j) => j * cols + i, open = [], gScore = new Float32Array(cols * rows).fill(Infinity), from = new Int32Array(cols * rows).fill(-1), closed = new Uint8Array(cols * rows);
  const h = (i, j) => { const dx = Math.abs(i - gi), dy = Math.abs(j - gj); return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy); };
  gScore[idx(si, sj)] = 0; open.push([h(si, sj), si, sj]);
  let found = false, guard = 0;
  while (open.length && guard++ < 6000) {
    let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
    const [, i, j] = open.splice(bi, 1)[0], id = idx(i, j);
    if (closed[id]) continue; closed[id] = 1;
    if (i === gi && j === gj) { found = true; break; }
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= cols || nj >= rows || g.blocked[idx(ni, nj)] || closed[idx(ni, nj)]) continue;
      if (di && dj && (g.blocked[idx(i + di, j)] || g.blocked[idx(i, j + dj)])) continue; // no squeezing diagonally between two blocks
      const ng = gScore[id] + (di && dj ? Math.SQRT2 : 1);
      if (ng < gScore[idx(ni, nj)]) { gScore[idx(ni, nj)] = ng; from[idx(ni, nj)] = id; open.push([ng + h(ni, nj), ni, nj]); }
    }
  }
  if (!found) return null;
  const cells = []; let cur = idx(gi, gj);
  while (cur !== -1) { cells.push({ x: (cur % cols) * c + c / 2, y: Math.floor(cur / cols) * c + c / 2 }); cur = from[cur]; }
  cells.reverse(); cells[0] = { x: start.x, y: start.y }; cells.push({ x: goal.x, y: goal.y });
  const pts = [cells[0]]; let k = 0; // string pulling: skip waypoints whenever the straight way is clear
  while (k < cells.length - 1) {
    let n = cells.length - 1;
    while (n > k + 1 && !clearLine(g, cells[k].x, cells[k].y, cells[n].x, cells[n].y)) n--;
    pts.push(cells[n]); k = n;
  }
  pts.shift();
  return pts;
}

// ---- Walking ----
// Walk toward (tx, ty); returns true when within 'reach' of it. Drop-in replacement for the plain straight-line walk.
function navWalk(u, tx, ty, dt, reach) {
  const d = Math.hypot(tx - u.x, ty - u.y);
  if (d <= reach) { u.nav = null; return true; }
  const kind = u.enemy ? 'foe' : 'friend', g = navGrid(kind);
  let n = u.nav;
  if (!n || n.version !== NAV.version || Math.hypot(n.goalX - tx, n.goalY - ty) > 14) {
    n = u.nav = { goalX: tx, goalY: ty, version: NAV.version, pts: null, replan: 0, stuck: 0, lastX: u.x, lastY: u.y };
  }
  n.replan -= dt;
  let wx = tx, wy = ty;
  if (!clearLine(g, u.x, u.y, tx, ty)) { // something is in the way: follow a path around it
    if ((!n.pts || !n.pts.length) && n.replan <= 0) { n.pts = findPath(g, u.x, u.y, tx, ty) || []; n.replan = 0.6; }
    if (n.pts && n.pts.length) {
      while (n.pts.length > 1 && Math.hypot(n.pts[0].x - u.x, n.pts[0].y - u.y) < 7) n.pts.shift();
      wx = n.pts[0].x; wy = n.pts[0].y;
      if (n.pts.length === 1 && Math.hypot(wx - u.x, wy - u.y) < 7) n.pts = null;
    }
  } else n.pts = null;
  const dx = wx - u.x, dy = wy - u.y, dd = Math.hypot(dx, dy);
  if (dd > 0.01) {
    const step = Math.min(u.speed * dt, dd);
    u.x += dx / dd * step; u.y += dy / dd * step; u.faceX = dx; u.moving = true;
  }
  // Give up gracefully when jammed against others for a while, instead of shoving forever
  n.stuck += Math.hypot(u.x - n.lastX, u.y - n.lastY) < u.speed * dt * 0.15 ? dt : -n.stuck;
  n.lastX = u.x; n.lastY = u.y;
  if (n.stuck > 1.4) { u.nav = null; return true; }
  return false;
}

// ---- Keeping bodies apart ----
function everyone() { return farmers.concat(soldiers, typeof raiders !== 'undefined' ? raiders : []); }

function resolveCollisions() {
  const all = everyone();
  // 1. People push each other apart. Those who are standing still (working, fighting, waiting) are harder to shove.
  const weight = u => (u.moving ? 1 : 3);
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) {
      const A = all[a], B = all[b], dx = B.x - A.x, dy = B.y - A.y, d2 = dx * dx + dy * dy, min = UNIT_R * 2;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 0.01, push = (min - d), wa = weight(A), wb = weight(B), nx = d === 0.01 ? 1 : dx / d, ny = d === 0.01 ? 0 : dy / d;
      A.x -= nx * push * wb / (wa + wb); A.y -= ny * push * wb / (wa + wb);
      B.x += nx * push * wa / (wa + wb); B.y += ny * push * wa / (wa + wb);
    }
    // 2. Everyone is pushed out of whatever is solid for them
    const friend = solids('friend'), foe = solids('foe');
    all.forEach(u => {
      const s = u.enemy ? foe : friend;
      s.rects.forEach(r => pushOutOfRect(u, r, UNIT_R));
      s.circles.forEach(c => pushOutOfCircle(u, c, UNIT_R));
      u.x = Math.max(UNIT_R, Math.min(MAP_W - UNIT_R, u.x)); u.y = Math.max(UNIT_R, Math.min(MAP_H - UNIT_R, u.y));
    });
  }
  all.forEach(u => { u.moving = false; });
}
