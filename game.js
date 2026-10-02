// Step 5: Romulus gives the opening orders in message boxes with portraits.
// Orders are given in Latin. Every Latin line is read from content/latin.js (built from content/latin.yaml).
// Placeholder art only.
const TILE = 32, COLS = 60, ROWS = 40;
const MAP_W = COLS * TILE, MAP_H = ROWS * TILE;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const cam = { x: 0, y: 0 };

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; clampCam(); }
function clampCam() {
  cam.x = Math.max(0, Math.min(cam.x, MAP_W - canvas.width));
  cam.y = Math.max(0, Math.min(cam.y, MAP_H - canvas.height));
}
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
function line(id) {
  const e = LATIN.find(x => x.id === id);
  if (!e || (e.review_status !== 'approved' && !SHOW_DRAFTS)) return null;
  return { text: e.latin + (e.review_status === 'approved' ? '' : ' [draft]'), english: e.english };
}
function say(id) { const l = line(id); return l ? l.text : '?'; }

// Resources. Each points at its word and its gather order in the Latin content file.
const RES = {
  wood:  { word: 'vocab_lignum', order: 'order_collige_lignum',  color: '#2f5a2a', gatherTime: 1.0 },
  stone: { word: 'vocab_lapis',  order: 'order_collige_lapidem', color: '#9a958a', gatherTime: 1.4 },
  water: { word: 'vocab_aqua',   order: 'order_collige_aquam',   color: '#2a6fb0', gatherTime: 0.7 },
};
const CARRY_MAX = 5;
const stock = { wood: 0, stone: 0, water: 0 };

// Where gathered goods are dropped off (placeholder storehouse)
const store = { x: 330, y: 330, w: 56, h: 48 };
const storeSpot = { x: store.x + store.w / 2, y: store.y + store.h + 14 };

// Buildings you can put up. w and h are in tiles; work is farmer-seconds of building time.
const BUILD = {
  house: { order: 'order_aedifica_casam',  w: 2, h: 2, cost: { wood: 8 },            work: 6 },
  wall:  { order: 'order_aedifica_murum',  w: 1, h: 1, cost: { stone: 2 },           work: 2 },
  gate:  { order: 'order_aedifica_portam', w: 2, h: 1, cost: { wood: 4, stone: 2 },  work: 3 },
  forum: { order: 'order_aedifica_forum',  w: 4, h: 3, cost: { stone: 12, wood: 8 }, work: 12 },
};
const buildings = [];   // { type, x, y, w, h, progress, done } in pixels
let placing = null;     // key of the building being placed, or null
let cursor = null;      // screen position of the mouse over the map

// Resource nodes: trees to the north-east, rocks to the south-west, a pond to the east
const nodes = [];
function addNodes(type, list, amount) { list.forEach(([x, y]) => nodes.push({ type, x, y, amount })); }
addNodes('wood',  [[620, 220], [660, 250], [700, 210], [640, 290], [720, 270], [680, 330]], 60);
addNodes('stone', [[160, 520], [200, 560], [130, 580], [220, 500]], 80);
addNodes('water', [[820, 440], [860, 470], [840, 510], [880, 440], [800, 480]], 150);

// Farmers
const farmers = [];
for (let i = 0; i < 5; i++) {
  farmers.push({
    x: 400 + i * 50, y: 440 + (i % 2) * 40, speed: 110,
    selected: false,
    state: 'idle',        // idle | move | toNode | gather | toStore | toBuild | build
    tx: 0, ty: 0,         // where it is walking
    node: null,           // resource node it is working on
    site: null,           // building it is putting up
    carry: null, carryN: 0, timer: 0,
  });
}

function toWorld(e) { return { x: e.clientX + cam.x, y: e.clientY + cam.y }; }

