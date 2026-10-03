// Step 6: the warning, the Sabine attack and the ending card. Loaded after game.js, which it relies on.
// Placeholder art only. Every Latin line comes from content/latin.js; this file holds none.

const raiders = [];                       // the Sabines
const fx = [];                            // little puffs when someone falls or a building is lost
const war = { phase: 'none', clock: 0, clockMax: 10, wave: 0, snapshot: null, trainTold: false };
let cardOpen = false;

// Everything you might tune while play-testing the defense lives here.
const DEFENSE = {
  // wave: how many Sabines, where they come from, the scout's line, and the seconds of build time before they arrive
  waves: [
    { n: 4, from: 'silva',  say: 'msg_scout_warning', clock: 10 },
    { n: 6, from: 'flumen', say: 'msg_scout_wave2',   clock: 25 },
    { n: 8, from: 'agri',   say: 'msg_scout_wave3',   clock: 25 },
  ],
  retryClock: 20,                                          // build time after the whole town falls and the defense restarts
  soldier: { hp: 20, dmg: 3, speed: 105, start: 4, cost: 3 }, // cost: stones for one more soldier
  sabine: { hp: 12, speed: 52, dmgSoldier: 2, dmgBuilding: 0.7 },
  hp: { wall: 10, gate: 14, house: 14, forum: 30 },          // how much a building can take
};
const HP = DEFENSE.hp;

// ---- The warning ----
function beginWarning() {
  war.wave = 0; war.phase = 'warn';
  spawnSoldiers(DEFENSE.soldier.start);
  COMMANDS.push(
    { id: 'cmd_defende', orders: [{ id: 'order_defende_murum', run: defendOrder }] },
    { id: 'cmd_fer', orders: [{ id: 'order_fer_lapides_ad_forum', run: ferOrder }] },
    { id: 'cmd_fac', orders: [{ id: 'order_fac_milites', run: facOrder }] },
  );
  renderCommands();
  saveCheckpoint(); // if the whole town ever falls, the defense starts again from here
  // scout, then the story card, then Romulus twice; the clock starts when the last box is closed
  showMessage(DEFENSE.waves[0].say, 'alarmed', () =>
    showCards(['culture_why_war', 'culture_sabine_women'], () =>
      showMessage('msg_romulus_hurry', 'alarmed', () =>
        showMessage('msg_romulus_soldiers', 'neutral', () => startPrep(DEFENSE.waves[0].clock)), 'romulus')), 'scout');
}

// The scout announces the next wave; the build time runs until it arrives
function announceWave() {
  const w = DEFENSE.waves[war.wave];
  showMessage(w.say, 'alarmed', () => {
    if (war.wave === 1 && !war.trainTold) { war.trainTold = true; showMessage('msg_romulus_train', 'neutral', () => startPrep(w.clock)); }
    else startPrep(w.clock);
  }, 'scout');
}

function startPrep(seconds) {
  war.phase = 'prep';
  war.clockMax = war.clock = seconds;
  updateClock();
}

function updateClock() {
  const el = document.getElementById('clock');
  const on = war.phase === 'prep' || war.phase === 'attack';
  el.style.display = on ? 'block' : 'none';
  document.getElementById('clockfill').style.width = war.phase === 'prep' ? Math.max(0, war.clock / war.clockMax * 100) + '%' : '0%';
  const pips = document.getElementById('waves');
  pips.style.display = on ? 'flex' : 'none';
  pips.textContent = '';
  DEFENSE.waves.forEach((_, i) => { const d = document.createElement('i'); if (i < war.wave) d.className = 'done'; else if (i === war.wave) d.className = 'on'; pips.appendChild(d); });
}

// ---- The checkpoint: the town as it stood at the warning ----
function saveCheckpoint() {
  const drop = (k, v) => (k === 'node' || k === 'site' || k === 'target' || k === 'hitting') ? null : v; // references are rebuilt, not copied
  war.snapshot = JSON.stringify({ buildings, farmers, soldiers, nodes, stock }, drop);
}

function restoreCheckpoint() {
  const s = JSON.parse(war.snapshot);
  const swap = (arr, items) => { arr.length = 0; items.forEach(i => arr.push(i)); };
  swap(buildings, s.buildings);
  swap(nodes, s.nodes);
  swap(farmers, s.farmers.map(f => Object.assign(f, { state: 'idle', node: null, site: null, carry: null, carryN: 0, selected: false })));
  swap(soldiers, s.soldiers.map(u => Object.assign(u, { state: 'idle', selected: false, guard: null })));
  Object.assign(stock, s.stock);
  raiders.length = 0;
  updateHud();
}

