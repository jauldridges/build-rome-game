// Chiptune sounds made in the browser (no sound files). sfx('name') plays an effect; the buttons in the menu box
// turn effects and music on and off. Sound only starts after the first click, as browsers require.
let sfxMuted = false, musicOn = false, audioCtx = null, musicTimer = null;
const lastSfx = {};

function audio() {
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; } }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// One short note: frequency, length in seconds, wave shape, loudness, delay, and an optional slide to another pitch
function tone(freq, dur, type, vol, delay, slideTo) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol, delay) {
  const a = audio(); if (!a) return;
  const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(), g = a.createGain(), t = a.currentTime + (delay || 0);
  s.buffer = buf; g.gain.value = vol || 0.06; s.connect(g); g.connect(a.destination); s.start(t);
}

const SFX = {
  click: () => tone(660, 0.05, 'square', 0.03),
  gather: () => tone(220 + Math.random() * 60, 0.06, 'triangle', 0.05),
  coin: () => { tone(880, 0.07, 'square', 0.04); tone(1320, 0.12, 'square', 0.04, 0.07); },
  place: () => { tone(110, 0.12, 'square', 0.06, 0, 70); noise(0.08, 0.04); },
  built: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'square', 0.05, i * 0.07)); },
  alarm: () => { for (let i = 0; i < 4; i++) { tone(660, 0.16, 'sawtooth', 0.05, i * 0.34); tone(495, 0.16, 'sawtooth', 0.05, i * 0.34 + 0.17); } },
  horn: () => { tone(196, 0.5, 'sawtooth', 0.06); tone(294, 0.5, 'sawtooth', 0.04, 0.0); },
  hit: () => noise(0.06, 0.05),
  enemyFall: () => tone(300, 0.18, 'square', 0.05, 0, 90),
  soldierFall: () => tone(200, 0.3, 'triangle', 0.06, 0, 60),
  crash: () => { noise(0.35, 0.09); tone(90, 0.3, 'sawtooth', 0.07, 0, 40); },
  recruit: () => { tone(392, 0.08, 'square', 0.05); tone(587, 0.14, 'square', 0.05, 0.08); },
  msg: () => tone(520, 0.06, 'triangle', 0.04),
  card: () => { tone(392, 0.2, 'triangle', 0.04); tone(523, 0.3, 'triangle', 0.04, 0.12); },
  ping: () => { tone(1568, 0.1, 'sine', 0.04); tone(2093, 0.18, 'sine', 0.03, 0.08); },
  page: () => { noise(0.1, 0.03); tone(880, 0.1, 'triangle', 0.03, 0.05); },
  rank: () => { [392, 494, 587, 784].forEach((f, i) => tone(f, 0.2, 'square', 0.05, i * 0.12)); },
  victory: () => { [523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'square', 0.05, i * 0.13)); },
  defeat: () => { [392, 349, 311, 262].forEach((f, i) => tone(f, 0.28, 'triangle', 0.06, i * 0.22)); },
  jump: () => tone(300, 0.25, 'square', 0.04, 0, 700),
};

function sfx(name) {
  if (sfxMuted || !SFX[name]) return;
  const now = performance.now();
  if (now - (lastSfx[name] || 0) < 60) return; // never the same sound twice in one frame burst
  lastSfx[name] = now;
  try { SFX[name](); } catch (e) { /* sound is a bonus: never let it break the game */ }
}

// ---- The theme: "Condenda Roma", about 25 seconds in D Dorian, looped. Off until the player turns it on. ----
// A melody that climbs like a wall going up, a bass that walks root and fifth, and a drum that marches.
// Notes: letter, octave. A dot holds the note for one more step. Two passes: the second adds a harmony a third above.
function hz(name) {
  const m = /^([A-G])(#?)(\d)$/.exec(name); if (!m) return 0;
  const semis = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0) + (parseInt(m[3], 10) - 4) * 12 - 9;
  return 440 * Math.pow(2, semis / 12);
}
const STEP = 0.2; // seconds per eighth note
function thirdAbove(name) { // the note two steps up the scale (a third, near enough), for the second pass
  const m = /^([A-G])(#?)(\d)$/.exec(name), order = 'CDEFGAB', i = order.indexOf(m[1]), j = (i + 2) % 7;
  return order[j] + m[2] + (parseInt(m[3], 10) + (i + 2 >= 7 ? 1 : 0));
}
const THEME = {
  melody: [ // eight bars of eight steps: part A (bars 1-4), part B (bars 5-8)
    'D4 . F4 A4 D5 . C5 A4', 'G4 . A4 B4 C5 . B4 A4', 'F4 . A4 C5 F5 . E5 C5', 'D5 . . . A4 . . .',
    'G4 . B4 D5 G5 . F5 D5', 'E5 . D5 C5 B4 . A4 G4', 'A4 . C5 E5 A5 . G5 E5', 'F5 . . . D5 . . .',
  ],
  bass: ['D', 'G', 'F', 'D', 'G', 'C', 'A', 'D'], // the root of each bar; the fifth alternates with it
};
const THEME_STEPS = [];
(function buildTheme() {
  for (let pass = 0; pass < 2; pass++) THEME.melody.forEach((bar, b) => {
    const toks = bar.split(' ');
    toks.forEach((t, i) => {
      let len = 1; while (toks[i + len] === '.') len++;
      const lead = t !== '.' ? t : null;
      const root = THEME.bass[b] + '3'; // laptop and Chromebook speakers cannot play very low notes, so the bass sits higher
      const fifth = { D: 'A3', G: 'D4', F: 'C4', C: 'G3', A: 'E4' }[THEME.bass[b]];
      THEME_STEPS.push({
        lead: lead, len: len, harmony: pass && lead ? thirdAbove(lead) : null,
        bass: i % 2 === 0 ? (i % 4 === 0 ? root : fifth) : null,
        kick: i % 4 === 0, snare: i % 4 === 2, hat: i % 2 === 1,
      });
    });
  });
})();

let themeAt = 0;
function playThemeStep() {
  if (!musicOn || !audio()) return;
  const s = THEME_STEPS[themeAt++ % THEME_STEPS.length], dur = STEP * s.len * 0.92;
  if (s.lead) tone(hz(s.lead), dur, 'square', 0.035);
  if (s.harmony) tone(hz(s.harmony), dur, 'triangle', 0.035);
  if (s.bass) tone(hz(s.bass), STEP * 1.8, 'triangle', 0.075);
  if (s.kick) { tone(200, 0.13, 'triangle', 0.09, 0, 70); noise(0.03, 0.03); }
  if (s.snare) noise(0.09, 0.05);
  if (s.hat) noise(0.025, 0.02);
}
function startMusic() {
  if (musicTimer) return;
  musicTimer = setInterval(playThemeStep, STEP * 1000);
}

function wireSoundButtons() {
  const mute = document.getElementById('mutebtn'), music = document.getElementById('musicbtn');
  if (!mute || !music) return;
  mute.addEventListener('click', () => { sfxMuted = !sfxMuted; mute.classList.toggle('off', sfxMuted); mute.blur(); });
  music.addEventListener('click', () => { setMusic(!musicOn); music.blur(); });
  document.getElementById('panel').addEventListener('click', e => { if (e.target.tagName === 'BUTTON' && !e.target.closest('#tools')) sfx('click'); });
}
wireSoundButtons();

// Music starts when play begins (the click on the title screen allows sound) and the button turns it off
function setMusic(on) {
  musicOn = on;
  const music = document.getElementById('musicbtn');
  if (music) music.classList.toggle('on', on);
  if (on) { audio(); startMusic(); }
}
