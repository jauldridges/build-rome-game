// The test panel, shown only with ?debug=1 in the address. For people building and balancing a mission, never for students.
// It jumps around the mission so you can reach any moment in seconds.
(function () {
  const panel = document.createElement('div');
  panel.id = 'debugpanel';
  panel.style.cssText = 'position:fixed;left:50%;bottom:6px;transform:translateX(-50%);z-index:20;display:flex;flex-wrap:wrap;gap:4px;max-width:92vw;padding:6px 8px;background:rgba(0,0,0,0.78);border:1px solid #e0b14a;font:12px sans-serif;color:#f3e6c4';
  const add = (label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'font:12px sans-serif;padding:2px 6px;cursor:pointer';
    b.addEventListener('click', e => { e.stopPropagation(); b.blur(); fn(); });
    panel.appendChild(b);
  };
  const closeAll = () => { for (let i = 0; i < 20 && (cardOpen || boxOpen); i++) { if (cardOpen) nextCardPage(); else closeMessage(); } };

  const tag = document.createElement('span');
  tag.textContent = 'DEBUG';
  tag.style.cssText = 'color:#e0b14a;font-weight:bold;margin-right:4px';
  panel.appendChild(tag);

  add('Next step', () => { closeAll(); const b = BEATS[beat]; if (b && b.run) return; startBeat(beat + 1); });
  add('Close boxes', closeAll);
  add('+10 of each', () => { Object.keys(stock).forEach(k => { stock[k] += 10; }); updateHud(); });
  add('+3 farmers', () => { for (let i = 0; i < 3; i++) addFarmer(store.x + 30 + i * 20, store.y + 90); });
  add('+3 soldiers', () => { spawnSoldiers(3); });
  add('Wave now', () => { if (war.phase === 'prep') war.clock = 0.05; });
  add('Win wave', () => { raiders.forEach(r => { r.hp = 0; }); });
  add('Lose town', () => { for (let i = buildings.length - 1; i >= 0; i--) if (['house', 'forum'].includes(buildings[i].type)) buildings.splice(i, 1); });
  add('Closing check', () => { closeAll(); endMission(); });
  add('Speed x1', () => { window.TIMESCALE = 1; });
  add('x3', () => { window.TIMESCALE = 3; });
  document.body.appendChild(panel);
})();