// Mouse: a click selects or gives an order; dragging scrolls the map
let drag = null;
canvas.addEventListener('mousedown', e => { drag = { sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, moved: false }; });
window.addEventListener('mousemove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
  if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
  if (drag.moved) { cam.x = drag.cx - dx; cam.y = drag.cy - dy; clampCam(); }
});
canvas.addEventListener('mousemove', e => { cursor = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('mouseleave', () => { cursor = null; });
canvas.addEventListener('contextmenu', e => { e.preventDefault(); setPlacing(null); });
window.addEventListener('mouseup', e => {
  if (drag && !drag.moved) handleClick(toWorld(e), e.shiftKey);
  drag = null;
});

// What a click at world point p would act on: an unfinished building, or a tree, rock or pond
function targetAt(p) {
  const site = buildings.find(b => !b.done && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
  if (site) return { site };
  const node = nodes.find(n => Math.hypot(n.x - p.x, n.y - p.y) < 22);
  return node ? { node } : null;
}

// The Latin order floats above the cursor when farmers are selected and the mouse is over something they can work on
function updateTip() {
  const tip = document.getElementById('tip');
  let id = null;
  if (cursor && !boxOpen && !placing && !(drag && drag.moved) && farmers.some(f => f.selected)) {
    const t = targetAt({ x: cursor.x + cam.x, y: cursor.y + cam.y });
    if (t) id = t.site ? BUILD[t.site.type].order : RES[t.node.type].order;
  }
  const l = id && line(id);
  if (!l) { tip.style.display = 'none'; return; }
  tip.textContent = l.text;
  tip.style.left = cursor.x + 'px';
  tip.style.top = (cursor.y - 22) + 'px';
  tip.style.display = 'block';
}

function handleClick(p, shift) {
  if (placing) { tryPlace(p); return; }
  const hit = farmers.find(f => Math.hypot(f.x - p.x, f.y - p.y) < 16);
  if (hit) {
    if (!shift) farmers.forEach(f => f.selected = false);
    hit.selected = shift ? !hit.selected : true;
    return;
  }
  const sel = farmers.filter(f => f.selected);
  const target = targetAt(p);
  if (target && target.site) { sel.forEach(f => sendToBuild(f, target.site)); if (sel.length) showOrder(BUILD[target.site.type].order); return; }
  if (target && target.node) {
    if (sel.length) { sel.forEach(f => sendGather(f, target.node)); showOrder(RES[target.node.type].order); }
    return;
  }
  if (sel.length) showOrder('cmd_ambula');
  sel.forEach((f, i) => { // plain ground: walk there, spreading the group out a little
    f.state = 'move'; f.node = null; f.site = null;
    f.tx = Math.max(10, Math.min(MAP_W - 10, p.x + (i % 3 - 1) * 24));
    f.ty = Math.max(10, Math.min(MAP_H - 10, p.y + Math.floor(i / 3) * 24));
  });
}

function sendGather(f, node) {
  f.node = node; f.site = null; f.state = 'toNode';
  if (f.carry && f.carry !== node.type) { f.carry = null; f.carryN = 0; } // drops the old load
}

// ---- Placing and building ----
function afford(cost) { return Object.keys(cost).every(k => stock[k] >= cost[k]); }

function overlaps(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }

function canPlace(r) {
  if (r.x < 0 || r.y < 0 || r.x + r.w > MAP_W || r.y + r.h > MAP_H) return false;
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
function setMsg(text) {
  document.getElementById('msg').textContent = text;
  clearTimeout(msgTimer);
  if (text && !placing) msgTimer = setTimeout(() => { document.getElementById('msg').textContent = ''; }, 3000);
}

function tryPlace(p) {
  const def = BUILD[placing], r = ghostRect(placing, p);
  if (!afford(def.cost)) { setPlacing(null); setMsg('Not enough resources.'); return; }
  if (!canPlace(r)) { setMsg("Can't build there."); return; }
  Object.keys(def.cost).forEach(k => stock[k] -= def.cost[k]);
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

// Keyboard scrolling
const keys = {};
window.addEventListener('keydown', e => { keys[e.key] = true; if (e.key === 'Escape') setPlacing(null); });
window.addEventListener('keyup', e => { keys[e.key] = false; });

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
      f.timer = 0; f.carry = f.node.type; f.carryN++; f.node.amount--;
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
    if (s.progress >= BUILD[s.type].work) { s.done = true; nextBuild(f); }
  } else if (f.state === 'toStore') {
    if (walk(f, storeSpot.x, storeSpot.y, dt, 4)) {
      stock[f.carry] += f.carryN; f.carry = null; f.carryN = 0;
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

// Walk to the nearest pond, or to a finished forum
function walkOrder(id, kind) {
  const sel = selectedFarmers();
  if (!sel.length) { setMsg('Select some farmers first.'); return; }
  const c = groupCenter(sel);
  let target;
  if (kind === 'forum') {
    const b = nearest(buildings.filter(x => x.type === 'forum' && x.done).map(x => ({ x: x.x + x.w / 2, y: x.y + x.h + 20 })), c);
    target = b;
  } else {
    const n = nearest(nodes.filter(x => x.type === kind).map(x => ({ x: x.x, y: x.y + 34 })), c);
    target = n;
  }
  if (!target) { setMsg(kind === 'forum' ? 'There is no forum yet.' : 'None of that is left.'); return; }
  sel.forEach((f, i) => { f.state = 'move'; f.node = null; f.site = null; f.tx = target.x + (i - (sel.length - 1) / 2) * 22; f.ty = target.y; });
  showOrder(id);
}

// Each command lists its full orders. Orders are read aloud (shown) exactly as written in the content file.
const COMMANDS = [
  { id: 'cmd_collige', orders: Object.keys(RES).map(k => ({ id: RES[k].order, run: () => gatherOrder(k) })) },
  { id: 'cmd_aedifica', orders: Object.keys(BUILD).map(k => ({ id: BUILD[k].order, build: k, run: () => setPlacing(k) })) },
  { id: 'cmd_ambula', orders: [
    { id: 'order_ambula_ad_aquam', run: () => walkOrder('order_ambula_ad_aquam', 'water') },
    { id: 'order_ambula_ad_forum', run: () => walkOrder('order_ambula_ad_forum', 'forum') },
  ] },
];
COMMANDS.push({ id: 'cmd_relege', direct: () => replayOrder() });
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
  document.querySelectorAll('#orders button[data-build]').forEach(b => {
    const type = b.dataset.build;
    b.disabled = !afford(BUILD[type].cost);
    b.classList.toggle('active', placing === type);
  });
}

// ---- Messages from Romulus ----
let boxOpen = false, boxAfter = null, hintTimer = null;
const messagesSeen = new Set(); // messages whose English hint has already been shown

function showMessage(id, face, after) {
  const l = line(id);
  if (!l) { if (after) after(); return; } // an unapproved line is simply skipped
  const first = !messagesSeen.has(id);
  messagesSeen.add(id);
  const name = line('name_romulus');
  document.getElementById('speaker').textContent = name ? name.text : '';
  document.getElementById('mtext').textContent = l.text;
  const hint = document.getElementById('mhint');
  hint.textContent = first ? l.english : '';
  hint.classList.remove('fade');
  clearTimeout(hintTimer);
  if (first) hintTimer = setTimeout(() => hint.classList.add('fade'), 5000);

  // Portrait: a flat silhouette with the speaker's name stands in until the art file is found
  const img = document.getElementById('portrait'), ph = document.getElementById('placeholder');
  ph.textContent = name ? name.text : '';
  img.style.display = 'block'; ph.style.display = 'none';
  img.onerror = () => { img.style.display = 'none'; ph.style.display = 'flex'; };
  img.src = 'assets/portraits/portrait_romulus_' + face + '.png';

  boxOpen = true; boxAfter = after || null;
  document.getElementById('msgbox').style.display = 'flex';
  document.getElementById('mok').focus();
}

function closeMessage() {
  if (!boxOpen) return;
  boxOpen = false;
  clearTimeout(hintTimer);
  document.getElementById('msgbox').style.display = 'none';
  const after = boxAfter; boxAfter = null;
  if (after) after();
}
document.getElementById('mok').addEventListener('click', closeMessage);
window.addEventListener('keydown', e => { if (boxOpen && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); closeMessage(); } });

// ---- The opening orders: one at a time, each waits for the player to do it ----
const BEATS = [
  { say: 'msg_romulus_intro', face: 'pleased', expects: null, done: () => true }, // introduction: the next order follows once it is dismissed
  { say: 'order_collige_lignum', face: 'neutral', expects: ['order_collige_lignum'], done: () => stock.wood >= 8 },
  { say: 'msg_romulus_stone', face: 'pleased', expects: ['order_collige_lapidem'], done: () => stock.stone >= 5 },
  { say: 'msg_romulus_house', face: 'pleased', expects: ['order_aedifica_casam'],  done: () => buildings.some(b => b.type === 'house' && b.done) },
  { say: 'msg_romulus_done',  face: 'pleased', expects: null, done: null },
];
const WORK_ORDERS = Object.keys(RES).map(k => RES[k].order).concat(Object.keys(BUILD).map(k => BUILD[k].order));
let beat = -1;
const recent = []; // the last three orders Romulus gave

function startBeat(i) {
  beat = i;
  const b = BEATS[i];
  if (b.expects) { recent.push(b.say); if (recent.length > 3) recent.shift(); renderRecent(); }
  showMessage(b.say, b.face);
}

function checkBeat() {
  const b = BEATS[beat];
  if (b && b.done && b.done()) startBeat(beat + 1);
}

// Romulus sighs when the player works on something other than the current order
function checkOrder(id) {
  const b = BEATS[beat];
  if (!b || !b.expects || boxOpen || !WORK_ORDERS.includes(id) || b.expects.includes(id)) return;
  // The English hints come back after a mistake: for the message, and for the buttons the player should have used
  messagesSeen.delete(b.say); messagesSeen.delete('msg_romulus_relege');
  b.expects.forEach(o => {
    hintsSeen.delete(o);
    const cmd = COMMANDS.find(c => c.orders && c.orders.some(x => x.id === o));
    if (cmd) hintsSeen.delete(cmd.id);
  });
  showMessage('msg_romulus_relege', 'neutral', () => showMessage(b.say, b.face));
}

// Relege: hear the current order again
function replayOrder() {
  const b = BEATS[beat];
  if (b && !boxOpen) showMessage(b.say, b.face);
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
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const scroll = 500 * dt;
  if (keys.ArrowLeft) cam.x -= scroll;
  if (keys.ArrowRight) cam.x += scroll;
  if (keys.ArrowUp) cam.y -= scroll;
  if (keys.ArrowDown) cam.y += scroll;
  clampCam();
  if (!boxOpen) { // the clock stops while a message is open
    farmers.forEach(f => update(f, dt));
    checkBeat();
  }
  for (let i = nodes.length - 1; i >= 0; i--) if (nodes[i].amount <= 0) nodes.splice(i, 1);
  draw();
  updateTip();
  requestAnimationFrame(frame);
}

function sx(x) { return Math.round(x - cam.x); }
function sy(y) { return Math.round(y - cam.y); }

function drawNode(n) {
  const x = sx(n.x), y = sy(n.y);
  if (n.type === 'wood') {
    ctx.fillStyle = '#6b4a1e'; ctx.fillRect(x - 3, y, 6, 14);        // trunk
    ctx.fillStyle = RES.wood.color; ctx.fillRect(x - 12, y - 18, 24, 22); // leaves
  } else if (n.type === 'stone') {
    ctx.fillStyle = RES.stone.color; ctx.fillRect(x - 14, y - 8, 28, 20);
    ctx.fillStyle = '#c9c4b6'; ctx.fillRect(x - 8, y - 12, 14, 8);
  } else {
    ctx.fillStyle = RES.water.color; ctx.beginPath(); ctx.ellipse(x, y, 24, 16, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#7fb4e0'; ctx.fillRect(x - 8, y - 4, 10, 2);
  }
}

function draw() {
  const c0 = Math.floor(cam.x / TILE), c1 = Math.min(COLS - 1, Math.ceil((cam.x + canvas.width) / TILE));
  const r0 = Math.floor(cam.y / TILE), r1 = Math.min(ROWS - 1, Math.ceil((cam.y + canvas.height) / TILE));
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) {
      ctx.fillStyle = GROUND_COLORS[ground[r][c]];
      ctx.fillRect(c * TILE - Math.round(cam.x), r * TILE - Math.round(cam.y), TILE, TILE);
    }
  // Storehouse
  ctx.fillStyle = '#b8a47e'; ctx.fillRect(sx(store.x), sy(store.y), store.w, store.h);
  ctx.fillStyle = '#a0522d'; ctx.fillRect(sx(store.x) - 4, sy(store.y) - 10, store.w + 8, 14);

  // Everything with a position draws back to front
  const things = nodes.map(n => ({ y: n.y, draw: () => drawNode(n) }))
    .concat(buildings.map(b => ({ y: b.y + b.h, draw: () => drawBuilding(b) })))
    .concat(farmers.map(f => ({ y: f.y, draw: () => drawFarmer(f) })));
  things.sort((a, b) => a.y - b.y).forEach(t => t.draw());

  if (placing && cursor) { // ghost of the building being placed, red where it can't go
    const r = ghostRect(placing, { x: cursor.x + cam.x, y: cursor.y + cam.y });
    ctx.globalAlpha = 0.55;
    drawShape(placing, r);
    if (!canPlace(r)) { ctx.fillStyle = '#d02020'; ctx.fillRect(sx(r.x), sy(r.y), r.w, r.h); }
    ctx.globalAlpha = 1;
  }
}

function drawBuilding(b) {
  const def = BUILD[b.type];
  ctx.globalAlpha = b.done ? 1 : 0.35 + 0.5 * b.progress / def.work;
  drawShape(b.type, b);
  ctx.globalAlpha = 1;
  if (!b.done) { // progress bar
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(sx(b.x), sy(b.y) - 8, b.w, 5);
    ctx.fillStyle = '#e0c060'; ctx.fillRect(sx(b.x), sy(b.y) - 8, b.w * b.progress / def.work, 5);
  }
}

// Placeholder art for each kind of building, drawn inside rectangle r
function drawShape(type, r) {
  const x = sx(r.x), y = sy(r.y), w = r.w, h = r.h;
  if (type === 'house') {
    ctx.fillStyle = '#d9ccaa'; ctx.fillRect(x, y + h * 0.35, w, h * 0.65);       // walls
    ctx.fillStyle = '#c4623a'; ctx.fillRect(x - 3, y, w + 6, h * 0.4);           // roof
    ctx.fillStyle = '#6b4a1e'; ctx.fillRect(x + w / 2 - 6, y + h * 0.6, 12, h * 0.4); // door
  } else if (type === 'wall') {
    ctx.fillStyle = '#b9b3a3'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#d6d0c0'; ctx.fillRect(x, y, w, 8);
    ctx.fillStyle = '#8f8a7c'; ctx.fillRect(x, y + h / 2, w, 2); ctx.fillRect(x + w / 2, y + 8, 2, h / 2 - 8);
  } else if (type === 'gate') {
    ctx.fillStyle = '#b9b3a3'; ctx.fillRect(x, y, 14, h); ctx.fillRect(x + w - 14, y, 14, h); // posts
    ctx.fillRect(x, y, w, 10);                                                       // lintel
    ctx.fillStyle = '#6b4a1e'; ctx.fillRect(x + 14, y + 10, w - 28, h - 10);        // door
  } else {
    ctx.fillStyle = '#d6cba8'; ctx.fillRect(x, y, w, h);                              // paved floor
    ctx.strokeStyle = '#8f8a7c'; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    ctx.fillStyle = '#f2ecd8';
    for (let cx = x + 10; cx < x + w - 10; cx += 24) ctx.fillRect(cx, y + 6, 8, 20);  // columns
    ctx.fillStyle = '#2a6fb0'; ctx.fillRect(x + w / 2 - 8, y + h / 2, 16, 20);      // banner
  }
}

function drawFarmer(f) {
  const x = sx(f.x), y = sy(f.y);
  if (f.selected) { ctx.strokeStyle = '#f3e6c4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y + 10, 14, 6, 0, 0, 7); ctx.stroke(); }
  ctx.fillStyle = '#c4623a'; ctx.fillRect(x - 6, y - 4, 12, 14); // terracotta tunic
  ctx.fillStyle = '#e8c9a0'; ctx.fillRect(x - 5, y - 12, 10, 8); // head
  if (f.state === 'gather' || f.state === 'build') { // little swinging mark while working
    ctx.fillStyle = '#f3e6c4'; ctx.fillRect(x + 8, y - 6 + (Math.floor(performance.now() / 150) % 2) * 4, 4, 4);
  }
  if (f.carryN > 0) { // load carried: colored boxes over the head, one per item
    ctx.fillStyle = RES[f.carry].color;
    for (let i = 0; i < f.carryN; i++) ctx.fillRect(x - 12 + i * 5, y - 20, 4, 4);
  }
  if (f.state === 'move') { ctx.fillStyle = '#f3e6c4'; ctx.fillRect(sx(f.tx) - 2, sy(f.ty) - 2, 4, 4); }
}

resize();
renderCommands();
updateHud();
startBeat(0);
requestAnimationFrame(frame);
