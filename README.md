# Condenda Rōma

A small browser strategy game that teaches students about the founding of Rome. Latin students read their orders in Latin; history and social studies classes play the same game in English. There is no install, no login, and nothing about students is stored or sent anywhere.

## Play it

Open `index.html` in Chrome (double-click it). Choose **Play with Latin** or **Play in English**.

Handy addresses (add them after `index.html`):

| Address ending | What it does |
|---|---|
| `?lang=la` or `?lang=en` | skips the title screen and plays in that mode (good for links you hand to a class) |
| `?drafts=1` | also shows lines that have not been proofread yet, marked `[draft]` |
| `?debug=1` | shows a test panel for jumping around the mission |
| `?mission=name` | plays `missions/name/` instead of the Rome mission |

## What is where

```
index.html                      the page; loads engine/boot.js
engine/                         the game engine (knows nothing about Rome)
  core.js                         map, farmers, gathering, building, messages, the steps of a mission
  defense.js                      waves of attackers, soldiers, training, the checkpoint, history cards
  quiz.js                         the closing check
  debug.js                        the ?debug=1 panel
  style.css, boot.js
missions/rome/                  everything specific to Mission 1
  mission.js                      the map, the economy, the order of Romulus's orders, the three waves
  content/latin.yaml              every line of text, with its review status. Edit this one.
  content/latin.js                built from latin.yaml (do not edit)
  assets/portraits/               portrait_<speaker>_<neutral|pleased|alarmed>.png
tools/                          small scripts (Python 3 with PyYAML)
tests/smoke.js                  plays the whole mission in a headless browser
docs/MAKING-A-MISSION.md        how to make a new mission
latin1-spec (2).yaml            the course spec the content is tagged against
condenda-roma-design.md         the plan
```

## Everyday jobs

- **Proofread new lines.** `python3 tools/export_review.py` writes `review/<mission>-to-proofread.csv`. Mark it up, then tell Claude which ids to approve.
- **After editing `latin.yaml`:** `python3 tools/build_content.py` (rebuilds `latin.js`).
- **What does a mission practice?** `python3 tools/coverage.py` (add `--unit 1` to look at one unit).
- **Check nothing broke:** `node tests/smoke.js` (needs Node and Playwright; see the top of the file).
- **A new mission:** read `docs/MAKING-A-MISSION.md`.
