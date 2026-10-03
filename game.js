// Step 6: the Sabine attack (see attack.js) and the ending card.
// Romulus gives the opening orders in message boxes with portraits. Orders are given in Latin. Every Latin line is read from content/latin.js (built from content/latin.yaml).
// Placeholder art only.
const TILE = 32, COLS = 40, ROWS = 25; // the whole world fits on one screen: no scrolling
const FOREST_H = 96; // the forest along the north edge, where the Sabines come from

// The Tiber runs north to south down the left side of the map, and the Palatine Hill rises just east of it.
const RIVER = { half: 30, points: [[150, 96], [175, 220], [155, 360], [178, 500], [160, 640], [185, 740], [165, 800]] };
const HILL = { x: 520, y: 380, rx: 190, ry: 120 };
function riverDist(x, y) { // distance from a point to the middle of the river
  let best = Infinity;
  for (let i = 0; i + 1 < RIVER.points.length; i++) {
    const [ax, ay] = RIVER.points[i], [bx, by] = RIVER.points[i + 1];
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    best = Math.min(best, Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))));
  }
  return best;
}
const inHill = (x, y) => ((x - HILL.x) / HILL.rx) ** 2 + ((y - HILL.y) / HILL.ry) ** 2 <= 1;
// 'river' (the water and its banks), 'hill', or null for plain ground
function placeAt(p) {
  if (riverDist(p.x, p.y) <= RIVER.half + 40) return 'river';
  return inHill(p.x, p.y) ? 'hill' : null;
}
const PLACES = { river: { order: 'order_ambula_ad_flumen' }, hill: { order: 'order_ambula_ad_montem' } };
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
const RES = {
  wood:  { word: 'vocab_lignum', order: 'order_collige_lignum',  color: '#2f5a2a', gatherTime: 1.0 },
  stone: { word: 'vocab_lapis',  order: 'order_collige_lapidem', color: '#9a958a', gatherTime: 1.4 },
};
const CARRY_MAX = 5;
const stock = { wood: 0, stone: 0 };

// Where gathered goods are dropped off (placeholder storehouse)
const store = { x: 470, y: 530, w: 56, h: 48 };
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

// Resource nodes: trees to the south-east of the storehouse, rocks to the south-west
const nodes = [];
function addNodes(type, list, amount) { list.forEach(([x, y]) => nodes.push({ type, x, y, amount })); }
addNodes('wood',  [[620, 580], [665, 605], [710, 570], [650, 645], [720, 625], [690, 535]], 60);
addNodes('stone', [[345, 600], [385, 640], [360, 670], [430, 590]], 80);

// Farmers: three to start. A finished house brings one more, a finished forum three more.
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
for (let i = 0; i < 3; i++) addFarmer(1090 + i * 48, 700 + (i % 2) * 34); // they start in the bottom right corner

const soldiers = []; // made in attack.js when the warning comes

const NEW_FARMERS = { house: { n: 1, say: 'msg_farmer_arrives' }, forum: { n: 3, say: 'msg_farmers_arrive' } };
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
    if (farmers.some(f => Math.hypot(f.x - p.x, f.y - p.y) < 16)) id = 'vocab_agricola'; // so students know what they are
    else if (soldiers.some(f => Math.hypot(f.x - p.x, f.y - p.y) < 16)) id = 'vocab_miles';
    else if (farmers.some(f => f.selected)) {
      const t = targetAt(p);
      if (t) id = t.site ? BUILD[t.site.type].order : t.node ? RES[t.node.type].order
        : (BEATS[beat] && BEATS[beat].walk === t.place ? PLACES[t.place].order : null); // the river and the hill only while Romulus is sending you there
    }
  }
  if ((lastTip === 'vocab_agricola' || lastTip === 'vocab_miles') && id !== lastTip) hintsSeen.add(lastTip); // the English has been seen once the mouse moves away
  lastTip = id;
  const l = id && line(id);
  if (!l) { tip.style.display = 'none'; return; }
  tip.textContent = l.text;
  if ((id === 'vocab_agricola' || id === 'vocab_miles') && !hintsSeen.has(id) && l.english) { // English under the Latin, first time only
    const en = document.createElement('div'); en.className = 'en'; en.textContent = l.english; tip.appendChild(en);
  }
  tip.style.left = cursor.x + 'px';
  tip.style.top = (cursor.y - 22) + 'px';
  tip.style.display = 'block';
}

