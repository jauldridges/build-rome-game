// Mission 1: Condenda Roma (753 BCE). Everything that makes this mission THIS mission lives here:
// the map, the resources, the buildings, the order of Romulus's orders, and the three waves of the Sabine attack.
// The engine (engine/core.js, engine/defense.js, engine/quiz.js) reads this file and knows nothing about Rome.
// It holds no Latin: it names entries in content/latin.yaml by their ids.
//
// To make another mission, copy this folder, change this file, and write a new content/latin.yaml (see docs/MAKING-A-MISSION.md).
const MISSION = {
  id: 'rome',
  titleEntry: 'ui_title',

  // ---- The world: 1280 x 800, always shown whole on one screen ----
  world: { tile: 32, cols: 40, rows: 25, forestH: 96 },   // forestH: the forest band along the north edge
  terrain: {
    river: { half: 30, bank: 40, points: [[150, 96], [175, 220], [155, 360], [178, 500], [160, 640], [185, 740], [165, 800]] },
    hill: { x: 520, y: 380, rx: 190, ry: 120 },
  },
  // Places the player can walk to on Romulus's orders. 'order' is the entry shown when the mouse hovers over the place.
  places: { river: { order: 'order_ambula_ad_flumen' }, hill: { order: 'order_ambula_ad_montem' } },

  // ---- Who speaks ----
  // name: the entry with the speaker's name. color: the flat silhouette shown until the portrait files are supplied.
  // Portrait files are assets/portraits/portrait_<speaker>_<neutral|pleased|alarmed>.png in this folder.
  speakers: {
    romulus: { name: 'name_romulus', color: '#5b3a1a' },
    scout: { name: 'name_scout', color: '#2d4a5a' },
    tatius: { name: 'name_tatius', color: '#4a2d5a' },
    remus: { name: 'name_remus', color: '#3f7a3f' },
  },

  // ---- Economy ----
  // word: the entry shown on the counter. order: the entry for "gather this". gatherTime: seconds per item.
  resources: {
    wood:  { word: 'vocab_lignum', order: 'order_collige_lignum',  color: '#2f5a2a', gatherTime: 0.8 },
    stone: { word: 'vocab_lapis',  order: 'order_collige_lapidem', color: '#9a958a', gatherTime: 1.1 },
  },
  carryMax: 5,
  store: { x: 470, y: 530, w: 56, h: 48 },                 // where gathered goods are dropped off
  nodes: [                                                  // trees to the south-east of the storehouse, rocks to the south-west
    { type: 'wood', amount: 60, at: [[620, 580], [665, 605], [710, 570], [650, 645], [720, 625], [690, 535]] },
    { type: 'stone', amount: 80, at: [[345, 600], [385, 640], [360, 670], [430, 590]] },
  ],
  // w and h are in tiles. work: farmer-seconds to build. art: which drawing the engine uses.
  buildings: {
    house: { order: 'order_aedifica_casam',  art: 'house', w: 2, h: 2, cost: { wood: 8 },            work: 6 },
    wall:  { order: 'order_aedifica_murum',  art: 'wall',  w: 1, h: 1, cost: { stone: 2 },           work: 2 },
    gate:  { order: 'order_aedifica_portam', art: 'gate',  w: 2, h: 1, cost: { wood: 4, stone: 2 },  work: 3 },
    forum: { order: 'order_aedifica_forum',  art: 'forum', w: 4, h: 3, cost: { stone: 12, wood: 8 }, work: 12 },
  },
  // Farmers start in the bottom right. A finished house or forum brings new ones, announced by a popup.
  farmers: {
    start: [[1090, 700], [1138, 734], [1186, 700]],
    arrivals: { house: { n: 1, say: 'msg_farmer_arrives' }, forum: { n: 3, say: 'msg_farmers_arrive' } },
  },

  // The words shown when the mouse hovers over a farmer or a soldier
  words: { farmer: 'vocab_agricola', soldier: 'vocab_miles' },

  // ---- Titles: the player's rank rises with the city. 'when' is checked all the time; the highest one that is true shows. ----
  ranks: [
    { entry: 'rank_colonus', when: () => true },
    { entry: 'rank_aedificator', when: () => isBuilt('wall', 4) },
    { entry: 'rank_defensor', when: () => war.wave >= 1 || war.phase === 'won' || war.phase === 'over' },
    { entry: 'rank_aedilis', when: () => war.phase === 'won' || war.phase === 'over' },
  ],

  // ---- Cameos: someone walks across the map. 'path' returns the points to walk through; {jump: true} leaps to that point. ----
  cameos: {
    remus: { color: '#3f7a3f', speed: 80, path: () => { // comes up to the middle of the wall, hops over it, and strolls off
      const walls = buildings.filter(b => b.type === 'wall' && b.done).sort((a, b) => a.x - b.x);
      const w = walls[Math.floor(walls.length / 2)] || { x: 400, y: 200, w: 32, h: 32 };
      const cx = w.x + w.w / 2;
      return [{ x: Math.max(10, cx - 220), y: w.y + 90 }, { x: cx - 30, y: w.y + 48 }, { x: cx, y: w.y - 26, jump: true }, { x: cx + 160, y: w.y - 50 }, { x: MAP_W + 20, y: w.y - 50 }];
    } },
  },

  // ---- The command menu ----
  // The menu is built from these entries. The defense adds Defende, Fer and Fac when the warning comes (see 'defense').
  commands: { gather: 'cmd_collige', build: 'cmd_aedifica', replay: 'cmd_relege', walk: 'cmd_ambula' },
  mistake: { msg: 'msg_romulus_relege', face: 'neutral' },   // Romulus sighs when you work on the wrong thing

  // ---- The opening orders: one at a time, each waits for the player to do it ----
  // say: the entry shown. face: Romulus's portrait. expects: the work order that is right now ([] means none is).
  // allow: 'gather' means gathering is never a mistake here. pre: history cards before the step.
  // walk: the place Romulus is sending you to (the mouse shows its order while you hover over it).
  // done: true when the step is finished. run: starts something instead of showing a message.
  beats: [
    { say: 'msg_romulus_intro', face: 'pleased', pre: ['culture_romulus_remus'], expects: null, done: () => true },
    { say: 'order_ambula_ad_flumen', face: 'neutral', expects: [], walk: 'river', scroll: [{ card: 'culture_hills', at: [250, 330] }], done: () => farmersAt('river') >= 3 },
    { say: 'msg_romulus_hill', face: 'pleased', expects: [], walk: 'hill', done: () => farmersAt('hill') >= 3 },
    { say: 'order_collige_lignum', face: 'neutral', expects: ['order_collige_lignum'], done: () => stock.wood >= 8 },
    { say: 'msg_romulus_stone', face: 'pleased', expects: ['order_collige_lapidem'], done: () => stock.stone >= 5 },
    { say: 'msg_romulus_house', face: 'pleased', expects: ['order_aedifica_casam'], allow: 'gather', done: () => isBuilt('house') },
    { say: 'msg_romulus_done', face: 'pleased', expects: null, scroll: [{ card: 'culture_asylum', at: () => { const h = lastBuilt('house'); return h ? [h.x + h.w / 2, h.y + h.h + 26] : [HILL.x, HILL.y + 60]; } }], done: () => true },
    { say: 'msg_romulus_wall', face: 'pleased', expects: ['order_aedifica_murum'], allow: 'gather', done: () => isBuilt('wall', 4),
      scroll: [{ card: 'culture_pomerium', at: () => { const w = lastBuilt('wall'); return w ? [w.x + w.w / 2, w.y + w.h + 26] : [HILL.x, HILL.y]; } }],
      after: [ // Remus mocks the wall, jumps over it, and wanders off (the legend, played)
        { msg: 'msg_remus_wall', speaker: 'remus', face: 'pleased' }, { cameo: 'remus' },
        { msg: 'msg_romulus_remus', face: 'alarmed' }, { msg: 'msg_romulus_remus_gone', face: 'neutral' },
      ] },
    { say: 'msg_romulus_gate', face: 'pleased', expects: ['order_aedifica_portam'], allow: 'gather', done: () => isBuilt('gate') },
    { say: 'msg_romulus_forum', face: 'pleased', expects: ['order_aedifica_forum'], allow: 'gather', done: () => isBuilt('forum'),
      scroll: [{ card: 'culture_senate', at: () => { const f = lastBuilt('forum'); return f ? [f.x + f.w / 2, f.y + f.h + 30] : [HILL.x, HILL.y]; } }] },
    { say: 'msg_romulus_final', face: 'pleased', expects: null, scroll: [{ card: 'culture_sabines', at: () => [MAP_W / 2, FOREST_H + 30] }], done: () => true },
    { run: 'defense', expects: null, done: null },                      // the warning, three waves and the ending
  ],

  // ---- The Sabine attack ----
  defense: {
    // from: north, west, east or south. clock: seconds of build time before the wave arrives.
    // say / speaker: the scout's announcement (the first wave is announced by 'warning' below).
    // In Latin mode the direction and the number are in the announcement alone; red arrows show only for the first wave
    // (and always in English mode).
    waves: [
      { n: 4, from: 'north', clock: 10 },
      { n: 6, from: 'west',  clock: 25, say: 'msg_scout_wave2', speaker: 'scout' },
      { n: 8, from: 'east',  clock: 25, say: 'msg_scout_wave3', speaker: 'scout' },
    ],
    retryClock: 20,                                            // build time after the whole town falls and the defense restarts
    soldier: { hp: 20, dmg: 3, speed: 105, start: 4, cost: 3 },    // cost: stones for one more soldier
    enemy: { hp: 12, speed: 52, dmgSoldier: 2, dmgBuilding: 0.7 },
    hp: { wall: 10, gate: 14, house: 14, forum: 30 },          // how much a building can take
    // Commands added when the warning comes. 'cmd' is the menu verb, 'order' the full order.
    commands: {
      defend: { cmd: 'cmd_defende', order: 'order_defende_murum' },
      carry: { cmd: 'cmd_fer', order: 'order_fer_lapides_ad_forum' },   // farmers carry stone to the forum, which makes soldiers
      make: { cmd: 'cmd_fac', order: 'order_fac_milites' },             // turn stone from the storehouse into soldiers
    },
    // What happens at the warning, in order: messages (speaker, face) and history cards. The build clock starts at the end.
    warning: [
      { msg: 'msg_scout_warning', speaker: 'scout', face: 'alarmed' },
      { cards: ['culture_why_war', 'culture_sabine_women'] },
      { msg: 'msg_romulus_hurry', face: 'alarmed' },
      { msg: 'msg_romulus_soldiers', face: 'neutral' },
    ],
    trainHint: { afterWave: 1, msg: 'msg_romulus_train', face: 'neutral' },   // Romulus explains training once, before the second wave
    fallen: { msg: 'msg_romulus_retry', face: 'neutral' },                   // the whole town is gone: restart from the checkpoint
    victory: [
      { msg: 'msg_tatius_peace', speaker: 'tatius', face: 'neutral' },
      { msg: 'msg_romulus_peace', face: 'pleased' },
      { cards: ['culture_sabine_women_end', 'culture_tatius', 'culture_kings', 'culture_story_history'] },
    ],
    warCards: ['culture_why_war', 'culture_sabine_women'],     // history cards about the conflict get a red tone
  },
};
