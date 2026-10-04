// The game engine. It runs any mission described by missions/<name>/mission.js (see docs/MAKING-A-MISSION.md).
// Every line of text comes from the mission's content/latin.js, built from its latin.yaml. Placeholder art only.
const M = MISSION;
const TILE = M.world.tile, COLS = M.world.cols, ROWS = M.world.rows; // the whole world fits on one screen: no scrolling
const FOREST_H = M.world.forestH; // the forest along the north edge, where the enemy comes from

// Terrain: a river and a hill (a mission may leave either out)
const RIVER = M.terrain.river || null;
const HILL = M.terrain.hill || null;
function riverDist(x, y) { // distance from a point to the middle of the river
  if (!RIVER) return Infinity;
  let best = Infinity;
  for (let i = 0; i + 1 < RIVER.points.length; i++) {
    const [ax, ay] = RIVER.points[i], [bx, by] = RIVER.points[i + 1];
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    best = Math.min(best, Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))));
  }
  return best;
}
const inHill = (x, y) => !!HILL && ((x - HILL.x) / HILL.rx) ** 2 + ((y - HILL.y) / HILL.ry) ** 2 <= 1;
// 'river' (the water and its banks), 'hill', or null for plain ground
function placeAt(p) {
  if (RIVER && riverDist(p.x, p.y) <= RIVER.half + RIVER.bank) return 'river';
  return inHill(p.x, p.y) ? 'hill' : null;
}
const PLACES = M.places || {};
const MAP_W = COLS * TILE, MAP_H = ROWS * TILE;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const cam = { x: 0, y: 0 }; // the map never scrolls; the whole world is scaled to fit the window

// The world is drawn scaled to fit the window and centered. These convert between window pixels and world points.
const view = { zoom: 1, ox: 0, oy: 0 };
function resize() {
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  view.zoom = Math.min(canvas.width / MAP_W, canvas.height / MAP_H);
  view.ox = (canvas.width - MAP_W * view.zoom) / 2;
  view.oy = (canvas.height - MAP_H * view.zoom) / 2;
}
const toWorldXY = (x, y) => ({ x: (x - view.ox) / view.zoom, y: (y - view.oy) / view.zoom });
const toScreenXY = (x, y) => ({ x: x * view.zoom + view.ox, y: y * view.zoom + view.oy });
window.addEventListener('resize', resize);

// Ground: olive grass with a few darker patches (deterministic pseudo-random)
const ground = [];
for (let r = 0; r < ROWS; r++) {
  ground[r] = [];
  for (let c = 0; c < COLS; c++) ground[r][c] = ((c * 7 + r * 13 + c * r) % 11 === 0) ? 1 : 0;
}
const GROUND_COLORS = ['#7d8a3c', '#6f7c33'];

// ---- Latin content ----
// Student builds show only approved lines. Add ?drafts=1 to the address to see drafts, marked [draft].
const SHOW_DRAFTS = new URLSearchParams(location.search).has('drafts');
// Two ways to play, chosen on the title screen (or with ?lang=en or ?lang=la in the address):
//   'la'  Latin mode: orders and messages are Latin, with an English hint on first sight.
//   'en'  English mode: the same game in English, for history and social studies classes.
// An entry's optional 'en' text (and 'en_title' for history cards) is the English-mode wording. It is shown once its
// 'en_status' is approved (or with ?drafts=1); until then English mode falls back to the plain translation in 'english'.
let LANG = 'la';
function line(id) {
  const e = LATIN.find(x => x.id === id);
  if (!e || (e.review_status !== 'approved' && !SHOW_DRAFTS)) return null;
  const draft = e.review_status !== 'approved';
  if (LANG === 'en') {
    const enOk = e.en_status === 'approved' || SHOW_DRAFTS;
    const enDraft = e.en_status !== 'approved';
    if (e.type === 'culture_note') { // history card: an English title over the English paragraph
      const title = e.en_title && enOk ? e.en_title + (enDraft ? ' [draft]' : '') : '';
      return { text: title, english: e.en && enOk ? e.en : e.english };
    }
    const useEn = e.en && enOk;
    return { text: (useEn ? e.en : e.english) + (draft || (useEn && enDraft) ? ' [draft]' : ''), english: '' };
  }
  return { text: e.latin + (draft ? ' [draft]' : ''), english: e.english };
}
function say(id) { const l = line(id); return l ? l.text : '?'; }

// Resources. Each points at its word and its gather order in the Latin content file.
const RES = M.resources;
const CARRY_MAX = M.carryMax;
const stock = {};
Object.keys(RES).forEach(k => { stock[k] = 0; });

// Where gathered goods are dropped off (placeholder storehouse)
const store = Object.assign({}, M.store);
const storeSpot = { x: store.x + store.w / 2, y: store.y + store.h + 14 };

// Buildings you can put up. w and h are in tiles; work is farmer-seconds of building time.
const BUILD = M.buildings;
const buildings = [];   // { type, x, y, w, h, progress, done } in pixels
let placing = null;     // key of the building being placed, or null
let cursor = null;      // screen position of the mouse over the map

// Resource nodes (trees, rocks, ...)
const nodes = [];
M.nodes.forEach(group => group.at.forEach(([x, y], i) => nodes.push({ type: group.type, x, y, amount: group.amount, look: (nodes.length * 7 + i) % 5 })));

