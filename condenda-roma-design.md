# Condenda Rōma — Design File

A browser strategy game in the style of Age of Empires. Students learn Latin by playing: the Latin is the controls, and Roman history and culture arrive through the missions. Mission 1 is the founding of Rome and the Sabine attack.

## Project constraints

- Runs in a web browser on a school Chromebook. No installs. Shareable by link.
- Built as a simple static site, hosted separately from the Latin I practice app.
- No student logins and no stored student data in this phase.
- 2D, 8-bit pixel world with anime-style character portraits (see Look).
- Every Latin string lives in one separate content file (`content/latin.yaml`). The game code never contains Latin text directly.
- Every Latin line carries a `review_status` of `draft` or `approved`. Student-facing builds show only `approved` lines. A test build may show drafts, marked visibly.

## Audience and scope

- Latin I students at the beginner level, mixed prior exposure.
- Content for every level of the game is drawn from morphosyntax, vocabulary, and culture that could appear on the National Latin Exam, Latin I.
- Mission 1 length: 15–20 minutes.

## Mission 1: Condenda Rōma (753 BCE)

**Premise.** Rōmulus has chosen the Palatine Hill. The player is his foreman and must build a settlement before the Sabīnī arrive.

**Goal.** Build a wall (*mūrus*), a gate (*porta*), and a forum, and have 8 farmers (*agricolae*) at work when the Sabines attack.

**Units and buildings (5).** *agricola*, *mīles*, *casa*, *mūrus*, *forum*. The gate (*porta*) is part of the wall.

**Resources (3).** *lignum*, *lapis*, *aqua*. Grain (*frumentum*) is produced by farmers at the fields.

**Commands.** *Collige* (gather), *Aedificā* (build), *Ambulā* (move), *Dēfende* (defend), *Relege* (replay the last order).

**Flow.**

1. Learning by doing (0–5 min). Rōmulus gives one command at a time: gather *lignum*, then *lapis*, then build a *casa*. Each new word is taught by acting on it.
2. Growth (5–12 min). Orders lengthen. Example: *Mitte quattuor agricolās ad aquam.* Players meet *ad* + accusative, numbers, and plural endings.
3. The warning (12–15 min). The scout reports: *Hostēs ex silvā veniunt!* Players who read it quickly wall the north side. Others are surprised and learn why reading matters.
4. Defense (15–18 min). The Sabines attack. *Mīlitēs* defend the wall.
5. Ending. A short card tells the legend of Rōmulus and Remus, explains the *pōmērium*, and covers the Sabine women and the merging of the two peoples under Titus Tatius and Rōmulus.

**Failure is soft.** A failed defense costs a building, not the mission. Rōmulus is annoyed, the player rebuilds, and the Sabines try again.

**Closing check.** Five reading questions with no hints, shown after the ending card.

## Pace

The game waits for the reader and rushes them only once.

- Each order from Rōmulus opens in a message box and stops the clock until dismissed.
- *Relege* replays the order. A side panel keeps the last three orders on screen.
- Minutes 0–12 are calm: act, see the result, receive the next order.
- At the warning the clock starts. The scout's message is short and the player has about 90 seconds to wall the north side.
- There are no dead ends for beginners.

## Core fun

The pleasure is watching a city grow because you understood a sentence.

- Loop: read the order, act on it, see the map change, receive the next order.
- Every order visibly changes the map: a *casa* rises, a wall closes a gap, farmers fill a field.
- A misread is funny, not punishing. Sending farmers *ad silvam* instead of *ad aquam* sends them into the forest while Rōmulus sighs. The player sees at once which word was missed.
- Progress shows through rank. The player's title rises with the city, from *colōnus* toward *aedīlis*.

## Look

Chunky 8-bit world, detailed anime portraits for the people.

- Map: small pixel sprites, limited palette of terracotta, travertine, olive, and deep sky blue.
- When someone speaks, a large anime-style portrait appears beside the message, in the manner of classic tactics games.
- Three speakers: Rōmulus, the scout, and Titus Tatius. Each has three expressions: neutral, pleased, alarmed.
- Portraits are individual image files named `portrait_<speaker>_<expression>.png`. The game must run with placeholder portraits (flat color silhouette with the speaker's name) until final art is supplied.
- Menus: bronze and parchment. Latin text in one large, clear font that renders macrons correctly.
- Music: chiptune. Distinct sounds for gathering, building, and the alarm.
- Pixel art from free asset packs at first, polished later.

## Tone

Rōmulus is a tired foreman who happens to be a king.

- Short, dry sentences. This keeps the Latin simple. His English hints sound like a man who has explained this before.
- Humor comes from character, for example Rōmulus on Remus ("Remus is, as always, somewhere else") and on farmers.
- Culture arrives as one-line asides during play (why the forum comes first) and in full on the ending card.
- The Sabines are respected opponents. Titus Tatius is dignified, which sets up the ending where the two peoples merge.

## Latin content rules

- Macrons are shown on all on-screen Latin.
- When checking typed answers, macrons are ignored unless an item is flagged `macron_matters: true`.
- English hints: the first appearance of a word shows an English hover. The second appearance is Latin only. The hover returns after an error.
- Word forms in orders must be forms students can parse at the Latin I level, or be glossed on first appearance.
- Mission 1 target: about 25 vocabulary words, 5 commands, and 3 patterns (imperatives, *ad* + accusative, plural nouns).

### Latin content file structure

Each entry in `content/latin.yaml` has:

- `id`: permanent, never reused
- `latin`: the text, with macrons
- `english`: translation or hint
- `type`: `vocab`, `order`, `message`, `culture_note`, `quiz_item`, or `ui_label`
- `nle_category`: `morphosyntax`, `vocabulary`, or `culture`
- `spec_node_id`: the node ID from `latin1-spec.yaml` that the item practices
- `review_status`: `draft` or `approved`

## NLE tagging and connection to the practice app

- Every word, pattern, order, message, culture note, and quiz item is tagged with `nle_category` and `spec_node_id`.
- `spec_node_id` values come from the course spec (`latin1-spec.yaml`). Items with no matching node are marked `unmapped` and listed for review.
- Later levels are built by selecting items by tag.
- Planned connection: the game will eventually send word-level results to the Latin I practice app using the same node IDs. In this phase nothing is sent and nothing is stored about students.

## Build order

Play-test after each step.

1. Scrollable map with a few farmers that can be clicked and moved.
2. Gathering *lignum*, *lapis*, *aqua*.
3. Building a *casa*, then the *mūrus*, *porta*, and *forum*.
4. Latin commands replace the buttons.
5. Rōmulus's messages with portraits and fading English hints.
6. The Sabine attack and the ending card.
7. The five-question closing check.

A small group of students plays after step 4.

## Review rule

All Latin and all culture content is drafted, then proofread line by line before any line is marked `approved`. Nothing reaches students unapproved.