// ---- The soldiers ----
function selectedSoldiers() { return soldiers.filter(s => s.selected); }

function spawnSoldiers(n) {
  const forum = buildings.find(b => b.type === 'forum' && b.done);
  const x = forum ? forum.x + forum.w / 2 : storeSpot.x, y = forum ? forum.y + forum.h + 24 : storeSpot.y + 10;
  for (let i = 0; i < n; i++) {
    const S = DEFENSE.soldier;
    soldiers.push({ x: x + (i - (n - 1) / 2) * 26 + (Math.random() * 8 - 4), y: y + Math.random() * 8, speed: S.speed, hp: S.hp, maxHp: S.hp, selected: false, state: 'idle', tx: 0, ty: 0, guard: null });
    puff(x + (i - (n - 1) / 2) * 26, y);
  }
  updateHud();
}

function puff(x, y, color) { fx.push({ x, y, t: 0, color: color || '#f3e6c4' }); }

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

const finishedForum = () => buildings.find(b => b.type === 'forum' && b.done);

// Carry stones to the forum: farmers gather stone and deliver it there. Every few stones make a soldier.
function ferOrder() {
  const sel = selectedFarmers();
  if (!sel.length) { setMsg('Select some farmers first.'); return; }
  if (!finishedForum()) { setMsg('Build a forum first.'); return; }
  const node = nearest(nodes.filter(n => n.type === 'stone'), groupCenter(sel));
  if (!node) { setMsg('None of that is left.'); return; }
  sel.forEach(f => sendGather(f, node, true));
  showOrder('order_fer_lapides_ad_forum');
}

// Called when a farmer arrives at the forum with stone
function depositToForum(n) {
  const forum = finishedForum();
  if (!forum) { stock.stone += n; return; }
  forum.stoneIn = (forum.stoneIn || 0) + n;
  while (forum.stoneIn >= DEFENSE.soldier.cost) { forum.stoneIn -= DEFENSE.soldier.cost; spawnSoldiers(1); }
}

// Make soldiers from the stone in the storehouse
function facOrder() {
  if (!finishedForum()) { setMsg('Build a forum first.'); return; }
  const n = Math.floor(stock.stone / DEFENSE.soldier.cost);
  if (!n) { setMsg('A soldier costs ' + DEFENSE.soldier.cost + ' stones.'); return; }
  stock.stone -= n * DEFENSE.soldier.cost;
  spawnSoldiers(n);
  showOrder('order_fac_milites');
}