// Farmers: a few to start. A finished house or forum may bring more (M.farmers.arrivals).
const farmers = [];
function addFarmer(x, y) {
  farmers.push({
    x, y, speed: 110,
    selected: false,
    state: 'idle',        // idle | move | toNode | gather | toStore | toBuild | build
    tx: 0, ty: 0,         // where it is walking
    node: null,           // resource node it is working on
    site: null,           // building it is putting up
    carry: null, carryN: 0, timer: 0,
  });
}
M.farmers.start.forEach(([x, y]) => addFarmer(x, y));

const soldiers = []; // made in defense.js when the warning comes

// Little effects: coloured puffs, rising numbers and words, and a screen shake that fades
const fx = [];
const floaters = [];
let shake = 0;
function puff(x, y, color) { fx.push({ x, y, t: 0, color: color || '#f3e6c4' }); }
function floater(x, y, text, color) { floaters.push({ x, y, text, color: color || '#fff', t: 0 }); }
const lastBuilt = type => buildings.filter(b => b.type === type && b.done).slice(-1)[0];

const NEW_FARMERS = M.farmers.arrivals;
// A box beside the new building that explains the arrival, then fades away
let popup = null;
function showPopup(b, l) {
  const el = document.getElementById('popup');
  el.textContent = '';
  const latin = document.createElement('div'), en = document.createElement('div');
  latin.className = 'latin'; latin.textContent = l.text;
  en.className = 'en'; en.textContent = l.english;
  el.appendChild(latin); if (l.english) el.appendChild(en);
  popup = { x: b.x + b.w / 2, y: b.y - 6, t: 0 };
  el.style.display = 'block'; el.style.opacity = 1;
}
function updatePopup(dt) {
  if (!popup) return;
  const el = document.getElementById('popup');
  popup.t += dt;
  const s = toScreenXY(popup.x, popup.y);
  el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
  el.style.opacity = popup.t < 6 ? 1 : Math.max(0, 1 - (popup.t - 6) / 1.5);
  if (popup.t > 7.5) { el.style.display = 'none'; popup = null; }
}

function onBuilt(b) {
  b.doneAt = performance.now(); // the building pops into place
  sfx('built');
  for (let i = 0; i < 5; i++) puff(b.x + Math.random() * b.w, b.y + b.h - 4, '#d9ccaa');
  floater(b.x + b.w / 2, b.y - 6, '✓', '#9be07f');
  const arrival = NEW_FARMERS[b.type];
  if (!arrival) return;
  const n = arrival.n;
  for (let i = 0; i < n; i++) addFarmer(b.x + b.w / 2 + (i - (n - 1) / 2) * 20, b.y + b.h + 12);
  const l = line(arrival.say);
  if (l) showPopup(b, l);
}

function toWorld(e) { return toWorldXY(e.clientX, e.clientY); }

