// A play-through of the whole mission in a headless browser, in Latin mode and in English mode.
// It checks that every step still works after a change: the opening walk, gathering and building, three waves,
// training soldiers, the checkpoint after the town falls, the history cards and the closing check.
//
// To run it you need Node and Playwright with a Chromium browser:
//   PLAYWRIGHT_PATH=/path/to/node_modules/playwright CHROMIUM_PATH=/path/to/chromium node tests/smoke.js
// (PLAYWRIGHT_PATH and CHROMIUM_PATH are optional if both are installed in the usual places.)
// Add a mission name to test another one:  node tests/smoke.js rome
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const MISSION = process.argv[2] || 'rome';
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');

let failures = 0;
const check = (ok, what) => { console.log((ok ? '  ok    ' : '  FAIL  ') + what); if (!ok) failures++; };

async function playthrough(browser, lang) {
  console.log('\n== ' + MISSION + ' / ' + lang + ' ==');
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL + '?mission=' + MISSION + '&lang=' + lang);
  await page.waitForFunction(() => typeof startGame === 'function' && typeof beat !== 'undefined', null, { timeout: 15000 });

  const open = () => page.evaluate(() => cardOpen || boxOpen || quizOpen);
  const dismiss = async () => {                                  // click through every message and card that is open
    for (let i = 0; i < 40; i++) { await page.waitForTimeout(260); if (!(await open())) return; await page.keyboard.press('Enter'); }
  };
  const state = () => page.evaluate(() => ({ beat, phase: war.phase, wave: war.wave, raiders: raiders.length, soldiers: soldiers.length, farmers: farmers.length }));

  // The opening: walk to the river, then the hill
  await dismiss();
  check((await state()).beat === 1, 'opening: the first order is to walk to the river');
  await page.evaluate(() => { farmers.forEach(f => { f.x = RIVER.points[3][0] + 40; f.y = RIVER.points[3][1]; f.state = 'idle'; }); });
  await dismiss();
  check((await state()).beat === 2, 'opening: arriving at the river gives the next order');
  await page.evaluate(() => { farmers.forEach(f => { f.x = HILL.x; f.y = HILL.y; f.state = 'idle'; }); });
  await dismiss();
  check((await state()).beat === 3, 'opening: arriving on the hill gives the first gathering order');

  // Gather and build, one order at a time
  await page.evaluate(() => { stock.wood = 8; }); await dismiss();
  await page.evaluate(() => { stock.stone = 5; }); await dismiss();
  await page.evaluate(() => { buildings.push({ type: 'house', x: 700, y: 330, w: 64, h: 64, progress: 99, done: true }); onBuilt(buildings[buildings.length - 1]); }); await dismiss();
  check((await state()).farmers === 4, 'a finished house brings one more farmer');
  await page.evaluate(() => { for (let i = 0; i < 9; i++) buildings.push({ type: 'wall', x: 400 + i * 32, y: 200, w: 32, h: 32, progress: 99, done: true }); }); await dismiss();
  await page.evaluate(() => { buildings.push({ type: 'gate', x: 300, y: 260, w: 64, h: 32, progress: 99, done: true }); }); await dismiss();
  await page.evaluate(() => { const f = { type: 'forum', x: 520, y: 300, w: 128, h: 96, progress: 99, done: true }; buildings.push(f); onBuilt(f); }); await dismiss();
  check((await state()).farmers === 7, 'a finished forum brings three more farmers');
  await dismiss();
  check((await state()).phase === 'prep', 'the warning ends with the build clock running');
  check((await state()).soldiers === 4, 'four soldiers arrive with the warning');

  // Train soldiers, then fight three waves
  await page.evaluate(() => { stock.stone = 9; });
  await page.evaluate(() => { COMMANDS.find(c => c.id === MISSION.defense.commands.make.cmd).orders[0].run(); });
  check((await state()).soldiers === 7, 'making soldiers turns stone into soldiers');
  for (let w = 0; w < 3; w++) {
    await page.evaluate(() => { war.clock = 0.05; }); await page.waitForTimeout(500);
    check((await state()).phase === 'attack' && (await state()).raiders > 0, 'wave ' + (w + 1) + ' arrives');
    if (w === 1) { // the whole town falls: the defense starts over from the checkpoint
      await page.evaluate(() => { for (let i = buildings.length - 1; i >= 0; i--) if (['house', 'forum'].includes(buildings[i].type)) buildings.splice(i, 1); });
      await page.waitForTimeout(500); await dismiss();
      const s = await state();
      check(s.phase === 'prep' && s.wave === 0 && s.soldiers === 4, 'when the whole town falls, the defense restarts from the checkpoint');
      w = -1; await page.evaluate(() => { war.clock = 0.05; }); await page.waitForTimeout(500);
      await page.evaluate(() => { raiders.forEach(r => r.hp = 0); }); await page.waitForTimeout(400); await dismiss();
      await page.evaluate(() => { war.clock = 0.05; }); await page.waitForTimeout(500);
      await page.evaluate(() => { raiders.forEach(r => r.hp = 0); }); await page.waitForTimeout(400); await dismiss();
      await page.evaluate(() => { war.clock = 0.05; }); await page.waitForTimeout(500);
      await page.evaluate(() => { raiders.forEach(r => r.hp = 0); }); await page.waitForTimeout(400);
      break;
    }
    await page.evaluate(() => { raiders.forEach(r => r.hp = 0); }); await page.waitForTimeout(400); await dismiss();
  }
  await dismiss();
  check(await page.evaluate(() => quizOpen), 'after the third wave and the history cards, the closing check opens');

  // The closing check
  const n = await page.evaluate(() => quizItems.length);
  check(n === 5, 'the closing check has five questions (found ' + n + ')');
  for (let i = 0; i < n; i++) await page.keyboard.press('1');
  await page.waitForTimeout(400);
  check(/\d \/ 5/.test(await page.textContent('#quizscore')), 'the closing check ends with a score');
  check(errors.length === 0, 'no errors in the page' + (errors.length ? ': ' + errors[0] : ''));
  await page.close();
}

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const lang of ['la', 'en']) await playthrough(browser, lang);
  await browser.close();
  console.log(failures ? '\n' + failures + ' check(s) failed' : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})();