function handleClick(p, shift) {
  if (placing) { tryPlace(p); return; }
  const people = farmers.concat(soldiers);
  const hit = people.find(f => Math.hypot(f.x - p.x, f.y - p.y) < 16);
  if (hit) {
    if (!shift) people.forEach(f => f.selected = false);
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
  const walkers = sel.concat(soldiers.filter(f => f.selected));
  if (walkers.length) showOrder(target && target.place ? PLACES[target.place].order : 'cmd_ambula');
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
  if ([[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h], [r.x + r.w / 2, r.y + r.h / 2]].some(([x, y]) => riverDist(x, y) < RIVER.half + 6)) return false;
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
    if (s.progress >= BUILD[s.type].work) { s.done = true; onBuilt(s); nextBuild(f); }
  } else if (f.state === 'toStore') {
    const forum = f.toForum ? buildings.find(b => b.type === 'forum' && b.done) : null; // stone for the soldiers goes to the forum
    const spot = forum ? { x: forum.x + forum.w / 2, y: forum.y + forum.h + 14 } : storeSpot;
    if (walk(f, spot.x, spot.y, dt, 4)) {
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
  { id: 'cmd_collige', orders: Object.keys(RES).map(k => ({ id: RES[k].order, run: () => gatherOrder(k) })) },
  { id: 'cmd_aedifica', orders: Object.keys(BUILD).map(k => ({ id: BUILD[k].order, build: k, run: () => setPlacing(k) })) },
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

// ---- Messages from Romulus ----
let boxOpen = false, boxAfter = null;
const messagesSeen = new Set(); // messages whose English hint has already been shown

function showMessage(id, face, after, speaker) {
  speaker = speaker || 'romulus';
  const l = line(id);
  if (!l) { if (after) after(); return; } // an unapproved line is simply skipped
  const first = !messagesSeen.has(id);
  messagesSeen.add(id);
  const name = line('name_' + speaker);
  document.getElementById('speaker').textContent = name ? name.text : '';
  document.getElementById('mtext').textContent = l.text;
  const hint = document.getElementById('mhint');
  hint.textContent = first ? l.english : ''; // shown only while the mouse is over the Latin, and only the first time
  document.getElementById('mtext').classList.toggle('hasHint', first && !!l.english);

  // Portrait: a flat silhouette with the speaker's name stands in until the art file is found
  const img = document.getElementById('portrait'), ph = document.getElementById('placeholder');
  ph.textContent = '';
  const label = document.createElement('span'); label.textContent = name ? name.text : ''; ph.appendChild(label);
  ph.style.background = { romulus: '#5b3a1a', scout: '#2d4a5a', tatius: '#4a2d5a' }[speaker] || '#5b3a1a';
  img.style.display = 'block'; ph.style.display = 'none';
  img.onerror = () => { img.style.display = 'none'; ph.style.display = 'flex'; };
  img.src = 'assets/portraits/portrait_' + speaker + '_' + face + '.png';

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
// How many farmers are standing at a pond
// How many farmers have arrived at the river or on the hill
const farmersAt = place => farmers.filter(f => f.state === 'idle' && (place === 'river' ? riverDist(f.x, f.y) < RIVER.half + 70 : inHill(f.x, f.y))).length;

// say: the message. expects: the work order that is right now. allow: other work orders that are never a mistake here.
const BEATS = [
  { say: 'msg_romulus_intro', face: 'pleased', pre: ['culture_romulus_remus'], expects: null, done: () => true }, // introduction: the next order follows once it is dismissed
  { say: 'order_ambula_ad_flumen', face: 'neutral', expects: [], walk: 'river', post: ['culture_hills'], done: () => farmersAt('river') >= 3 },
  { say: 'msg_romulus_hill', face: 'pleased', expects: [], walk: 'hill', done: () => farmersAt('hill') >= 3 },
  { say: 'order_collige_lignum', face: 'neutral', expects: ['order_collige_lignum'], done: () => stock.wood >= 8 },
  { say: 'msg_romulus_stone', face: 'pleased', expects: ['order_collige_lapidem'], done: () => stock.stone >= 5 },
  { say: 'msg_romulus_house', face: 'pleased', expects: ['order_aedifica_casam'], allow: GATHER_ORDERS, done: () => isBuilt('house') },
  { say: 'msg_romulus_done', face: 'pleased', expects: null, post: ['culture_asylum'], done: () => true },
  { say: 'msg_romulus_wall', face: 'pleased', expects: ['order_aedifica_murum'], allow: GATHER_ORDERS, post: ['culture_pomerium'], done: () => isBuilt('wall', 4) },
  { say: 'msg_romulus_gate', face: 'pleased', expects: ['order_aedifica_portam'], allow: GATHER_ORDERS, done: () => isBuilt('gate') },
  { say: 'msg_romulus_forum', face: 'pleased', expects: ['order_aedifica_forum'], allow: GATHER_ORDERS, post: ['culture_senate'], done: () => isBuilt('forum') },
  { say: 'msg_romulus_final', face: 'pleased', expects: null, post: ['culture_sabines'], done: () => true },
  { run: () => beginWarning(), expects: null, done: null }, // the warning, the attack and the ending (attack.js)
];
const WORK_ORDERS = Object.keys(RES).map(k => RES[k].order).concat(Object.keys(BUILD).map(k => BUILD[k].order));
let beat = -1;
const recent = []; // the last three orders Romulus gave

function startBeat(i) {
  beat = i;
  const b = BEATS[i];
  if (b.pre && !b.preShown) { b.preShown = true; showCards(b.pre, () => startBeat(i)); return; } // history cards before the message
  if (b.run) { b.run(); return; }
  if (b.expects) { recent.push(b.say); if (recent.length > 3) recent.shift(); renderRecent(); }
  showMessage(b.say, b.face);
}

function checkBeat() {
  const b = BEATS[beat];
  if (b && b.done && b.done()) {
    if (b.post) showCards(b.post, () => startBeat(beat + 1)); // history cards after the step is done
    else startBeat(beat + 1);
  }
}

// Romulus sighs when the player works on something other than the current order
function checkOrder(id) {
  const b = BEATS[beat];
  if (!b || !b.expects || boxOpen || !WORK_ORDERS.includes(id) || b.expects.includes(id) || (b.allow && b.allow.includes(id))) return;
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
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  updatePopup(dt);
  if (!boxOpen && !cardOpen) { // the clock stops while a message or the ending card is open
    farmers.forEach(f => update(f, dt));
    checkBeat();
    updateAttack(dt);
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
  }
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1c1c1c'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(view.ox, view.oy); ctx.scale(view.zoom, view.zoom);
  ctx.beginPath(); ctx.rect(0, 0, MAP_W, MAP_H); ctx.clip(); // nothing is drawn outside the map
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      ctx.fillStyle = GROUND_COLORS[ground[r][c]];
      ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
    }
  drawTerrain();
  drawForest();
  // Storehouse
  ctx.fillStyle = '#b8a47e'; ctx.fillRect(sx(store.x), sy(store.y), store.w, store.h);
  ctx.fillStyle = '#a0522d'; ctx.fillRect(sx(store.x) - 4, sy(store.y) - 10, store.w + 8, 14);

  // Everything with a position draws back to front
  const things = nodes.map(n => ({ y: n.y, draw: () => drawNode(n) }))
    .concat(buildings.map(b => ({ y: b.y + b.h, draw: () => drawBuilding(b) })))
    .concat(farmers.map(f => ({ y: f.y, draw: () => drawFarmer(f) })))
    .concat(attackThings());
  things.sort((a, b) => a.y - b.y).forEach(t => t.draw());
  drawAttackOverlay();

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

// Called at the end of attack.js, once everything has loaded
function startGame() {
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
function drawTerrain() {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const trace = () => { ctx.beginPath(); RIVER.points.forEach(([x, y], i) => i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))); };
  trace(); ctx.strokeStyle = '#a69a62'; ctx.lineWidth = RIVER.half * 2 + 14; ctx.stroke(); // muddy banks
  trace(); ctx.strokeStyle = '#2a6fb0'; ctx.lineWidth = RIVER.half * 2; ctx.stroke();
  trace(); ctx.strokeStyle = '#3b86c8'; ctx.lineWidth = RIVER.half * 1.1; ctx.stroke();
  ctx.fillStyle = '#9cc7ea';
  for (let y = 120; y < MAP_H; y += 70) { // little ripples drifting down the river
    const wob = Math.sin(y / 70) * 16;
    const near = RIVER.points.find((p, i) => RIVER.points[i + 1] && y >= p[1] && y < RIVER.points[i + 1][1]);
    if (near) ctx.fillRect(sx(near[0] + wob), sy(y), 14, 3);
  }
  // the hill: stacked, lighter ovals look like rising ground
  [[1, '#7f8c3a'], [0.86, '#8d9a45'], [0.7, '#99a653'], [0.52, '#a4b05f']].forEach(([k, color], i) => {
    ctx.fillStyle = color; ctx.beginPath();
    ctx.ellipse(sx(HILL.x), sy(HILL.y - i * 14), HILL.rx * k, HILL.ry * k, 0, 0, Math.PI * 2); ctx.fill();
  });
}

// ---- Title screen: choose how to play ----
function entryText(id) { const e = LATIN.find(x => x.id === id); return e && (e.review_status === 'approved' || SHOW_DRAFTS) ? e : null; }

function beginPlay(lang) {
  LANG = lang;
  document.body.classList.toggle('en', lang === 'en');
  document.documentElement.lang = lang === 'en' ? 'en' : 'la';
  document.getElementById('title').style.display = 'none';
  startGame();
}

function showTitle() {
  const asked = new URLSearchParams(location.search).get('lang'); // a teacher can link straight to one mode
  if (asked === 'en' || asked === 'la') { beginPlay(asked); return; }
  const t = entryText('ui_title');
  document.getElementById('titlelatin').textContent = t ? t.latin : '';
  document.getElementById('titleenglish').textContent = t ? t.english : '';
  document.getElementById('title').style.display = 'flex';
  document.getElementById('playla').focus();
}
document.getElementById('playla').addEventListener('click', () => beginPlay('la'));
document.getElementById('playen').addEventListener('click', () => beginPlay('en'));