// Mouse: a click selects or gives an order; dragging with the left button draws a selection box.
let box = null;    // drawing a selection box
canvas.addEventListener('mousedown', e => {
  if (e.button === 0) box = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, moved: false };
});
window.addEventListener('mousemove', e => {
  if (box) {
    box.x1 = e.clientX; box.y1 = e.clientY;
    if (Math.abs(box.x1 - box.x0) + Math.abs(box.y1 - box.y0) > 6) box.moved = true;
  }
});
canvas.addEventListener('mousemove', e => { cursor = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('mouseleave', () => { cursor = null; });
canvas.addEventListener('contextmenu', e => { e.preventDefault(); setPlacing(null); }); // right-click cancels placing
window.addEventListener('mouseup', e => {
  if (e.button === 0 && box) {
    const b = box; box = null;
    if (!b.moved) handleClick(toWorld(e), e.shiftKey);
    else selectInBox(b, e.shiftKey);
  }
});

function selectInBox(b, shift) {
  const a = toWorldXY(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1)), z = toWorldXY(Math.max(b.x0, b.x1), Math.max(b.y0, b.y1));
  const x0 = a.x, x1 = z.x, y0 = a.y, y1 = z.y;
  farmers.concat(soldiers).forEach(f => {
    const inside = f.x >= x0 && f.x <= x1 && f.y >= y0 && f.y <= y1;
    if (inside) f.selected = true; else if (!shift) f.selected = false;
  });
}

// What a click at world point p would act on: an unfinished building, a tree, rock or pond, or the river or hill
function targetAt(p) {
  const site = buildings.find(b => !b.done && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
  if (site) return { site };
  const node = nodes.find(n => Math.hypot(n.x - p.x, n.y - p.y) < 22);
  if (node) return { node };
  const place = placeAt(p);
  return place ? { place } : null;
}

let lastTip = null;
// The Latin order floats above the cursor when farmers are selected and the mouse is over something they can work on
function updateTip() {
  const tip = document.getElementById('tip');
  let id = null;
  if (cursor && !boxOpen && !placing && !(box && box.moved)) {
    const p = toWorldXY(cursor.x, cursor.y);
    const sc = scrolls.find(s => Math.hypot(s.x - p.x, s.y - 4 - p.y) < 20);
    if (sc) id = sc.card; // a scroll shows the heading of its card
    else if (personAt(p, farmers)) id = M.words.farmer; // so students know what they are
    else if (personAt(p, soldiers)) id = M.words.soldier;
    else if (farmers.some(f => f.selected)) {
      const t = targetAt(p);
      if (t) id = t.site ? BUILD[t.site.type].order : t.node ? RES[t.node.type].order
        : (BEATS[beat] && BEATS[beat].walk === t.place ? PLACES[t.place].order : null); // the river and the hill only while Romulus is sending you there
    }
  }
  if ((lastTip === M.words.farmer || lastTip === M.words.soldier) && id !== lastTip) hintsSeen.add(lastTip); // the English has been seen once the mouse moves away
  lastTip = id;
  const l = id && line(id);
  if (!l) { tip.style.display = 'none'; return; }
  tip.textContent = l.text;
  if ((id === M.words.farmer || id === M.words.soldier) && !hintsSeen.has(id) && l.english) { // English under the Latin, first time only
    const en = document.createElement('div'); en.className = 'en'; en.textContent = l.english; tip.appendChild(en);
  }
  tip.style.left = cursor.x + 'px';
  tip.style.top = (cursor.y - 22) + 'px';
  tip.style.display = 'block';
}

// The person under a point: the click target is the whole sprite (head to feet), not just its middle
function personAt(p, list) {
  let best = null, bestD = Infinity;
  (list || farmers.concat(soldiers)).forEach(f => {
    if (Math.abs(p.x - f.x) > 14 || p.y < f.y - 26 || p.y > f.y + 15) return;
    const d = Math.hypot(p.x - f.x, p.y - f.y + 6);
    if (d < bestD) { best = f; bestD = d; }
  });
  return best;
}

function handleClick(p, shift) {
  // Scrolls and people come first, even while a building is being placed, so you can still pick who builds it
  const scroll = scrolls.find(s => Math.hypot(s.x - p.x, s.y - 4 - p.y) < 20);
  if (scroll && !placing) { readScroll(scroll); return; }
  const people = farmers.concat(soldiers);
  const hit = personAt(p);
  if (hit) {
    if (!shift) people.forEach(f => f.selected = false);
    hit.selected = shift ? !hit.selected : true;
    return;
  }
  if (placing) { tryPlace(p); return; }
  const sel = farmers.filter(f => f.selected);
  const target = targetAt(p);
  if (target && target.site) { sel.forEach(f => sendToBuild(f, target.site)); if (sel.length) showOrder(BUILD[target.site.type].order); return; }
  if (target && target.node) {
    if (sel.length) { sel.forEach(f => sendGather(f, target.node)); showOrder(RES[target.node.type].order); }
    return;
  }
  const walkers = sel.concat(soldiers.filter(f => f.selected));
  if (walkers.length) showOrder(target && target.place ? PLACES[target.place].order : M.commands.walk);
  walkers.forEach((f, i) => { // plain ground: walk there, spreading the group out a little
    f.state = 'move'; f.node = null; f.site = null; f.guard = null;
    f.tx = Math.max(10, Math.min(MAP_W - 10, p.x + (i % 3 - 1) * 24));
    f.ty = Math.max(10, Math.min(MAP_H - 10, p.y + Math.floor(i / 3) * 24));
  });
}

function sendGather(f, node, toForum) {
  f.node = node; f.site = null; f.state = 'toNode'; f.toForum = !!toForum; // toForum: deliver stone to the forum instead of the storehouse
  if (f.carry && f.carry !== node.type) { f.carry = null; f.carryN = 0; } // drops the old load
}

// ---- Placing and building ----
function afford(cost) { return Object.keys(cost).every(k => stock[k] >= cost[k]); }

function overlaps(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }

function canPlace(r) {
  if (r.x < 0 || r.y < FOREST_H || r.x + r.w > MAP_W || r.y + r.h > MAP_H) return false;
  if (RIVER && [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h], [r.x + r.w / 2, r.y + r.h / 2]].some(([x, y]) => riverDist(x, y) < RIVER.half + 6)) return false;
  if (overlaps(r, store)) return false;
  if (buildings.some(b => overlaps(r, b))) return false;
  const pad = 16; // keep clear of trees, rocks and ponds
  return !nodes.some(n => n.x > r.x - pad && n.x < r.x + r.w + pad && n.y > r.y - pad && n.y < r.y + r.h + pad);
}

// The rectangle a building would fill if placed under the world point p (snapped to the tile grid)
function ghostRect(type, p) {
  const b = BUILD[type], w = b.w * TILE, h = b.h * TILE;
  return { x: Math.round((p.x - w / 2) / TILE) * TILE, y: Math.round((p.y - h / 2) / TILE) * TILE, w, h };
}

function setPlacing(type) {
  placing = type;
  setMsg(type ? 'Click the map to place. Right-click or Esc to cancel.' : '');
  updateHud();
}

let msgTimer = null;
function setMsg(text, english) {
  const el = document.getElementById('msg');
  el.textContent = text;
  el.title = english || ''; // English on hover when the message is Latin
  clearTimeout(msgTimer);
  if (text && !placing) msgTimer = setTimeout(() => { el.textContent = ''; el.title = ''; }, 6000);
}

function tryPlace(p) {
  const def = BUILD[placing], r = ghostRect(placing, p);
  if (!afford(def.cost)) { setPlacing(null); setMsg('Not enough resources.'); return; }
  if (!canPlace(r)) { setMsg("Can't build there."); return; }
  Object.keys(def.cost).forEach(k => stock[k] -= def.cost[k]);
  sfx('place');
  const site = { type: placing, x: r.x, y: r.y, w: r.w, h: r.h, progress: 0, done: false };
  buildings.push(site);
  // Selected farmers build it; with nobody selected, the nearest farmer does
  let crew = farmers.filter(f => f.selected);
  if (!crew.length) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const busy = f => (f.state === 'toBuild' || f.state === 'build') ? 1e6 : 0; // prefer farmers not already building
    const dist = f => Math.hypot(f.x - cx, f.y - cy) + busy(f);
    crew = [farmers.slice().sort((a, b) => dist(a) - dist(b))[0]];
  }
  crew.forEach(f => sendToBuild(f, site));
  showOrder(def.order);
  if (!afford(def.cost)) setPlacing(null); // stay in placing mode only while you can pay for more
  updateHud();
}

