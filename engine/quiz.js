// Step 7: the closing check. Five reading questions after the ending cards, with no hints.
// The passages and questions come from content/latin.js (entries of type quiz_item). Nothing is stored or sent anywhere.

let quizItems = [], quizAt = 0, quizResults = [], quizOpen = false, quizOrder = [];

function startQuiz() {
  // approved items only (drafts too when ?drafts=1), in the order of the content file
  // approved items only (drafts too when ?drafts=1); Latin mode and English mode have their own questions
  quizItems = LATIN.filter(e => e.type === 'quiz_item' && (e.track === 'en') === (LANG === 'en') && (e.review_status === 'approved' || SHOW_DRAFTS));
  quizAt = 0; quizResults = [];
  quizOpen = true;
  document.getElementById('quiz').style.display = 'flex';
  if (!quizItems.length) { showResults(); return; }   // no questions: straight to the score
  renderQuestion();
}

function shuffled(n) { // a random order for the answer choices
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function renderQuestion() {
  const item = quizItems[quizAt];
  const box = document.getElementById('quizbox');
  document.getElementById('quiztitle').textContent = 'Closing check';
  const dots = document.getElementById('quizdots');
  dots.textContent = '';
  quizItems.forEach((_, i) => { const d = document.createElement('i'); if (i < quizAt) d.className = 'done'; else if (i === quizAt) d.className = 'on'; dots.appendChild(d); });
  const mark = item.review_status === 'approved' ? '' : ' [draft]';
  document.getElementById('quizlatin').textContent = item.latin ? item.latin + mark : ''; // English-mode questions have no Latin passage
  document.getElementById('quizquestion').textContent = item.question + (item.latin ? '' : mark);
  const list = document.getElementById('quizchoices');
  list.textContent = '';
  quizOrder = shuffled(item.choices.length);
  quizOrder.forEach((ci, n) => {
    const b = document.createElement('button');
    b.textContent = (n + 1) + '.  ' + item.choices[ci];
    b.addEventListener('click', () => answerQuestion(ci));
    list.appendChild(b);
  });
  box.classList.remove('turn'); void box.offsetWidth; box.classList.add('turn');
  document.getElementById('quizresults').style.display = 'none';
  document.getElementById('quizquestionbox').style.display = 'block';
}

function answerQuestion(choice) {
  if (!quizOpen) return;
  const item = quizItems[quizAt];
  quizResults.push({ item, choice, right: choice === item.answer });
  if (choice === item.answer && SC) addPoints('check', SC.check);
  if (++quizAt < quizItems.length) renderQuestion(); else showResults();
}

function showResults() {
  const right = quizResults.filter(r => r.right).length;
  document.getElementById('quizquestionbox').style.display = 'none';
  document.getElementById('quiztitle').textContent = 'The End';
  const dots = document.getElementById('quizdots'); dots.textContent = '';
  document.getElementById('quizscore').textContent = right + ' / ' + quizResults.length;
  showFinale();
  const rankLine = M.ranks && rankNow >= 0 ? line(M.ranks[rankNow].entry) : null; // your title at the end of the story
  document.getElementById('quizscrolls').textContent = (rankLine ? '★ ' + rankLine.text + (scrollsTotal ? '   ·   ' : '') : '') + (scrollsTotal ? 'Scrolls read: ' + scrollsRead + ' of ' + scrollsTotal : '');
  const list = document.getElementById('quizreview');
  list.textContent = '';
  quizResults.forEach(r => { // the translation and the right answer are shown only now, after the check
    const row = document.createElement('div'); row.className = 'row ' + (r.right ? 'right' : 'wrong');
    const mark = document.createElement('span'); mark.className = 'mark'; mark.textContent = r.right ? '✓' : '✗';
    const text = document.createElement('div');
    const latin = document.createElement('div'); latin.className = 'rl'; latin.textContent = r.item.latin || r.item.question;
    const en = document.createElement('div'); en.className = 're'; en.textContent = r.item.english;
    text.appendChild(latin); text.appendChild(en);
    if (!r.right) {
      const ans = document.createElement('div'); ans.className = 'ra';
      ans.textContent = (r.item.latin ? r.item.question + ' ' : 'Answer: ') + r.item.choices[r.item.answer];
      text.appendChild(ans);
    }
    row.appendChild(mark); row.appendChild(text); list.appendChild(row);
  });
  document.getElementById('quizresults').style.display = 'block';
  const box = document.getElementById('quizbox'); box.classList.remove('turn'); void box.offsetWidth; box.classList.add('turn');
}

// ---- The finale: the score counts up, then the rank and the breakdown ----
function showFinale() {
  const fin = SC ? finalScore() : 0, won = SC && fin >= SC.goal;
  document.getElementById('finhead').textContent = won ? 'Congratulations!' : 'Nice try!';
  document.getElementById('finsub').textContent = won ? 'You built Rome, and it stands.' : 'Rome still stands. Think you can beat your score?';
  const rank = M.ranks && rankNow >= 0 ? line(M.ranks[rankNow].entry) : null;
  const r = document.getElementById('finrank');
  r.textContent = ''; r.title = rank ? rank.english : '';
  if (rank) { const t = document.createElement('div'); t.className = 'frl'; t.textContent = '★  ' + rank.text + '  ★'; r.appendChild(t); const e = document.createElement('div'); e.className = 'fre'; e.textContent = 'Your rank' + (rank.english ? ':  ' + rank.english : ''); r.appendChild(e); }
  const parts = document.getElementById('finparts');
  parts.textContent = '';
  const rows = [['Building', score.parts.build], ['Reading and questions', score.parts.read], ['Defending Rome', score.parts.battle], ['Final check', score.parts.check], ['Speed bonus', timeBonus()]];
  rows.forEach(([name, pts]) => { const row = document.createElement('div'); const a = document.createElement('span'), b = document.createElement('b'); a.textContent = name; b.textContent = pts; row.appendChild(a); row.appendChild(b); parts.appendChild(row); });
  document.getElementById('quizagain').textContent = won ? 'Play again' : 'Try again';
  document.getElementById('quizagain').style.display = ''; document.getElementById('finconfirm').style.display = 'none';
  // count up (or show at once if the student prefers less motion)
  const el = document.getElementById('finscore'), still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t0 = performance.now(), dur = still ? 0 : 1800;
  const step = now => {
    const u = dur ? Math.min(1, (now - t0) / dur) : 1;
    el.textContent = Math.round(fin * (1 - Math.pow(1 - u, 3)));
    if (u < 1) requestAnimationFrame(step); else sfx(won ? 'victory' : 'ping');
  };
  requestAnimationFrame(step);
}

// Play again asks first, so nobody wipes out their score by accident
document.getElementById('quizagain').addEventListener('click', () => {
  document.getElementById('quizagain').style.display = 'none';
  document.getElementById('finconfirm').style.display = 'block';
});
document.getElementById('finno').addEventListener('click', () => {
  document.getElementById('finconfirm').style.display = 'none';
  document.getElementById('quizagain').style.display = '';
});
document.getElementById('finyes').addEventListener('click', () => location.reload());
window.addEventListener('keydown', e => { // 1 to 4 choose an answer
  if (!quizOpen || document.getElementById('quizquestionbox').style.display === 'none') return;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= quizOrder.length) answerQuestion(quizOrder[n - 1]);
});
