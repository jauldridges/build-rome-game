// Step 6: the warning, the Sabine attack and the ending card. Loaded after game.js, which it relies on.
// Placeholder art only. Every Latin line comes from content/latin.js; this file holds none.

const raiders = [];                       // the Sabines
const HP = { wall: 10, gate: 14, house: 14, forum: 30 }; // how much a building can take
const war = { phase: 'none', clock: 0, clockMax: 90, wave: 0, lost: false };
let cardOpen = false;

// ---- The warning ----
function beginWarning() {
  war.wave = 1; war.phase = 'warn';
  spawnSoldiers(4);
  COMMANDS.push({ id: 'cmd_defende', orders: [{ id: 'order_defende_murum', run: defendOrder }] });
  renderCommands();
  // scout, then Romulus twice; the clock starts when the last box is closed
  showMessage('msg_scout_warning', 'alarmed', () =>
    showMessage('msg_romulus_hurry', 'alarmed', () =>
      showMessage('msg_romulus_soldiers', 'neutral', startClock), 'romulus'), 'scout');
}

function spawnSoldiers(n) {
  const forum = buildings.find(b => b.type === 'forum' && b.done);
  const x = forum ? forum.x + forum.w / 2 : storeSpot.x, y = forum ? forum.y + forum.h + 24 : storeSpot.y + 10;
  for (let i = 0; i < n; i++) {
    soldiers.push({ x: x + (i - (n - 1) / 2) * 26, y, speed: 105, selected: false, state: 'idle', tx: 0, ty: 0, guard: null });
  }
}

function startClock() {
  war.phase = 'prep';
  war.clockMax = war.clock = war.wave === 1 ? 90 : 60; // the game rushes the reader only once; retries are calmer
  updateClock();
}

function updateClock() {
  const el = document.getElementById('clock');
  el.style.display = war.phase === 'prep' ? 'block' : 'none';
  document.getElementById('clockfill').style.width = Math.max(0, war.clock / war.clockMax * 100) + '%';
}

// ---- The soldiers ----
function selectedSoldiers() { return soldiers.filter(s => s.selected); }

// The place behind the wall where defenders stand: just south of the finished wall pieces, or north of the town if there are none
function guardPoint() {
  const walls = buildings.filter(b => b.done && (b.type === 'wall' || b.type === 'gate'));
  if (walls.length) {
    return { x: walls.reduce((t, b) => t + b.x + b.w / 2, 0) / walls.length, y: Math.max(...walls.map(b => b.y + b.h)) + 30 };
  }
  const c = townCenter();
  return { x: c.x, y: Math.max(FOREST_H + 60, c.y - 140) };
}

function defendOrder() {
  const sel = selectedSoldiers();
  if (!sel.length) { setMsg('Select some soldiers first.'); return; }
  const g = guardPoint();
  sel.forEach((s, i) => { s.guard = { x: g.x + (i - (sel.length - 1) / 2) * 34, y: g.y }; s.state = 'idle'; });
  showOrder('order_defende_murum');
}

function updateSoldier(s, dt) {
  if (s.state === 'move') { if (walk(s, s.tx, s.ty, dt, 2)) s.state = 'idle'; return; }
  let foe = null, best = s.guard ? 190 : 110;
  raiders.forEach(r => { const d = Math.hypot(r.x - s.x, r.y - s.y); if (d < best) { foe = r; best = d; } });
  if (foe) {
    s.fighting = walk(s, foe.x, foe.y, dt, 22);
    if (s.fighting) foe.hp -= 2.5 * dt;
  } else {
    s.fighting = false;
    if (s.guard && Math.hypot(s.guard.x - s.x, s.guard.y - s.y) > 24) walk(s, s.guard.x, s.guard.y, dt, 6);
  }
}

// ---- The Sabines ----
function townCenter() {
  const pts = buildings.filter(b => b.done && b.type !== 'wall' && b.type !== 'gate').map(b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 }));
  pts.push({ x: store.x + store.w / 2, y: store.y + store.h / 2 });
  return { x: pts.reduce((t, p) => t + p.x, 0) / pts.length, y: pts.reduce((t, p) => t + p.y, 0) / pts.length };
}