function sendToBuild(f, site) {
  f.site = site; f.node = null; f.state = 'toBuild';
  f.carry = null; f.carryN = 0; // drops any load
}

// After finishing, a farmer carries on with the nearest unfinished building close by
function nextBuild(f) {
  let best = null, bestD = 400;
  buildings.forEach(b => {
    const d = Math.hypot(b.x + b.w / 2 - f.x, b.y + b.h / 2 - f.y);
    if (!b.done && d < bestD) { best = b; bestD = d; }
  });
  f.site = best; f.state = best ? 'toBuild' : 'idle';
}

// Keyboard
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') setPlacing(null);
  if ((e.key === 'a' || e.key === 'A') && !boxOpen && !cardOpen) farmers.forEach(f => f.selected = true); // A selects every farmer
});

// Walk toward (tx, ty); returns true when arrived
function walk(f, tx, ty, dt, reach) {
  const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy);
  if (d <= reach) return true;
  const step = Math.min(f.speed * dt, d);
  f.x += dx / d * step; f.y += dy / d * step;
  return false;
}

function update(f, dt) {
  if (f.state === 'move') {
    if (walk(f, f.tx, f.ty, dt, 1)) f.state = 'idle';
  } else if (f.state === 'toNode') {
    if (f.node.amount <= 0) { f.state = 'idle'; f.node = null; return; }
    if (walk(f, f.node.x, f.node.y, dt, 24)) { f.state = 'gather'; f.timer = 0; }
  } else if (f.state === 'gather') {
    if (f.node.amount <= 0) { f.state = f.carryN ? 'toStore' : 'idle'; return; }
    f.timer += dt;
    if (f.timer >= RES[f.node.type].gatherTime) {
      f.timer = 0; f.carry = f.node.type; f.carryN++; f.node.amount--; sfx('gather');
      if (f.carryN >= CARRY_MAX) f.state = 'toStore';
    }
  } else if (f.state === 'toBuild') {
    if (f.site.done) { nextBuild(f); return; }
    const s = f.site;
    if (walk(f, s.x + s.w / 2, s.y + s.h / 2, dt, Math.max(s.w, s.h) / 2 + 20)) f.state = 'build';
  } else if (f.state === 'build') {
    const s = f.site;
    if (s.done) { nextBuild(f); return; }
    s.progress += dt;
    if (Math.random() < dt * 2.5) puff(s.x + Math.random() * s.w, s.y + s.h, '#cdbf9a'); // dust while building
    if (s.progress >= BUILD[s.type].work) { s.done = true; onBuilt(s); nextBuild(f); }
  } else if (f.state === 'toStore') {
    const forum = f.toForum ? buildings.find(b => b.type === 'forum' && b.done) : null; // stone for the soldiers goes to the forum
    const spot = forum ? { x: forum.x + forum.w / 2, y: forum.y + forum.h + 14 } : storeSpot;
    if (walk(f, spot.x, spot.y, dt, 4)) {
      floater(spot.x, spot.y - 12, '+' + f.carryN, RES[f.carry].color === '#2f5a2a' ? '#8fd18a' : '#e8e4d8'); sfx('coin');
      if (forum && f.carry === 'stone') depositToForum(f.carryN); else stock[f.carry] += f.carryN;
      f.carry = null; f.carryN = 0;
      updateHud();
      f.state = (f.node && f.node.amount > 0) ? 'toNode' : 'idle'; // go back for more
    }
  }
}

// ---- Commands and the order line ----
const selectedFarmers = () => farmers.filter(f => f.selected);
function nearest(list, from) {
  return list.slice().sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
}
function groupCenter(sel) {
  return { x: sel.reduce((t, f) => t + f.x, 0) / sel.length, y: sel.reduce((t, f) => t + f.y, 0) / sel.length };
}

function gatherOrder(kind) {
  const sel = selectedFarmers();
  if (!sel.length) { setMsg('Select some farmers first.'); return; }
  const node = nearest(nodes.filter(n => n.type === kind), groupCenter(sel));
  if (!node) { setMsg('None of that is left.'); return; }
  sel.forEach(f => sendGather(f, node));
  showOrder(RES[kind].order);
}

// Each command lists its full orders. Orders are read aloud (shown) exactly as written in the content file.
const COMMANDS = [
  { id: M.commands.gather, orders: Object.keys(RES).map(k => ({ id: RES[k].order, run: () => gatherOrder(k) })) },
  { id: M.commands.build, orders: Object.keys(BUILD).map(k => ({ id: BUILD[k].order, build: k, run: () => setPlacing(k) })) },
];
COMMANDS.push({ id: M.commands.replay, direct: () => replayOrder() });
let openCommand = null;

// Words and orders whose English hover has been used up; cleared again after a mistake
const hintsSeen = new Set();

