# Making a new mission

A mission is a folder in `missions/`. The engine in `engine/` plays any mission folder it is pointed at, so a new game (say, the Punic Wars or the voyage of Aeneas) is mostly new content and a new `mission.js`.

## 1. Start from Rome

Copy `missions/rome/` to `missions/<newname>/`. Open the game with `index.html?mission=<newname>`.

## 2. The three files you change

**`content/latin.yaml`** is every line of text in the game: orders, messages, names, history cards, the closing check. Nothing in the code contains a word of Latin or English game text. Each entry looks like this:

```yaml
- id: msg_romulus_wall            # permanent; never reuse an id
  latin: "Bene! Aedificā mūrum!"  # shown in Latin mode, with macrons
  english: "Good! Build a wall!"  # a plain translation: the English hint in Latin mode, the text in English mode
  en: "Good. A wall. It keeps trouble out. In theory."   # optional: a funnier English-mode wording
  en_status: approved             # draft or approved; English mode uses `en` only once approved
  type: message                   # vocab | order | message | culture_note | quiz_item | ui_label
  nle_category: morphosyntax      # morphosyntax | vocabulary | culture
  spec_node_id: MS-050            # the node in latin1-spec.yaml; add "# also MS-023" for others; unmapped if none
  review_status: draft            # draft or approved; students see only approved lines
```

- A **history card** (`culture_note`) puts its heading in `latin` (and `en_title` for English mode) and its paragraph in `english`.
- A **closing-check question** (`quiz_item`) adds `question`, `choices` (shuffled by the game) and `answer` (the index of the right choice). Latin-mode questions have a Latin passage in `latin`. English-mode questions add `track: en` and leave `latin` empty; their `english` explains the answer.
- After editing, run `python3 tools/build_content.py`.

**`mission.js`** describes the mission without any text: the map size, the river and hill, where the nodes and the store are, the resources and buildings (with costs and the ids of their orders), who starts where, the speakers, the steps of the opening, and the waves of the defense. Every field has a comment in `missions/rome/mission.js`. Steps and waves name entries by id.

**`assets/portraits/`** holds `portrait_<speaker>_<neutral|pleased|alarmed>.png`. Without them the game shows a flat silhouette with the speaker's name.

## 3. The rules every mission follows

1. **All text is content.** If a word appears on screen, it is an entry in `latin.yaml` with a review status. Menu chrome ("Continue", "Next") is the only text in the engine.
2. **Nothing reaches students unapproved.** Draft and approved lines are the whole review process. `python3 tools/export_review.py` lists what is left to proofread.
3. **Two modes from the start.** Every entry has a plain `english`, so English mode works at once. Add `en` and `en_title` for the funnier wording. In Latin mode the key information (where a wave comes from, how many there are) appears in the Latin alone; English mode adds arrows and plain words. Do not give Latin-mode players the answer anywhere except in the Latin.
4. **Tag every entry.** Use `spec_node_id` so `python3 tools/coverage.py` can show which spec nodes a mission practices and which are still open.
5. **One screen.** The world is scaled to fit the window; there is no scrolling. Keep the world about 1280 by 800.
6. **Soft failure.** Losing a building costs a building. Losing the whole town restarts the defense from the checkpoint. Nothing sends the student back to the beginning.

## 4. The tools a mission gets for free

These are all set up in `mission.js`; none needs engine code.
- **Optional scrolls.** A step may have `scroll: [{ card, at }]`. When the step is done, a glowing scroll appears at that spot on the map and the game goes on. The player clicks it to read the history card. Use `pre` or `after` for the cards every player must see.
- **Cameos.** `cameos` describe someone walking across the map (Remus, in the Rome mission), optionally leaping over something. A step's `after` list can start one with `{ cameo: 'name' }` between messages.
- **Ranks.** `ranks` is a list of `{ entry, when, reward }`. The player's title is the last one whose `when` is true. Each new rank brings a gift (`reward`: supplies and/or soldiers), shown in a golden banner. The bar shows the current rank, the next one, and progress. The last rank can require every scroll, so reading them matters.
- **Scroll rewards and the hunt.** `scrollReward` is the gift for every scroll read. If scrolls are still on the map when the defense is won, `defense.scrollsPrompt` has Romulus send the player to gather them before the `ending` cards.
- **The menu bar.** The commands, counters and rank sit in a bar along the bottom. The map is drawn above it, so it never hides anything.
- **Art.** `engine/art.js` draws every sprite in code, one art pixel at a time (people, buildings, trees, rocks, sheep and geese), then the ground, the animated river and the light. A building uses one of its drawings through the `art` field in `mission.js` (house, wall, gate or forum). A new kind of building or person needs a new drawing function there. A mission lists wandering animals in `ambient`.
- **Dusk.** The light warms and darkens as the waves go on, and windows and torches glow. Nothing to set up.
- **Sound.** `engine/sound.js` makes chiptune effects in the browser (no sound files). The menu box has buttons to turn effects and the optional music on and off. Two music themes live there: `peace` and `war`; a mission switches with `setMusicMode(...)` (the Sabine waves do this automatically).
- **Collision.** `engine/collision.js` makes every walker path around buildings, trees and rocks and keeps bodies apart. A finished gate is open to friends but solid to attackers.
- **Effects.** Floating numbers, puffs of dust, a pop when a building is finished and a screen shake when one falls are built in.

## 5. What needs engine changes

New *kinds* of things need code in `engine/`: a new building drawing (`drawShape` in `core.js`), a new unit type, or a mechanic that is not gathering, building, or waves of attackers. Anything that is a different number, place, order of steps or wording needs only the mission folder.

## 6. Checking your work

- `?debug=1` adds a panel for skipping steps, adding resources, calling a wave or losing the town.
- `?drafts=1` shows lines you have not approved yet.
- `node tests/smoke.js <newname>` plays the mission through (update the steps in `tests/smoke.js` if your mission's steps differ).