function spawnPoints(n) {
  const c = townCenter();
  return Array.from({ length: n }, (_, i) => ({
    x: Math.max(30, Math.min(MAP_W - 30, c.x + (i - (n - 1) / 2) * 44)),
    y: 40 + (i % 2) * 26,
  }));
}

function launchWave() {
  war.phase = 'attack'; war.lost = false; updateClock();
  const n = Math.max(3, 7 - war.wave); // each retry brings fewer
  spawnPoints(n).forEach(p => raiders.push({ x: p.x, y: p.y, hp: 6, speed: 50, target: null, hitting: null }));
}

const isWall = b => b.type === 'wall' || b.type === 'gate';
function blockerAt(x, y) {
  return buildings.find(b => b.done && isWall(b) && x > b.x - 6 && x < b.x + b.w + 6 && y > b.y - 6 && y < b.y + b.h + 6);
}

function updateRaider(r, dt) {
  if (!r.target || !buildings.includes(r.target)) {
    const homes = buildings.filter(b => b.done && !isWall(b));
    r.target = homes.sort((a, b) => Math.hypot(a.x - r.x, a.y - r.y) - Math.hypot(b.x - r.x, b.y - r.y))[0] || store;
  }
  if (r.hitting && !buildings.includes(r.hitting)) r.hitting = null;
  if (!r.hitting) {
    const t = r.target, tx = t.x + t.w / 2, ty = t.y + t.h / 2, d = Math.hypot(tx - r.x, ty - r.y);
    if (d <= Math.max(t.w, t.h) / 2 + 14) r.hitting = t === store ? null : t;
    else {
      const step = r.speed * dt, nx = r.x + (tx - r.x) / d * step, ny = r.y + (ty - r.y) / d * step;
      const wall = blockerAt(nx, ny);
      if (wall) r.hitting = wall; else { r.x = nx; r.y = ny; }
    }
  }
  if (r.hitting) {
    const b = r.hitting;
    if (b.hp === undefined) b.hp = HP[b.type];
    b.hp -= 0.6 * dt;
    if (b.hp <= 0) { buildings.splice(buildings.indexOf(b), 1); war.lost = true; r.hitting = null; }
  }
}

// ---- Each frame (the game calls this while no message is open) ----
function updateAttack(dt) {
  soldiers.forEach(s => updateSoldier(s, dt));
  if (war.phase === 'prep') {
    war.clock -= dt; updateClock();
    if (war.clock <= 0) launchWave();
  } else if (war.phase === 'attack') {
    raiders.forEach(r => updateRaider(r, dt));
    for (let i = raiders.length - 1; i >= 0; i--) if (raiders[i].hp <= 0) raiders.splice(i, 1);
    if (war.lost) lostWave();
    else if (!raiders.length) wonWave();
  }
}

// A failed defense costs a building, not the mission: the Sabines go home, the player rebuilds, they try again.
function lostWave() {
  raiders.length = 0;
  war.phase = 'fail';
  showMessage('msg_romulus_retry', 'neutral', () => { war.wave++; startClock(); });
}

function wonWave() {
  war.phase = 'won';
  showMessage('msg_tatius_peace', 'neutral', () => showMessage('msg_romulus_peace', 'pleased', showCard), 'tatius');
}

// ---- The ending card: one page for each culture note ----
const CARD_PAGES = ['culture_romulus_remus', 'culture_pomerium', 'culture_sabine_women', 'culture_tatius'];
let cardPages = [], cardAt = 0;

function showCard() {
  cardPages = CARD_PAGES.map(line).filter(Boolean);
  cardAt = 0;
  if (!cardPages.length) { endMission(); return; }
  cardOpen = true;
  document.getElementById('card').style.display = 'flex';
  renderCardPage();
}

function renderCardPage() {
  const p = cardPages[cardAt];
  document.getElementById('cardlatin').textContent = p.text;
  document.getElementById('cardenglish').textContent = p.english;
  document.getElementById('cardok').focus();
}

