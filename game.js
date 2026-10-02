// Step 2: farmers gather wood, stone and water and carry it to the storehouse. Placeholder art only.
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

// Resources. Labels are English for now; Latin arrives in step 4 from content/latin.yaml.
const RES = {
  wood:  { label: 'Wood',  color: '#2f5a2a', gatherTime: 1.0 },
  stone: { label: 'Stone', color: '#9a958a', gatherTime: 1.4 },
  water: { label: 'Water', color: '#2a6fb0', gatherTime: 0.7 },
};
const CARRY_MAX = 5;
const stock = { wood: 0, stone: 0, water: 0 };

// Where gathered goods are dropped off (placeholder storehouse)
const store = { x: 330, y: 330, w: 56, h: 48 };
const storeSpot = { x: store.x + store.w / 2, y: store.y + store.h + 14 };

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
    state: 'idle',        // idle | move | toNode | gather | toStore
    tx: 0, ty: 0,         // where it is walking
    node: null,           // resource node it is working on
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
window.addEventListener('mouseup', e => {
  if (drag && !drag.moved) handleClick(toWorld(e), e.shiftKey);
  drag = null;
});

function handleClick(p, shift) {
  const hit = farmers.find(f => Math.hypot(f.x - p.x, f.y - p.y) < 16);
  if (hit) {
    if (!shift) farmers.forEach(f => f.selected = false);
    hit.selected = shift ? !hit.selected : true;
    return;
  }
  const sel = farmers.filter(f => f.selected);
  const node = nodes.find(n => Math.hypot(n.x - p.x, n.y - p.y) < 22);
  if (node) {
    sel.forEach(f => {
      f.node = node; f.state = 'toNode';
      if (f.carry && f.carry !== node.type) { f.carry = null; f.carryN = 0; } // drops the old load
    });
    return;
  }
  sel.forEach((f, i) => { // plain ground: walk there, spreading the group out a little
    f.state = 'move'; f.node = null;
    f.tx = Math.max(10, Math.min(MAP_W - 10, p.x + (i % 3 - 1) * 24));
    f.ty = Math.max(10, Math.min(MAP_H - 10, p.y + Math.floor(i / 3) * 24));
  });
}

// Keyboard scrolling
const keys = {};
window.addEventListener('keydown', e => { keys[e.key] = true; });
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
  } else if (f.state === 'toStore') {
    if (walk(f, storeSpot.x, storeSpot.y, dt, 4)) {
      stock[f.carry] += f.carryN; f.carry = null; f.carryN = 0;
      updateHud();
      f.state = (f.node && f.node.amount > 0) ? 'toNode' : 'idle'; // go back for more
    }
  }
}

function updateHud() {
  document.getElementById('res').textContent =
    Object.keys(RES).map(k => RES[k].label + ': ' + stock[k]).join('   ');
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
  farmers.forEach(f => update(f, dt));
  for (let i = nodes.length - 1; i >= 0; i--) if (nodes[i].amount <= 0) nodes.splice(i, 1);
  draw();
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
    .concat(farmers.map(f => ({ y: f.y, draw: () => drawFarmer(f) })));
  things.sort((a, b) => a.y - b.y).forEach(t => t.draw());
}

function drawFarmer(f) {
  const x = sx(f.x), y = sy(f.y);
  if (f.selected) { ctx.strokeStyle = '#f3e6c4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y + 10, 14, 6, 0, 0, 7); ctx.stroke(); }
  ctx.fillStyle = '#c4623a'; ctx.fillRect(x - 6, y - 4, 12, 14); // terracotta tunic
  ctx.fillStyle = '#e8c9a0'; ctx.fillRect(x - 5, y - 12, 10, 8); // head
  if (f.state === 'gather') { // little swinging mark while working
    ctx.fillStyle = '#f3e6c4'; ctx.fillRect(x + 8, y - 6 + (Math.floor(performance.now() / 150) % 2) * 4, 4, 4);
  }
  if (f.carryN > 0) { // load carried: colored boxes over the head, one per item
    ctx.fillStyle = RES[f.carry].color;
    for (let i = 0; i < f.carryN; i++) ctx.fillRect(x - 12 + i * 5, y - 20, 4, 4);
  }
  if (f.state === 'move') { ctx.fillStyle = '#f3e6c4'; ctx.fillRect(sx(f.tx) - 2, sy(f.ty) - 2, 4, 4); }
}

resize();
updateHud();
requestAnimationFrame(frame);