function makeButton(id, onClick) {
  const l = line(id);
  if (!l) return null;
  const b = document.createElement('button');
  b.textContent = l.text;
  // English hint on hover: only until this line has been seen or used once; it returns after a mistake
  b.addEventListener('mouseenter', () => { b.title = hintsSeen.has(id) ? '' : l.english; });
  b.addEventListener('click', () => { b.blur(); onClick(); hintsSeen.add(id); });
  return b;
}

function costText(cost) {
  return Object.keys(cost).map(k => cost[k] + ' ' + say(RES[k].word)).join(', ');
}

function renderCommands() {
  const verbs = document.getElementById('cmds'), orders = document.getElementById('orders');
  verbs.textContent = ''; orders.textContent = '';
  COMMANDS.forEach(cmd => {
    const b = makeButton(cmd.id, () => {
      if (cmd.direct) { cmd.direct(); return; }
      openCommand = openCommand === cmd.id ? null : cmd.id; setPlacing(null); renderCommands();
    });
    if (!b) return;
    if (openCommand === cmd.id) b.classList.add('active');
    verbs.appendChild(b);
  });
  const open = COMMANDS.find(c => c.id === openCommand);
  if (!open) return;
  open.orders.forEach(o => {
    const b = makeButton(o.id, () => { o.run(); updateHud(); });
    if (!b) return;
    if (o.build) {
      b.textContent += '  (' + costText(BUILD[o.build].cost) + ')';
      b.dataset.build = o.build;
    }
    orders.appendChild(b);
  });
  updateHud();
}

function showOrder(id) {
  const l = line(id), el = document.getElementById('order');
  el.textContent = l ? l.text : '';
  el.title = l && !hintsSeen.has(id) ? l.english : '';
  hintsSeen.add(id);
  checkOrder(id);
}

function updateHud() {
  const res = document.getElementById('res');
  res.textContent = '';
  Object.keys(RES).forEach(k => {
    const row = document.createElement('div'), sw = document.createElement('span');
    sw.className = 'swatch'; sw.style.background = RES[k].color;
    row.appendChild(sw);
    row.appendChild(document.createTextNode(say(RES[k].word) + ': ' + stock[k]));
    res.appendChild(row);
  });
  if (soldiers.length) { // how many Roman soldiers are left
    const row = document.createElement('div'), sw = document.createElement('span');
    sw.className = 'swatch'; sw.style.background = '#2a6fb0';
    row.appendChild(sw); row.appendChild(document.createTextNode('× ' + soldiers.length));
    res.appendChild(row);
  }
  document.querySelectorAll('#orders button[data-build]').forEach(b => {
    const type = b.dataset.build;
    b.disabled = !afford(BUILD[type].cost);
    b.classList.toggle('active', placing === type);
  });
}

// ---- Optional scrolls: history the player may stop and read ----
const scrolls = [];
let scrollsRead = 0, scrollsTotal = 0;
function addScroll(def) {
  if (!line(def.card)) return; // an unapproved card is simply skipped
  const at = typeof def.at === 'function' ? def.at() : def.at;
  scrolls.push({ card: def.card, x: at[0], y: at[1], born: performance.now() });
  scrollsTotal++;
  sfx('ping');
}
function readScroll(s) {
  scrolls.splice(scrolls.indexOf(s), 1);
  scrollsRead++;
  sfx('page');
  showCards([s.card]);
}

// ---- Cameos: someone walks across the map (and may jump the wall) ----
const cameos = [];
function startCameo(name, done) {
  const def = M.cameos[name], path = def.path();
  if (!path || !path.length) { done(); return; }
  cameos.push({ def, path, i: 0, x: path[0].x, y: path[0].y, z: 0, jump: null, done });
}
function updateCameos(dt) {
  for (let k = cameos.length - 1; k >= 0; k--) {
    const c = cameos[k];
    if (c.jump) { // an arc from one point to the next
      c.jump.t += dt;
      const u = Math.min(1, c.jump.t / c.jump.dur);
      c.x = c.jump.x0 + (c.jump.x1 - c.jump.x0) * u; c.y = c.jump.y0 + (c.jump.y1 - c.jump.y0) * u; c.z = Math.sin(u * Math.PI) * 34;
      if (u >= 1) { c.jump = null; c.z = 0; c.i++; }
    } else {
      const next = c.path[c.i + 1];
      if (!next) { cameos.splice(k, 1); c.done(); continue; }
      if (next.jump) { c.jump = { x0: c.x, y0: c.y, x1: next.x, y1: next.y, t: 0, dur: 0.8 }; sfx('jump'); }
      else if (walkTo(c, next.x, next.y, dt, next.speed || c.def.speed || 70, 3)) c.i++;
    }
  }
}
function walkTo(o, tx, ty, dt, speed, reach) {
  const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
  if (d <= reach) return true;
  const step = Math.min(speed * dt, d);
  o.x += dx / d * step; o.y += dy / d * step; o.facing = dx;
  return false;
}
function drawCameo(c) {
  const x = sx(c.x), y = sy(c.y);
  shadow(x, y + 11, 9 - c.z / 10, 3, 0.25);
  blit(c.jump ? ART.remus[1] : personFrame(ART.remus, true, false), x, y + 13 - c.z, c.facing < 0);
}

