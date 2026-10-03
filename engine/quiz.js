// Step 7: the closing check. Five reading questions after the ending cards, with no hints.
// The passages and questions come from content/latin.js (entries of type quiz_item). Nothing is stored or sent anywhere.

let quizItems = [], quizAt = 0, quizResults = [], quizOpen = false, quizOrder = [];

function startQuiz() {
  // approved items only (drafts too when ?drafts=1), in the order of the content file
  // approved items only (drafts too when ?drafts=1); Latin mode and English mode have their own questions
  quizItems = LATIN.filter(e => e.type === 'quiz_item' && (e.track === 'en') === (LANG === 'en') && (e.review_status === 'approved' || SHOW_DRAFTS));
  quizAt = 0; quizResults = [];
  if (!quizItems.length) return;
  quizOpen = true;
  document.getElementById('quiz').style.display = 'flex';
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
  if (++quizAt < quizItems.length) renderQuestion(); else showResults();
}

function showResults() {
  const right = quizResults.filter(r => r.right).length;
  document.getElementById('quizquestionbox').style.display = 'none';
  document.getElementById('quiztitle').textContent = 'Closing check';
  const dots = document.getElementById('quizdots'); dots.textContent = '';
  document.getElementById('quizscore').textContent = right + ' / ' + quizResults.length;
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

document.getElementById('quizagain').addEventListener('click', () => location.reload());
window.addEventListener('keydown', e => { // 1 to 4 choose an answer
  if (!quizOpen || document.getElementById('quizquestionbox').style.display === 'none') return;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= quizOrder.length) answerQuestion(quizOrder[n - 1]);
});
