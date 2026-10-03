// Loads one mission and the engine, in order, then shows the title screen.
//   index.html                  plays the Rome mission
//   index.html?mission=name     plays missions/name/
// Add ?lang=en or ?lang=la to skip the title screen, ?drafts=1 to see unapproved lines, ?debug=1 for the test panel.
(function () {
  const params = new URLSearchParams(location.search);
  const name = (params.get('mission') || 'rome').replace(/[^a-zA-Z0-9_-]/g, '');
  const files = [
    'missions/' + name + '/content/latin.js',   // the mission's lines (built from latin.yaml by tools/build_content.py)
    'missions/' + name + '/mission.js',         // the mission's map, economy, steps and waves
    'engine/sound.js', 'engine/core.js', 'engine/quiz.js', 'engine/defense.js',
  ];
  if (params.has('debug')) files.push('engine/debug.js');

  const load = i => {
    if (i >= files.length) { showTitle(); return; }
    const s = document.createElement('script');
    s.src = files[i];
    s.onload = () => load(i + 1);
    s.onerror = () => { document.body.insertAdjacentHTML('beforeend', '<p style="position:fixed;top:20px;left:20px;color:#f3e6c4;font:18px sans-serif">Could not load ' + files[i] + '</p>'); };
    document.body.appendChild(s);
  };
  load(0);
})();