// ---- Ranks: the player's title rises with the city ----
let rankNow = -1;
function updateRank() {
  if (!M.ranks) return;
  let best = 0;
  M.ranks.forEach((r, i) => { if (r.when()) best = i; });
  if (best <= rankNow) return;
  const first = rankNow < 0;
  rankNow = best;
  const l = line(M.ranks[best].entry);
  const el = document.getElementById('rank');
  el.textContent = l ? l.text : '';
  el.title = l ? l.english : '';
  if (!first && l) { // a banner announces the new rank
    const b = document.getElementById('banner');
    b.textContent = l.text; b.title = l.english; b.style.display = 'block';
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    setTimeout(() => { b.style.display = 'none'; }, 3200);
    sfx('rank');
  }
}

// ---- Messages from Romulus ----
let boxOpen = false, boxAfter = null;
const messagesSeen = new Set(); // messages whose English hint has already been shown

function showMessage(id, face, after, speaker) {
  speaker = speaker || 'romulus'; // the speaker that talks unless another is named
  const l = line(id);
  if (!l) { if (after) after(); return; } // an unapproved line is simply skipped
  const first = !messagesSeen.has(id);
  messagesSeen.add(id);
  const name = line(M.speakers[speaker].name);
  document.getElementById('speaker').textContent = name ? name.text : '';
  document.getElementById('mtext').textContent = l.text;
  const hint = document.getElementById('mhint');
  hint.textContent = first ? l.english : ''; // shown only while the mouse is over the Latin, and only the first time
  document.getElementById('mtext').classList.toggle('hasHint', first && !!l.english);

  // Portrait: a flat silhouette with the speaker's name stands in until the art file is found
  const img = document.getElementById('portrait'), ph = document.getElementById('placeholder');
  ph.innerHTML = portraitSVG(speaker, face); // a cartoon stand-in until the painted portrait files are supplied
  const label = document.createElement('span'); label.textContent = name ? name.text : ''; ph.appendChild(label);
  ph.style.background = M.speakers[speaker].color;
  img.style.display = 'block'; ph.style.display = 'none';
  img.onerror = () => { img.style.display = 'none'; ph.style.display = 'flex'; };
  img.src = 'missions/' + M.id + '/assets/portraits/portrait_' + speaker + '_' + face + '.png';

  sfx('msg');
  boxOpen = true; boxAfter = after || null;
  document.getElementById('msgbox').style.display = 'flex';
  document.getElementById('mok').focus();
}

function closeMessage() {
  if (!boxOpen) return;
  boxOpen = false;
  document.getElementById('msgbox').style.display = 'none';
  const after = boxAfter; boxAfter = null;
  if (after) after();
}
document.getElementById('mok').addEventListener('click', closeMessage);
window.addEventListener('keydown', e => { // Enter or Space dismisses whichever box is open (never both at once)
  if (e.key !== 'Enter' && e.key !== ' ') return;
  if (cardOpen) { e.preventDefault(); nextCardPage(); }
  else if (boxOpen) { e.preventDefault(); closeMessage(); }
});

// ---- The opening orders: one at a time, each waits for the player to do it ----
const GATHER_ORDERS = Object.keys(RES).map(k => RES[k].order);
const isBuilt = (type, n) => buildings.filter(b => b.type === type && b.done).length >= (n || 1);
// How many farmers have arrived at the river or on the hill
const farmersAt = place => farmers.filter(f => f.state === 'idle' && (place === 'river' ? riverDist(f.x, f.y) < RIVER.half + RIVER.bank + 30 : inHill(f.x, f.y))).length;

// The steps of the mission, from missions/<name>/mission.js. 'allow: gather' means gathering is never a mistake there.
const BEATS = M.beats.map(b => Object.assign({}, b, { allow: b.allow === 'gather' ? GATHER_ORDERS : b.allow }));
// What a step with 'run' starts
const RUNNERS = { defense: () => beginWarning() };

// Messages and history cards one after another, then 'after'
function runSequence(steps, after) {
  const next = i => {
    if (i >= steps.length) { if (after) after(); return; }
    const s = steps[i];
    if (s.cards) showCards(s.cards, () => next(i + 1));
    else if (s.cameo) startCameo(s.cameo, () => next(i + 1));
    else showMessage(s.msg, s.face || 'neutral', () => next(i + 1), s.speaker);
  };
  next(0);
}
const WORK_ORDERS = Object.keys(RES).map(k => RES[k].order).concat(Object.keys(BUILD).map(k => BUILD[k].order));
let beat = -1;
const recent = []; // the last three orders Romulus gave

function startBeat(i) {
  beat = i;
  const b = BEATS[i];
  if (b.pre && !b.preShown) { b.preShown = true; showCards(b.pre, () => startBeat(i)); return; } // history cards before the message
  if (b.run) { RUNNERS[b.run](); return; }
  if (b.expects) { recent.push(b.say); if (recent.length > 3) recent.shift(); renderRecent(); }
  showMessage(b.say, b.face);
}

function checkBeat() {
  const b = BEATS[beat];
  if (b && b.done && !b.finishing && b.done()) {
    b.finishing = true; // a cameo does not pause the game, so make sure the ending of a step happens only once
    if (b.scroll) b.scroll.forEach(addScroll); // optional history appears on the map
    const steps = b.after || (b.post ? [{ cards: b.post }] : null); // messages, cameos and mandatory cards after the step
    if (steps) runSequence(steps, () => startBeat(beat + 1));
    else startBeat(beat + 1);
  }
}

