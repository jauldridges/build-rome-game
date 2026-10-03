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

// A very quiet looping tune. Off until the player turns it on.
const TUNE = [ // [bass, lead] in Hz, one step each; a simple minor pattern
  [110, 440], [110, 523], [110, 659], [110, 523], [131, 523], [131, 659], [131, 784], [131, 659],
  [98, 392], [98, 494], [98, 587], [98, 494], [110, 440], [110, 523], [165, 659], [110, 523],
];
function startMusic() {
  if (musicTimer) return;
  let i = 0;
  musicTimer = setInterval(() => {
    if (!musicOn || !audio()) return;
    const [bass, lead] = TUNE[i++ % TUNE.length];
    tone(bass, 0.22, 'triangle', 0.035); tone(lead, 0.16, 'square', 0.012);
  }, 240);
}

function wireSoundButtons() {
  const mute = document.getElementById('mutebtn'), music = document.getElementById('musicbtn');
  if (!mute || !music) return;
  mute.addEventListener('click', () => { sfxMuted = !sfxMuted; mute.classList.toggle('off', sfxMuted); mute.blur(); });
  music.addEventListener('click', () => { musicOn = !musicOn; music.classList.toggle('on', musicOn); if (musicOn) startMusic(); music.blur(); });
  document.getElementById('panel').addEventListener('click', e => { if (e.target.tagName === 'BUTTON' && !e.target.closest('#tools')) sfx('click'); });
}
wireSoundButtons();