function updateSoldier(s, dt) {
  if (s.state === 'move') { if (walk(s, s.tx, s.ty, dt, 2)) s.state = 'idle'; return; }
  let foe = null, best = s.guard ? 190 : 110;
  raiders.forEach(r => { const d = Math.hypot(r.x - s.x, r.y - s.y); if (d < best) { foe = r; best = d; } });
  if (foe) {
    s.fighting = walk(s, foe.x, foe.y, dt, 22);
    if (s.fighting) foe.hp -= DEFENSE.soldier.dmg * dt;
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

// Where a wave comes from: out of the forest (north), over the river (west) or across the fields (east)
function spawnPoints(from, n) {
  const c = townCenter(), clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  return Array.from({ length: n }, (_, i) => {
    const k = i - (n - 1) / 2;
    if (from === 'flumen') return { x: 120 + (i % 2) * 24, y: clamp(c.y + k * 40, FOREST_H + 30, MAP_H - 30), dir: 'e' };
    if (from === 'agri') return { x: MAP_W - 50 - (i % 2) * 24, y: clamp(c.y + k * 40, FOREST_H + 30, MAP_H - 30), dir: 'w' };
    return { x: clamp(c.x + k * 44, 30, MAP_W - 30), y: 28 + (i % 2) * 24, dir: 's' };
  });
}

function launchWave() {
  const w = DEFENSE.waves[war.wave], S = DEFENSE.sabine;
  war.phase = 'attack'; updateClock();
  spawnPoints(w.from, w.n).forEach(p => raiders.push({ x: p.x, y: p.y, hp: S.hp, maxHp: S.hp, speed: S.speed, target: null, hitting: null }));
}

const isWall = b => b.type === 'wall' || b.type === 'gate';
function blockerAt(x, y) {
  return buildings.find(b => b.done && isWall(b) && x > b.x - 6 && x < b.x + b.w + 6 && y > b.y - 6 && y < b.y + b.h + 6);
}

function updateRaider(r, dt) {
  const S = DEFENSE.sabine;
  // a Sabine fights any Roman soldier who comes close
  let foe = null, best = 46;
  soldiers.forEach(u => { const d = Math.hypot(u.x - r.x, u.y - r.y); if (d < best) { foe = u; best = d; } });
  r.fighting = !!foe;
  if (foe) { foe.hp -= S.dmgSoldier * dt; return; }

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
    b.hp -= S.dmgBuilding * dt;
    if (b.hp <= 0) { // a building falls: the fight goes on, and the loss is the player's to rebuild
      buildings.splice(buildings.indexOf(b), 1);
      puff(b.x + b.w / 2, b.y + b.h / 2, '#c4623a'); puff(b.x + b.w / 4, b.y + b.h / 2, '#c4623a'); puff(b.x + b.w * 0.75, b.y + b.h / 2, '#c4623a');
      r.hitting = null;
    }
  }
}

const townStands = () => buildings.some(b => b.done && (b.type === 'house' || b.type === 'forum'));

// ---- Each frame (the game calls this while no message is open) ----
function updateAttack(dt) {
  soldiers.forEach(s => updateSoldier(s, dt));
  for (let i = fx.length - 1; i >= 0; i--) { fx[i].t += dt; if (fx[i].t > 0.6) fx.splice(i, 1); }
  for (let i = soldiers.length - 1; i >= 0; i--) {
    if (soldiers[i].hp <= 0) { puff(soldiers[i].x, soldiers[i].y, '#2a6fb0'); soldiers.splice(i, 1); updateHud(); }
  }
  if (war.phase === 'prep') {
    war.clock -= dt; updateClock();
    if (war.clock <= 0) launchWave();
  } else if (war.phase === 'attack') {
    raiders.forEach(r => updateRaider(r, dt));
    for (let i = raiders.length - 1; i >= 0; i--) if (raiders[i].hp <= 0) { puff(raiders[i].x, raiders[i].y, '#6b2a5a'); raiders.splice(i, 1); }
    if (!townStands()) fallenTown();
    else if (!raiders.length) wonWave();
  }
}

// The whole town is gone: Romulus sighs, and the defense starts again from the checkpoint
function fallenTown() {
  raiders.length = 0;
  war.phase = 'fail';
  showMessage('msg_romulus_retry', 'neutral', () => {
    restoreCheckpoint();
    war.wave = 0;
    startPrep(DEFENSE.retryClock);
  });
}

// A wave is beaten. Another follows until the third; then the Sabines ask for peace.
function wonWave() {
  war.wave++;
  if (war.wave < DEFENSE.waves.length) { war.phase = 'between'; updateClock(); announceWave(); return; }
  war.phase = 'won'; updateClock();
  showMessage('msg_tatius_peace', 'neutral', () => showMessage('msg_romulus_peace', 'pleased', () =>
    showCards(['culture_sabine_women_end', 'culture_tatius', 'culture_kings', 'culture_story_history'], endMission)), 'tatius');
}

// ---- History cards: shown at set moments in the mission and after the battle ----
// Each card is a Latin heading with an English paragraph. A card pauses the game until it is dismissed.
let cardPages = [], cardAt = 0, cardAfter = null;
const WAR_CARDS = ['culture_why_war', 'culture_sabine_women']; // the cards about the conflict get a red tone

// A few embers drift up the screen behind the card
function makeEmbers() {
  const box = document.getElementById('embers');
  if (box.children.length) return;
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('span');
    s.style.left = Math.random() * 100 + '%';
    s.style.setProperty('--drift', (Math.random() * 120 - 60) + 'px');
    s.style.animationDuration = (7 + Math.random() * 9) + 's';
    s.style.animationDelay = (-Math.random() * 14) + 's';
    s.style.width = s.style.height = (2 + Math.random() * 3) + 'px';
    box.appendChild(s);
  }
}

function showCards(ids, after) {
  cardPages = ids.map(id => { const l = line(id); return l && Object.assign(l, { war: WAR_CARDS.includes(id) }); }).filter(Boolean); // unapproved cards are simply skipped
  cardAt = 0; cardAfter = after || null;
  if (!cardPages.length) { if (after) after(); return; }
  cardOpen = true;
  const card = document.getElementById('card');
  card.style.display = 'flex';
  card.style.animation = 'none'; void card.offsetWidth; card.style.animation = ''; // replay the fade-in and the bars
  card.querySelectorAll('.bar').forEach(b => { b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; });
  makeEmbers();
  renderCardPage();
}