function nextCardPage() {
  if (!cardOpen) return;
  if (++cardAt < cardPages.length) { renderCardPage(); return; }
  cardOpen = false;
  document.getElementById('card').style.display = 'none';
  endMission();
}
document.getElementById('cardok').addEventListener('click', nextCardPage);
window.addEventListener('keydown', e => { if (cardOpen && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); nextCardPage(); } });

// Step 7 (the five-question closing check) will start here.
function endMission() { war.phase = 'over'; }

// ---- Drawing ----
function drawForest() {
  const c0 = Math.floor(cam.x / TILE), c1 = Math.min(COLS - 1, Math.ceil((cam.x + canvas.width) / TILE));
  for (let r = 0; r < FOREST_H / TILE; r++) {
    if ((r + 1) * TILE < cam.y) continue;
    for (let c = c0; c <= c1; c++) {
      const x = c * TILE - Math.round(cam.x), y = r * TILE - Math.round(cam.y);
      ctx.fillStyle = '#3f5f2a'; ctx.fillRect(x, y, TILE, TILE);
      if ((c + r) % 2 === 0) {
        ctx.fillStyle = '#5b3d1a'; ctx.fillRect(x + 14, y + 20, 5, 10);
        ctx.fillStyle = '#25461f'; ctx.fillRect(x + 4, y + 4, 24, 20);
      }
    }
  }
}

function attackThings() {
  return soldiers.map(s => ({ y: s.y, draw: () => drawSoldier(s) }))
    .concat(raiders.map(r => ({ y: r.y, draw: () => drawRaider(r) })));
}

function drawSoldier(s) {
  const x = sx(s.x), y = sy(s.y);
  if (s.selected) { ctx.strokeStyle = '#f3e6c4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y + 10, 14, 6, 0, 0, 7); ctx.stroke(); }
  ctx.fillStyle = '#2a6fb0'; ctx.fillRect(x - 6, y - 4, 12, 14);   // deep blue tunic
  ctx.fillStyle = '#b08a3a'; ctx.fillRect(x - 5, y - 13, 10, 9);   // bronze helmet
  ctx.fillStyle = '#c4623a'; ctx.fillRect(x - 1, y - 17, 3, 5);    // crest
  ctx.fillStyle = '#8a5a1e'; ctx.fillRect(x - 12, y - 2, 6, 12);   // shield
  if (s.fighting) { ctx.fillStyle = '#f3e6c4'; ctx.fillRect(x + 8, y - 8 + (Math.floor(performance.now() / 120) % 2) * 5, 3, 10); }
}

function drawRaider(r) {
  const x = sx(r.x), y = sy(r.y);
  ctx.fillStyle = '#6b2a5a'; ctx.fillRect(x - 6, y - 4, 12, 14);   // purple tunic
  ctx.fillStyle = '#e8c9a0'; ctx.fillRect(x - 5, y - 12, 10, 8);
  ctx.fillStyle = '#2a1c08'; ctx.fillRect(x - 5, y - 13, 10, 3);   // dark hair
  ctx.fillStyle = '#6b4a1e'; ctx.fillRect(x + 8, y - 14, 2, 24);   // spear
  ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x - 8, y - 20, 16, 3);   // health bar
  ctx.fillStyle = '#c0392b'; ctx.fillRect(x - 8, y - 20, 16 * Math.max(0, r.hp) / 6, 3);
}

// Red markers where the Sabines will come out of the forest, and damage on buildings under attack
function drawAttackOverlay() {
  if (war.phase === 'prep') {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 250);
    ctx.fillStyle = 'rgba(179,38,30,' + (0.4 + 0.5 * pulse) + ')';
    spawnPoints(Math.max(3, 7 - war.wave)).forEach(p => {
      const x = sx(p.x), y = sy(FOREST_H + 8);
      ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y); ctx.lineTo(x, y + 16); ctx.fill();
    });
  }
  buildings.forEach(b => {
    if (b.hp === undefined || b.hp >= HP[b.type]) return;
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(sx(b.x), sy(b.y) - 6, b.w, 4);
    ctx.fillStyle = '#c0392b'; ctx.fillRect(sx(b.x), sy(b.y) - 6, b.w * Math.max(0, b.hp) / HP[b.type], 4);
  });
}

startGame();