// Romulus sighs when the player works on something other than the current order
function checkOrder(id) {
  const b = BEATS[beat];
  if (!b || !b.expects || boxOpen || !WORK_ORDERS.includes(id) || b.expects.includes(id) || (b.allow && b.allow.includes(id))) return;
  // The English hints come back after a mistake: for the message, and for the buttons the player should have used
  messagesSeen.delete(b.say); messagesSeen.delete(M.mistake.msg);
  b.expects.forEach(o => {
    hintsSeen.delete(o);
    const cmd = COMMANDS.find(c => c.orders && c.orders.some(x => x.id === o));
    if (cmd) hintsSeen.delete(cmd.id);
  });
  showMessage(M.mistake.msg, M.mistake.face, () => showMessage(b.say, b.face));
}

// Relege: hear the current order again
function replayOrder() {
  const b = BEATS[beat];
  if (b && b.say && !boxOpen) showMessage(b.say, b.face);
}

function renderRecent() {
  const el = document.getElementById('recent');
  el.textContent = '';
  recent.forEach((id, i) => {
    const l = line(id);
    if (!l) return;
    const d = document.createElement('div');
    d.textContent = l.text;
    if (i === recent.length - 1) d.className = 'current';
    el.appendChild(d);
  });
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000) * (window.TIMESCALE || 1); last = now; // TIMESCALE is only set by the debug panel
  updatePopup(dt);
  for (let i = floaters.length - 1; i >= 0; i--) { floaters[i].t += dt; if (floaters[i].t > 1.2) floaters.splice(i, 1); }
  shake = Math.max(0, shake - dt * 30);
  updateCritters(dt); updateDusk(dt);
  if (!boxOpen && !cardOpen) { // the clock stops while a message or the ending card is open
    farmers.forEach(f => update(f, dt));
    checkBeat();
    updateAttack(dt);
    updateCameos(dt);
    updateRank();
  }
  for (let i = nodes.length - 1; i >= 0; i--) if (nodes[i].amount <= 0) nodes.splice(i, 1);
  draw();
  updateTip();
  requestAnimationFrame(frame);
}

function sx(x) { return Math.round(x - cam.x); }
function sy(y) { return Math.round(y - cam.y); }

function drawScroll(s) {
  const bob = Math.sin((performance.now() - s.born) / 300) * 3, x = sx(s.x), y = sy(s.y) + bob;
  ctx.globalAlpha = 0.35 + 0.2 * Math.sin((performance.now() - s.born) / 250);
  ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.arc(x, y - 4, 22, 0, Math.PI * 2); ctx.fill(); // a soft glow so it is easy to spot
  ctx.globalAlpha = 1;
  blit(ART.scroll, x, y + 4, false);
}

function drawNode(n) {
  const x = sx(n.x), y = sy(n.y);
  if (n.type === 'wood') {
    shadow(x, y + 13, 14, 4, 0.25);
    const img = n.look % 4 === 0 ? ART.olive : ART.pine;
    blit(img, x, y + 16, n.look % 2 === 1);
  } else {
    shadow(x, y + 10, 16, 4, 0.25);
    blit(ART.rock[n.look % 2], x, y + 12, false);
  }
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1c1c1c'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(view.ox, view.oy); ctx.scale(view.zoom, view.zoom);
  ctx.beginPath(); ctx.rect(0, 0, MAP_W, MAP_H); ctx.clip(); // nothing is drawn outside the map
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake); // when a building falls
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(ART.ground, 0, 0);                    // grass, paths, the hill, the banks and the forest (drawn once)
  drawRiver();                                        // the water moves, so it is drawn every frame
  drawForestEyes();
  buildingShadow(store); shadow(store.x + store.w / 2, store.y + store.h - 2, 30, 6, 0.18);
  blitAt(ART.store, store.x - 2, store.y - 2);

  // Everything with a position draws back to front
  const things = nodes.map(n => ({ y: n.y, draw: () => drawNode(n) }))
    .concat(buildings.map(b => ({ y: b.y + b.h, draw: () => drawBuilding(b) })))
    .concat(farmers.map(f => ({ y: f.y, draw: () => drawFarmer(f) })))
    .concat(scrolls.map(s => ({ y: s.y, draw: () => drawScroll(s) })))
    .concat(cameos.map(c => ({ y: c.y, draw: () => drawCameo(c) })))
    .concat(critters.map(c => ({ y: c.y, draw: () => drawCritter(c) })))
    .concat(attackThings());
  things.sort((a, b) => a.y - b.y).forEach(t => t.draw());
  drawAttackOverlay();
  drawLighting();                                     // dusk, and the glow of windows and torches
  floaters.forEach(f => { // rising numbers
    ctx.globalAlpha = Math.max(0, 1 - f.t / 1.2); ctx.fillStyle = f.color; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3;
    ctx.font = 'bold 18px Georgia, serif'; ctx.textAlign = 'center';
    ctx.strokeText(f.text, sx(f.x), sy(f.y) - f.t * 34); ctx.fillText(f.text, sx(f.x), sy(f.y) - f.t * 34);
    ctx.globalAlpha = 1;
  });
  ctx.textAlign = 'start';

  if (placing && cursor) { // ghost of the building being placed, red where it can't go
    const r = ghostRect(placing, toWorldXY(cursor.x, cursor.y));
    ctx.globalAlpha = 0.55;
    drawShape(placing, r);
    if (!canPlace(r)) { ctx.fillStyle = '#d02020'; ctx.fillRect(sx(r.x), sy(r.y), r.w, r.h); }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (box && box.moved) { // the selection box is drawn in window pixels
    ctx.fillStyle = 'rgba(243,230,196,0.15)'; ctx.strokeStyle = '#f3e6c4'; ctx.lineWidth = 2;
    ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0); ctx.strokeRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  }
}

