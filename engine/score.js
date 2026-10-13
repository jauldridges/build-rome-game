// Points. A student earns them for building, for reading (a scroll, and a right answer after each history card), for beating
// a wave and for the closing check; a speed bonus is added at the end. The numbers come from M.score in the mission file.
// Nothing is stored or sent anywhere: the score lives on the screen and is gone when the page closes.

const SC = M.score || null;
const score = { total: 0, parts: { build: 0, read: 0, battle: 0, check: 0 }, seconds: 0 };

function addPoints(kind, n, x, y) {
  if (!SC || !n) return;
  score.parts[kind] += n; score.total += n;
  if (x !== undefined) floater(x, y, '+' + n, '#ffd54a');
  renderScore(true);
}

function renderScore(pop) {
  const el = document.getElementById('score');
  if (!el || !SC) return;
  el.textContent = '★ ' + score.total;
  if (pop) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
}

function scoreTick(dt) { score.seconds += dt; }      // counts only time spent playing, not time spent reading

// The sooner the story is finished, the bigger the bonus; none at all after timePar seconds of play
function timeBonus() {
  if (!SC) return 0;
  return Math.round(Math.max(0, 1 - score.seconds / SC.timePar) * SC.timeMax / 10) * 10;
}
function finalScore() { return score.total + timeBonus(); }
