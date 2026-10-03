# Portraits for the other speakers

Rōmulus has three painted portraits (`portrait_romulus_neutral.png`, `_pleased.png`, `_alarmed.png`). The scout, Titus Tatius and Remus use a cartoon stand-in until they have their own. This page gives you prompts in the same style, and the one command that gets the pictures into the game.

I (Claude) cannot paint pictures in the style of the Rōmulus set, so use whichever image tool you used for him, and keep every setting the same for all nine pictures.

## The shared style (paste at the start of every prompt)

> Hand-drawn anime / seinen manga illustration with fine ink linework and soft muted colors, ancient Roman setting, upper-body three-quarter portrait of one man, plain warm cream paper background, earthy palette (cream, olive green, bronze, terracotta), slightly weathered and dirty clothes, subtle paper texture, 2:3 portrait format, no text, no border.

## The characters

Keep each character's look identical across the three expressions; only the face changes.

**Scout** (`scout`): a lean young man, about twenty, windswept short brown hair, sunburnt, a leather strap across a dusty undyed tunic, a small satchel, a green-blue wool cap with a red feather, mud on his shins. He has been running. Quick, honest, a bit out of breath.

**Titus Tatius** (`tatius`): the dignified king of the Sabines, about fifty-five. Long grey-streaked brown hair, a full grey-brown beard, a thin gold circlet, a purple-dyed wool cloak fastened with a bronze brooch over a pale tunic, a heavy bronze arm ring. Calm, proud, intelligent eyes. A respected opponent, never a villain.

**Remus** (`remus`): Rōmulus's twin brother, so the same face and curly dark hair, but clean-shaven or lightly stubbled, no laurel crown, a forest-green tunic with a rope belt. Smug, lazy, amused, always slightly too relaxed.

## The three expressions (add one to the prompt)

- **neutral:** `calm, steady expression, mouth closed, looking slightly off to the side` (for Rōmulus this one is tired)
- **pleased:** `warm confident smile, eyes crinkled, relaxed shoulders`
- **alarmed:** `wide eyes, raised eyebrows, mouth slightly open, tense shoulders`

## Getting the pictures into the game

1. Generate nine images (three characters, three expressions each).
2. For each one run (it needs Python and `pip install pillow`):

   ```
   python3 tools/prep_portrait.py path/to/picture.png scout pleased
   ```

   The speaker is `scout`, `tatius` or `remus`, and the mood is `neutral`, `pleased` or `alarmed`. The tool resizes the picture to 512 by 768 and saves it as `missions/rome/assets/portraits/portrait_<speaker>_<mood>.png`.
3. Reload the game. Any speaker whose files are there uses them; any that are missing keep the cartoon stand-in.

Check the result: all three expressions of one character should look like the same man.