function renderCardPage() {
  const p = cardPages[cardAt];
  document.getElementById('cardlatin').textContent = p.text;
  document.getElementById('cardenglish').textContent = p.english;
  const dots = document.getElementById('cardpage');
  dots.textContent = '';
  if (cardPages.length > 1) cardPages.forEach((_, i) => { const d = document.createElement('i'); if (i === cardAt) d.className = 'on'; dots.appendChild(d); });
  document.getElementById('card').classList.toggle('war', !!p.war);
  document.getElementById('cardok').textContent = cardAt + 1 < cardPages.length ? 'Next' : 'Continue';
  document.getElementById('cardenglish').scrollTop = 0;
  const box = document.getElementById('cardbox'); // replay the entrance for every page
  box.classList.remove('turn'); void box.offsetWidth; box.classList.add('turn');
  document.getElementById('cardok').focus();
}

function nextCardPage() {
  if (!cardOpen) return;
  if (++cardAt < cardPages.length) { renderCardPage(); return; }
  cardOpen = false;
  document.getElementById('card').style.display = 'none';
  const after = cardAfter; cardAfter = null;
  if (after) after();
}
document.getElementById('cardok').addEventListener('click', nextCardPage);

// After the last card the closing check begins (quiz.js).
function endMission() { war.phase = 'over'; startQuiz(); }

// ---- Drawing ----
function drawForest() {
  for (let r = 0; r < FOREST_H / TILE; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * TILE, y = r * TILE;
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
  if (s.hp < s.maxHp) { // health bar once hurt
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x - 8, y - 23, 16, 3);
    ctx.fillStyle = '#4caf50'; ctx.fillRect(x - 8, y - 23, 16 * Math.max(0, s.hp) / s.maxHp, 3);
  }
}

function drawRaider(r) {
  const x = sx(r.x), y = sy(r.y);
  ctx.fillStyle = '#6b2a5a'; ctx.fillRect(x - 6, y - 4, 12, 14);   // purple tunic
  ctx.fillStyle = '#e8c9a0'; ctx.fillRect(x - 5, y - 12, 10, 8);
  ctx.fillStyle = '#2a1c08'; ctx.fillRect(x - 5, y - 13, 10, 3);   // dark hair
  ctx.fillStyle = '#6b4a1e'; ctx.fillRect(x + 8, y - 14, 2, 24);   // spear
  ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x - 8, y - 20, 16, 3);   // health bar
  ctx.fillStyle = '#c0392b'; ctx.fillRect(x - 8, y - 20, 16 * Math.max(0, r.hp) / r.maxHp, 3);
  if (r.fighting) { ctx.fillStyle = '#f3e6c4'; ctx.fillRect(x - 12, y - 8 + (Math.floor(performance.now() / 120) % 2) * 5, 3, 10); }
}

// Red markers where the next wave will arrive (in Latin mode only for the first wave: after that, the scout's words are the clue),
// puffs where someone fell, and damage on buildings under attack
function drawAttackOverlay() {
  if (war.phase === 'prep' && (LANG === 'en' || war.wave === 0)) {
    const w = DEFENSE.waves[war.wave];
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 250);
    ctx.fillStyle = 'rgba(179,38,30,' + (0.4 + 0.5 * pulse) + ')';
    spawnPoints(w.from, w.n).forEach(p => {
      let x = sx(p.x), y = sy(p.y);
      if (p.dir === 's') y = sy(FOREST_H + 8);
      ctx.beginPath();
      if (p.dir === 's') { ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y); ctx.lineTo(x, y + 16); }
      else if (p.dir === 'e') { x += 30; ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 10); ctx.lineTo(x + 16, y); }
      else { x -= 30; ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 10); ctx.lineTo(x - 16, y); }
      ctx.fill();
    });
  }
  fx.forEach(f => {
    ctx.globalAlpha = Math.max(0, 1 - f.t / 0.6); ctx.fillStyle = f.color;
    const r = 4 + f.t * 40;
    ctx.beginPath(); ctx.arc(sx(f.x), sy(f.y), r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  });
  buildings.forEach(b => {
    if (b.hp === undefined || b.hp >= HP[b.type]) return;
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(sx(b.x), sy(b.y) - 6, b.w, 4);
    ctx.fillStyle = '#c0392b'; ctx.fillRect(sx(b.x), sy(b.y) - 6, b.w * Math.max(0, b.hp) / HP[b.type], 4);
  });
}

showTitle();