function drawBuilding(b) {
  const def = BUILD[b.type];
  const age = b.doneAt ? performance.now() - b.doneAt : 1e9; // a little pop when it is finished
  ctx.save();
  if (age < 400) {
    const k = 1 + 0.15 * Math.sin(age / 400 * Math.PI), cx = sx(b.x + b.w / 2), cy = sy(b.y + b.h);
    ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy);
  }
  buildingShadow(b);
  ctx.globalAlpha = b.done ? 1 : 0.3 + 0.55 * b.progress / def.work;
  drawShape(b.type, b);
  ctx.restore();
  ctx.globalAlpha = 1;
  if (!b.done) { // scaffolding: poles and a crossbeam
    ctx.strokeStyle = '#8a5a1e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(b.x, b.y + b.h); ctx.lineTo(b.x, b.y + 6); ctx.moveTo(b.x + b.w, b.y + b.h); ctx.lineTo(b.x + b.w, b.y + 6); ctx.moveTo(b.x - 4, b.y + b.h * 0.5); ctx.lineTo(b.x + b.w + 4, b.y + b.h * 0.5); ctx.stroke();
  }
  if (!b.done) { // progress bar
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(sx(b.x), sy(b.y) - 8, b.w, 5);
    ctx.fillStyle = '#e0c060'; ctx.fillRect(sx(b.x), sy(b.y) - 8, b.w * b.progress / def.work, 5);
  }
}

// Placeholder art for each kind of building, drawn inside rectangle r
function drawShape(type, r) {
  const art = BUILD[type].art;
  if (art === 'house') blitAt(ART.house, r.x - 2, r.y - 2);
  else if (art === 'wall') blitAt(ART.wall, r.x, r.y);
  else if (art === 'gate') blitAt(ART.gate, r.x, r.y);
  else blitAt(ART.forum, r.x - 2, r.y - 2);
}

function drawFarmer(f) {
  const moving = f.state === 'move' || f.state === 'toNode' || f.state === 'toStore' || f.state === 'toBuild';
  const working = f.state === 'gather' || f.state === 'build';
  const x = sx(f.x), y = sy(f.y);
  if (f.facing === undefined) f.facing = 1;
  const tx = f.state === 'move' ? f.tx : f.state === 'toNode' && f.node ? f.node.x : f.state === 'toBuild' && f.site ? f.site.x + f.site.w / 2 : f.state === 'toStore' ? storeSpot.x : null;
  if (tx !== null && Math.abs(tx - f.x) > 2) f.facing = tx > f.x ? 1 : -1;
  shadow(x, y + 11, 9, 3);
  if (f.selected) { ctx.strokeStyle = '#f3e6c4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y + 11, 15, 6, 0, 0, 7); ctx.stroke(); }
  blit(personFrame(ART.farmer, moving, working), x, y + 13, f.facing < 0);
  if (f.carryN > 0) { // load carried: colored boxes over the head, one per item
    ctx.fillStyle = RES[f.carry].color;
    for (let i = 0; i < f.carryN; i++) { ctx.fillRect(x - 13 + i * 6, y - 31, 5, 5); ctx.strokeStyle = '#2a1c08'; ctx.lineWidth = 1; ctx.strokeRect(x - 13 + i * 6 + 0.5, y - 31 + 0.5, 4, 4); }
  }
  if (f.state === 'move') { ctx.fillStyle = '#f3e6c4'; ctx.fillRect(sx(f.tx) - 2, sy(f.ty) - 2, 4, 4); }
}

// Called at the end of attack.js, once everything has loaded
function startGame() {
  buildArt(); buildGround(); addCritters(); // draw the sprites and the ground once
  resize();
  renderCommands();
  updateHud();
  startBeat(0);
  requestAnimationFrame(frame);
}

// The menu box can be folded away, and the help text shown or hidden
document.getElementById('fold').addEventListener('click', e => {
  const folded = document.getElementById('panel').classList.toggle('folded');
  e.target.textContent = folded ? '+' : '–';
  e.target.blur();
});
document.getElementById('helpbtn').addEventListener('click', e => {
  const h = document.getElementById('help');
  h.style.display = h.style.display === 'block' ? 'none' : 'block';
  e.target.blur();
});

// The Tiber and the Palatine Hill (placeholder art)
// ---- Title screen: choose how to play ----
function entryText(id) { const e = LATIN.find(x => x.id === id); return e && (e.review_status === 'approved' || SHOW_DRAFTS) ? e : null; }

function beginPlay(lang) {
  LANG = lang;
  document.body.classList.toggle('en', lang === 'en');
  document.documentElement.lang = lang === 'en' ? 'en' : 'la';
  document.getElementById('title').style.display = 'none';
  startGame();
  setMusic(true);
}

function showTitle() {
  const asked = new URLSearchParams(location.search).get('lang'); // a teacher can link straight to one mode
  if (asked === 'en' || asked === 'la') { beginPlay(asked); return; }
  const t = entryText(M.titleEntry);
  document.getElementById('titlelatin').textContent = t ? t.latin : '';
  document.getElementById('titleenglish').textContent = t ? t.english : '';
  document.getElementById('title').style.display = 'flex';
  document.getElementById('playla').focus();
}
document.getElementById('playla').addEventListener('click', () => beginPlay('la'));
document.getElementById('playen').addEventListener('click', () => beginPlay('en'));
