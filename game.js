// Step 1: scrollable map with farmers you can click and move. Placeholder art only.
const TILE = 32, COLS = 60, ROWS = 40;
const MAP_W = COLS * TILE, MAP_H = ROWS * TILE;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let cam = { x: 0, y: 0 };

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

// Farmers
const farmers = [];
for (let i = 0; i < 5; i++) {
  farmers.push({ x: 400 + i * 50, y: 400 + (i % 2) * 40, tx: null, ty: null, selected: false, speed: 110 });
}

function toWorld(e) { return { x: e.clientX + cam.x, y: e.clientY + cam.y }; }

// Mouse: click selects/moves; dragging with the mouse scrolls the map
let drag = null;
canvas.addEventListener('mousedown', e => { drag = { sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, moved: false }; });
window.addEventListener('mousemove', e => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  if (!drag) return;
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
  if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
  if (drag.moved) { cam.x = drag.cx - dx; cam.y = drag.cy - dy; clampCam(); }
});
window.addEventListener('mouseup', e => {
  if (drag && !drag.moved) handleClick(toWorld(e), e.shiftKey);
  drag = null;
});
const mouse = { x: -1, y: -1 };

function handleClick(p, shift) {
  const hit = farmers.find(f => Math.hypot(f.x - p.x, f.y - p.y) < 16);
  if (hit) {
    if (!shift) farmers.forEach(f => f.selected = false);
    hit.selected = !hit.selected || !shift ? true : false;
    return;
  }
  const sel = farmers.filter(f => f.selected);
  sel.forEach((f, i) => { // spread the group out a little
    f.tx = Math.max(10, Math.min(MAP_W - 10, p.x + (i % 3 - 1) * 24));
    f.ty = Math.max(10, Math.min(MAP_H - 10, p.y + (Math.floor(i / 3)) * 24));
  });
}

// Keyboard scrolling
const keys = {};
window.addEventListener('keydown', e => { keys[e.key] = true; });
window.addEventListener('keyup', e => { keys[e.key] = false; });

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const scroll = 500 * dt;
  if (keys.ArrowLeft) cam.x -= scroll;
  if (keys.ArrowRight) cam.x += scroll;
  if (keys.ArrowUp) cam.y -= scroll;
  if (keys.ArrowDown) cam.y += scroll;
  if (!drag) { // edge scrolling
    const edge = 20;
    if (mouse.x >= 0 && mouse.x < edge) cam.x -= scroll;
    if (mouse.x > canvas.width - edge) cam.x += scroll;
    if (mouse.y >= 0 && mouse.y < edge + 30 && mouse.y > 30) cam.y -= scroll;
    if (mouse.y > canvas.height - edge) cam.y += scroll;
  }
  clampCam();

  for (const f of farmers) {
    if (f.tx === null) continue;
    const dx = f.tx - f.x, dy = f.ty - f.y, d = Math.hypot(dx, dy);
    const step = f.speed * dt;
    if (d <= step) { f.x = f.tx; f.y = f.ty; f.tx = f.ty = null; }
    else { f.x += dx / d * step; f.y += dy / d * step; }
  }
  draw();
  requestAnimationFrame(frame);
}

function draw() {
  const c0 = Math.floor(cam.x / TILE), c1 = Math.min(COLS - 1, Math.ceil((cam.x + canvas.width) / TILE));
  const r0 = Math.floor(cam.y / TILE), r1 = Math.min(ROWS - 1, Math.ceil((cam.y + canvas.height) / TILE));
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) {
      ctx.fillStyle = GROUND_COLORS[ground[r][c]];
      ctx.fillRect(Math.round(c * TILE - cam.x), Math.round(r * TILE - cam.y), TILE, TILE);
    }
  // Sort by y so lower farmers draw in front
  for (const f of [...farmers].sort((a, b) => a.y - b.y)) {
    const x = Math.round(f.x - cam.x), y = Math.round(f.y - cam.y);
    if (f.selected) { ctx.strokeStyle = '#f3e6c4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y + 10, 14, 6, 0, 0, 7); ctx.stroke(); }
    ctx.fillStyle = '#c4623a'; ctx.fillRect(x - 6, y - 4, 12, 14); // terracotta tunic
    ctx.fillStyle = '#e8c9a0'; ctx.fillRect(x - 5, y - 12, 10, 8); // head
    if (f.tx !== null) { ctx.fillStyle = '#f3e6c4'; ctx.fillRect(Math.round(f.tx - cam.x) - 2, Math.round(f.ty - cam.y) - 2, 4, 4); }
  }
}

resize();
requestAnimationFrame(frame);
