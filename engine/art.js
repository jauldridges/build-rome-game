// The art: every sprite is drawn here, in code, one "art pixel" at a time on a tiny canvas, then shown at twice the size
// with no smoothing, so it looks like chunky 8-bit pixel art. No image files. Silly, but historical-ish:
// straw hats, bronze crests that are far too tall, mustaches that are far too big, and a statue of the she-wolf.
//
// ART.<name> holds a canvas (or a list of canvases, one per animation frame).
// Mission files choose which building uses which art with the 'art' field (house, wall, gate, forum).
const ART = {};
const ART_SCALE = 2;                       // one art pixel = 2 world units

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function make(w, h, fn) { const c = mkCanvas(w, h), g = c.getContext('2d'); fn(g, c); return c; }
function R(g, color, x, y, w, h) { g.fillStyle = color; g.fillRect(x, y, w === undefined ? 1 : w, h === undefined ? 1 : h); }

// A one-pixel dark outline around everything that is drawn, so the sprites read clearly on any ground
function outlined(src, color) {
  const w = src.width + 2, h = src.height + 2, out = mkCanvas(w, h), o = out.getContext('2d');
  const d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
  const has = (x, y) => x >= 0 && y >= 0 && x < src.width && y < src.height && d[(y * src.width + x) * 4 + 3] > 0;
  o.fillStyle = color || '#2a1c08';
  for (let y = -1; y <= src.height; y++) for (let x = -1; x <= src.width; x++) {
    if (!has(x, y) && (has(x - 1, y) || has(x + 1, y) || has(x, y - 1) || has(x, y + 1))) o.fillRect(x + 1, y + 1, 1, 1);
  }
  o.drawImage(src, 1, 1);
  return out;
}

// Draw a sprite so that its bottom middle sits at world point (x, y); flip mirrors it
function blit(img, x, y, flip, scale) {
  const s = scale || ART_SCALE, w = img.width * s, h = img.height * s;
  ctx.imageSmoothingEnabled = false;
  if (flip) { ctx.save(); ctx.translate(Math.round(x), 0); ctx.scale(-1, 1); ctx.drawImage(img, -Math.round(w / 2), Math.round(y - h), w, h); ctx.restore(); }
  else ctx.drawImage(img, Math.round(x - w / 2), Math.round(y - h), w, h);
}
// Draw a sprite with its top left corner at (x, y)
function blitAt(img, x, y, scale) {
  const s = scale || ART_SCALE;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, Math.round(x), Math.round(y), img.width * s, img.height * s);
}

// ---------------------------------------------------------------- people
// 12 wide, 18 tall. Frames: 0 standing, 1 and 2 walking, 3 working (arm up).
const SKIN = '#f0c8a0', SKIN_D = '#d9a578', INK = '#2a1c08';

function legs(g, f, tunic) {
  const sandal = '#6b4a1e';
  const [lx, rx] = f === 1 ? [3, 8] : f === 2 ? [5, 6] : [4, 7];
  R(g, SKIN, lx, 14, 2, 3); R(g, SKIN, rx, 14, 2, 3);
  R(g, SKIN_D, lx + 1, 14, 1, 3); R(g, SKIN_D, rx + 1, 14, 1, 3);
  R(g, sandal, lx - 1, 17, 3, 1); R(g, sandal, rx, 17, 3, 1);
}

function farmerFrame(f) {
  return outlined(make(12, 18, g => {
    legs(g, f);
    R(g, '#c4623a', 3, 9, 6, 6); R(g, '#a34d2c', 7, 9, 2, 6); R(g, '#6b4a1e', 3, 12, 6, 1);              // tunic, shade, belt
    R(g, SKIN, 4, 4, 5, 5); R(g, SKIN_D, 4, 8, 5, 1); R(g, INK, 7, 6, 1, 1); R(g, '#e9948a', 6, 7, 1, 1);  // face, eye, rosy cheek
    R(g, '#e6c46a', 0, 3, 12, 2); R(g, '#c9a24a', 0, 4, 12, 1); R(g, '#e6c46a', 3, 0, 6, 3);             // a straw hat, far too wide
    R(g, '#c9a24a', 3, 2, 6, 1); R(g, '#a34d2c', 3, 2, 6, 1);                                             // hat band
    R(g, SKIN, 2, 9, 1, 3);                                                                              // back arm
    if (f === 3) { R(g, SKIN, 9, 5, 1, 4); R(g, '#8a5a1e', 10, 0, 1, 7); R(g, '#9a958a', 9, 0, 3, 1); }  // hoe raised
    else { R(g, SKIN, 9, 9, 1, 3); R(g, '#8a5a1e', 10, 7, 1, 9); R(g, '#9a958a', 9, 16, 3, 1); }         // hoe held
  }));
}

function soldierFrame(f) {
  return outlined(make(12, 18, g => {
    legs(g, f);
    R(g, '#2a6fb0', 3, 9, 6, 6); R(g, '#1f5586', 7, 9, 2, 6); R(g, '#c9973a', 3, 12, 6, 1);              // blue tunic, belt
    R(g, '#c9973a', 5, 9, 2, 2);                                                                         // a bronze chest disc
    R(g, SKIN, 4, 5, 5, 4); R(g, INK, 7, 6, 1, 1); R(g, SKIN_D, 4, 8, 5, 1);
    R(g, '#c9973a', 3, 3, 7, 3); R(g, '#e0b14a', 3, 3, 7, 1); R(g, '#a07a28', 3, 5, 1, 2);                // bronze helmet
    R(g, '#c0392b', 4, 0, 5, 3); R(g, '#e0553a', 4, 0, 5, 1); R(g, '#c0392b', 5, -1 + 1, 3, 1);           // an enormous red crest
    R(g, '#8a5a1e', 10, 2, 1, 15); R(g, '#c9c4b6', 10, 0, 1, 3);                                          // spear
    R(g, SKIN, 9, 9, 2, 1);
    R(g, '#c0392b', 0, 8, 5, 5); R(g, '#e0b14a', 0, 8, 5, 1); R(g, '#e0b14a', 0, 12, 5, 1); R(g, '#e0b14a', 0, 9, 1, 3); R(g, '#e0b14a', 4, 9, 1, 3); R(g, '#f2ecd8', 2, 10, 1, 1); // round shield
    if (f === 3) { R(g, '#c9c4b6', 11, 4, 1, 4); }
  }));
}

function enemyFrame(f) {
  return outlined(make(12, 18, g => {
    legs(g, f);
    R(g, '#6b2a5a', 3, 9, 6, 6); R(g, '#4d1d41', 7, 9, 2, 6); R(g, '#d9ccaa', 3, 9, 6, 2);               // purple tunic with a fur collar
    R(g, '#8a5a1e', 3, 12, 6, 1);
    R(g, SKIN, 4, 4, 5, 5); R(g, INK, 7, 5, 1, 1); R(g, INK, 6, 4, 2, 1);                                 // angry brow
    R(g, INK, 5, 7, 4, 1); R(g, INK, 4, 8, 1, 1); R(g, INK, 9, 8, 1, 1);                                  // a very large mustache
    R(g, '#5a3a1a', 3, 2, 7, 3); R(g, '#7a5a2a', 4, 1, 4, 1); R(g, '#5a3a1a', 2, 4, 2, 3); R(g, '#7a5a2a', 9, 2, 1, 1); // wild hair
    R(g, '#8a5a1e', 10, 1, 1, 16); R(g, '#9a958a', 9, 0, 3, 2);                                           // spear
    R(g, SKIN, 9, 9, 2, 1);
    R(g, '#d9ccaa', 0, 8, 4, 6); R(g, '#6b2a5a', 1, 9, 2, 4); R(g, '#8a5a1e', 0, 8, 4, 1);                // oval shield
    if (f === 3) { R(g, '#c9c4b6', 11, 3, 1, 4); }
  }));
}

function remusFrame(f) {
  return outlined(make(12, 18, g => {
    legs(g, f);
    R(g, '#3f7a3f', 3, 9, 6, 6); R(g, '#2e5a2e', 7, 9, 2, 6); R(g, '#8a5a1e', 3, 12, 6, 1);             // green tunic
    R(g, SKIN, 4, 4, 5, 5); R(g, INK, 7, 6, 1, 1); R(g, INK, 8, 8, 1, 1); R(g, INK, 6, 4, 3, 1);           // a smug little smirk
    R(g, '#3a2410', 3, 2, 7, 3); R(g, '#5a3a1a', 4, 1, 5, 1); R(g, '#3a2410', 3, 4, 1, 2);                 // dark curly hair
    R(g, SKIN, 2, 9, 1, 3); R(g, SKIN, 9, 9, 1, 3);                                                        // hands on hips
  }));
}

// ---------------------------------------------------------------- critters
function sheepFrame(f) {
  return outlined(make(10, 8, g => {
    R(g, '#f2ecd8', 1, 1, 7, 5); R(g, '#d9d2bc', 1, 5, 7, 1); R(g, '#ffffff', 2, 1, 3, 1); R(g, '#f2ecd8', 2, 0, 5, 1); // a very fluffy sheep
    R(g, '#3a3a3a', 8, 2, 2, 3); R(g, '#f2ecd8', 8, 1, 1, 1); R(g, '#e9948a', 9, 4, 1, 1);
    R(g, '#3a3a3a', f ? 2 : 3, 6, 1, 2); R(g, '#3a3a3a', f ? 6 : 5, 6, 1, 2);
  }));
}
function gooseFrame(f) {
  return outlined(make(9, 9, g => {
    R(g, '#ffffff', 1, 4, 6, 3); R(g, '#d9d2bc', 1, 6, 6, 1); R(g, '#ffffff', 6, 1, 2, 4); R(g, '#f2a03a', 8, 2, 1, 1); R(g, INK, 7, 2, 1, 1);
    R(g, '#f2a03a', f ? 2 : 3, 7, 1, 2); R(g, '#f2a03a', f ? 5 : 4, 7, 1, 2);
  }));
}

// ---------------------------------------------------------------- buildings
function houseArt() {
  return outlined(make(32, 32, g => {
    // walls: plaster with timber framing and a stone foundation
    R(g, '#e6d9b5', 4, 14, 24, 16); R(g, '#c9bc96', 26, 14, 2, 16);
    R(g, '#8a5a1e', 4, 14, 1, 16); R(g, '#8a5a1e', 27, 14, 1, 16); R(g, '#8a5a1e', 4, 21, 24, 1);
    R(g, '#b9b3a3', 3, 28, 26, 3); R(g, '#8f8a7c', 3, 30, 26, 1);
    // door with an arch
    R(g, '#6b4a1e', 13, 22, 6, 8); R(g, '#6b4a1e', 14, 21, 4, 1); R(g, '#4d3515', 16, 22, 1, 8); R(g, '#e0b14a', 15, 26, 1, 1);
    // windows with deep-blue shutters and flower boxes (silly, but nice)
    [[6, 17], [21, 17]].forEach(([x, y]) => {
      R(g, '#2a3f5a', x, y, 5, 4); R(g, '#2a6fb0', x - 1, y, 1, 4); R(g, '#2a6fb0', x + 5, y, 1, 4);
      R(g, '#8a5a1e', x - 1, y + 4, 7, 1); R(g, '#e87aa0', x, y + 3, 1, 1); R(g, '#ffd54a', x + 2, y + 3, 1, 1); R(g, '#e87aa0', x + 4, y + 3, 1, 1);
    });
    // terracotta roof: a tall triangle with rows of tiles
    for (let r = 0; r < 13; r++) {
      const half = 3 + Math.floor(r * 1.15), y = 14 - 13 + r + 1;
      R(g, r % 3 === 2 ? '#a94f2e' : '#c4623a', 16 - half, y, half * 2, 1);
      R(g, '#e0825a', 16 - half, y, 1, 1);
    }
    R(g, '#8f3f22', 14, 1, 4, 1);
    R(g, '#8f3f22', 1, 14, 30, 1); R(g, '#a9987a', 4, 15, 24, 1);                                             // eaves and their shadow
    // chimney
    R(g, '#b9b3a3', 22, 4, 4, 6); R(g, '#8f8a7c', 22, 4, 4, 1); R(g, '#8f8a7c', 25, 5, 1, 5);
  }));
}

function wallArt() {
  return make(16, 16, g => {
    R(g, '#b9b3a3', 0, 3, 16, 13);
    for (let x = 0; x < 16; x++) if (x % 8 < 5) R(g, '#b9b3a3', x, 0, 1, 3);                                  // crenellations repeat every 8 pixels
    for (let x = 0; x < 16; x++) if (x % 8 < 5) { R(g, '#d6d0c0', x, 0, 1, 1); }
    R(g, '#d6d0c0', 0, 3, 16, 1);
    R(g, '#8f8a7c', 0, 7, 16, 1); R(g, '#8f8a7c', 0, 11, 16, 1);
    R(g, '#8f8a7c', 5, 4, 1, 3); R(g, '#8f8a7c', 11, 8, 1, 3); R(g, '#8f8a7c', 3, 12, 1, 4); R(g, '#8f8a7c', 9, 12, 1, 4); R(g, '#8f8a7c', 13, 4, 1, 3);
    R(g, '#6f6a60', 0, 15, 16, 1);
    R(g, '#6f8f3a', 2, 14, 2, 1); R(g, '#6f8f3a', 12, 8, 1, 1); R(g, '#6f8f3a', 7, 15, 3, 1);               // a little moss
  });
}

function gateArt() {
  return make(32, 16, g => {
    // two stone towers
    [[0, 10], [22, 10]].forEach(([x, w]) => {
      R(g, '#b9b3a3', x, 3, w, 13); R(g, '#d6d0c0', x, 3, w, 1);
      for (let i = 0; i < w; i++) if (i % 4 < 3) R(g, '#b9b3a3', x + i, 0, 1, 3);
      R(g, '#8f8a7c', x, 7, w, 1); R(g, '#8f8a7c', x, 11, w, 1); R(g, '#8f8a7c', x + 4, 4, 1, 3); R(g, '#8f8a7c', x + 6, 8, 1, 3);
      R(g, '#2b2018', x + 4, 5, 2, 2);                                                                       // an arrow slit
    });
    R(g, '#c0392b', 3, 0, 4, 2);                                                                              // a pennant
    // the arch and the doors
    R(g, '#2b2018', 10, 5, 12, 11);
    R(g, '#7a5a2e', 11, 6, 5, 10); R(g, '#7a5a2e', 16, 6, 5, 10);
    for (let x = 12; x < 21; x += 2) R(g, '#5b3d1a', x, 6, 1, 10);
    R(g, '#444444', 11, 8, 10, 1); R(g, '#444444', 11, 13, 10, 1); R(g, '#e0b14a', 15, 11, 1, 2); R(g, '#e0b14a', 16, 11, 1, 2);
    R(g, '#b9b3a3', 10, 3, 12, 3); R(g, '#d6d0c0', 10, 3, 12, 1); R(g, '#8f8a7c', 15, 3, 2, 3);              // arch lintel and keystone
    R(g, '#6f6a60', 0, 15, 32, 1);
  });
}

function forumArt() {
  return outlined(make(64, 48, g => {
    // a travertine floor in a chessboard of pale stones
    R(g, '#d6cba8', 0, 0, 64, 48);
    for (let y = 0; y < 48; y += 4) for (let x = 0; x < 64; x += 4) if (((x + y) / 4) % 2) R(g, '#cfc29a', x, y, 4, 4);
    R(g, '#a99d7a', 0, 0, 64, 1); R(g, '#a99d7a', 0, 0, 1, 48); R(g, '#a99d7a', 63, 0, 1, 48);
    // steps along the front
    R(g, '#b9b3a3', 0, 43, 64, 5); R(g, '#d6d0c0', 0, 43, 64, 1); R(g, '#8f8a7c', 0, 46, 64, 1); R(g, '#8f8a7c', 0, 47, 64, 1);
    // the colonnade
    R(g, '#e8e0c8', 0, 0, 64, 3); for (let x = 1; x < 64; x += 4) R(g, x % 8 === 1 ? '#c4623a' : '#2a6fb0', x, 1, 2, 1);
    for (let k = 0; k < 6; k++) {
      const x = 4 + k * 10;
      R(g, '#bdb08a', x + 4, 20, 3, 4);                                                                       // shadow on the floor
      R(g, '#f2ecd8', x, 4, 4, 16); R(g, '#d4cdb5', x + 3, 4, 1, 16); R(g, '#fff8e6', x - 1, 3, 6, 2); R(g, '#e0d8bc', x - 1, 19, 6, 2);
      R(g, '#d4cdb5', x + 1, 6, 1, 12);
    }
    // the she-wolf and her twins on a plinth (the legend, in statue form)
    R(g, '#b9b3a3', 26, 30, 12, 6); R(g, '#d6d0c0', 26, 30, 12, 1); R(g, '#8f8a7c', 26, 35, 12, 1);
    R(g, '#8a8f99', 28, 25, 8, 4); R(g, '#a9aeb8', 28, 25, 8, 1); R(g, '#8a8f99', 35, 23, 3, 3); R(g, INK, 37, 24, 1, 1);
    R(g, '#8a8f99', 29, 29, 1, 2); R(g, '#8a8f99', 34, 29, 1, 2); R(g, '#8a8f99', 26, 24, 2, 1);
    R(g, '#f0c8a0', 30, 28, 2, 2); R(g, '#f0c8a0', 32, 28, 2, 2); R(g, '#c0392b', 30, 29, 2, 1); R(g, '#c0392b', 32, 29, 2, 1);
    // banners
    [[8, '#2a6fb0'], [54, '#2a6fb0']].forEach(([x, c]) => { R(g, '#8a5a1e', x, 26, 1, 14); R(g, c, x + 1, 27, 5, 8); R(g, '#e0b14a', x + 1, 27, 5, 1); R(g, '#e0b14a', x + 1, 34, 5, 1); R(g, '#e0b14a', x + 3, 29, 1, 3); });
    // a market stall with a striped awning
    for (let x = 42; x < 60; x += 2) { R(g, '#c0392b', x, 28, 1, 5); R(g, '#f2ecd8', x + 1, 28, 1, 5); }
    R(g, '#8a5a1e', 42, 33, 1, 8); R(g, '#8a5a1e', 59, 33, 1, 8); R(g, '#a07a46', 43, 37, 16, 3); R(g, '#7d5a30', 43, 39, 16, 1);
    R(g, '#e0553a', 45, 36, 2, 1); R(g, '#e0553a', 48, 36, 2, 1); R(g, '#ffd54a', 52, 36, 2, 1); R(g, '#7fb04a', 56, 36, 2, 1);
  }));
}

function storeArt() {
  return outlined(make(28, 24, g => {
    // a wooden granary with a thatched roof
    R(g, '#a07a46', 2, 9, 24, 14); for (let x = 3; x < 26; x += 3) R(g, '#7d5a30', x, 9, 1, 14);
    for (let r = 0; r < 9; r++) { const half = 6 + r * 1.3; R(g, r % 2 ? '#b8923a' : '#d9b45a', Math.round(14 - half), r, Math.round(half * 2), 1); }
    R(g, '#8f6f2a', 0, 9, 28, 1);
    R(g, '#5b3d1a', 10, 14, 8, 9); R(g, '#3d2810', 14, 14, 1, 9); R(g, '#3d2810', 10, 17, 8, 1);
    R(g, '#8a5a1e', 1, 17, 5, 6); R(g, '#444444', 1, 18, 5, 1); R(g, '#444444', 1, 21, 5, 1);                // a barrel
    R(g, '#d9ccaa', 21, 18, 5, 5); R(g, '#b9ae8a', 21, 22, 5, 1); R(g, '#8a5a1e', 22, 17, 3, 1);              // a sack
  }));
}

// ---------------------------------------------------------------- things in the world
function treeArt(kind) {
  return outlined(make(18, 24, g => {
    if (kind === 'olive') { // a silvery olive tree
      R(g, '#6b4a1e', 8, 14, 2, 9); R(g, '#8a5a1e', 7, 17, 1, 3); R(g, '#6b4a1e', 10, 16, 2, 2);
      [[3, 5, 12, 9], [5, 3, 8, 3], [2, 8, 14, 5]].forEach(([x, y, w, h]) => R(g, '#7f9f6a', x, y, w, h));
      R(g, '#a9c28a', 4, 5, 5, 2); R(g, '#a9c28a', 9, 8, 4, 2); R(g, '#5f7f4a', 4, 12, 11, 2); R(g, '#3a2a14', 9, 9, 1, 1);
    } else { // an umbrella pine, tall and flat on top, as in Rome
      R(g, '#6b4a1e', 8, 10, 2, 13); R(g, '#8a5a1e', 8, 10, 1, 13); R(g, '#6b4a1e', 7, 21, 4, 2);
      R(g, '#1f5a2a', 2, 6, 14, 5); R(g, '#1f5a2a', 4, 3, 10, 4); R(g, '#1f5a2a', 6, 1, 6, 3); R(g, '#16401e', 3, 9, 12, 2);
      R(g, '#3f8a3a', 5, 3, 4, 2); R(g, '#3f8a3a', 3, 6, 4, 2); R(g, '#3f8a3a', 9, 7, 4, 1); R(g, '#2f7a30', 7, 1, 3, 1);
    }
  }));
}

function rockArt(kind) {
  return outlined(make(18, 13, g => {
    R(g, '#9a958a', 2, 3, 13, 8); R(g, '#9a958a', 4, 1, 8, 3); R(g, '#c9c4b6', 4, 2, 5, 2); R(g, '#c9c4b6', 3, 4, 2, 2);
    R(g, '#6f6a60', 3, 10, 12, 1); R(g, '#7d776c', 11, 5, 3, 5);
    if (kind) { R(g, '#9a958a', 12, 8, 5, 4); R(g, '#c9c4b6', 13, 8, 2, 1); } else { R(g, '#6f8f3a', 3, 9, 2, 1); R(g, '#d9553a', 7, 0, 1, 1); R(g, '#f2ecd8', 7, 1, 1, 1); } // a tiny mushroom
  }));
}

function scrollArt() {
  return outlined(make(14, 14, g => {
    R(g, '#f1e4c0', 2, 2, 10, 9); R(g, '#c8b27a', 0, 1, 3, 11); R(g, '#c8b27a', 11, 1, 3, 11); R(g, '#8a5a1e', 4, 4, 6, 1); R(g, '#8a5a1e', 4, 6, 6, 1); R(g, '#8a5a1e', 4, 8, 4, 1); R(g, '#c0392b', 9, 9, 2, 2);
  }));
}

function buildArt() {
  ART.farmer = [0, 1, 2, 3].map(farmerFrame);
  ART.soldier = [0, 1, 2, 3].map(soldierFrame);
  ART.enemy = [0, 1, 2, 3].map(enemyFrame);
  ART.remus = [0, 1, 2, 3].map(remusFrame);
  ART.sheep = [0, 1].map(sheepFrame);
  ART.goose = [0, 1].map(gooseFrame);
  ART.house = houseArt(); ART.wall = wallArt(); ART.gate = gateArt(); ART.forum = forumArt(); ART.store = storeArt();
  ART.pine = treeArt('pine'); ART.olive = treeArt('olive');
  ART.rock = [rockArt(0), rockArt(1)];
  ART.scroll = scrollArt();
  ART.ready = true;
}

// A person's animation frame: standing, walking (two frames), or working
function personFrame(set, moving, working) {
  const t = performance.now();
  if (working) return set[Math.floor(t / 220) % 2 ? 3 : 0];
  if (moving) return set[1 + Math.floor(t / 150) % 2];
  return set[0];
}

// ---------------------------------------------------------------- the ground (drawn once, then reused every frame)
function seeded(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

function buildGround() {
  const cv = mkCanvas(MAP_W, MAP_H), g = cv.getContext('2d'), rnd = seeded(7);
  // grass in two greens
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { g.fillStyle = ground[r][c] ? '#74813a' : '#7d8a3c'; g.fillRect(c * TILE, r * TILE, TILE, TILE); }
  // tufts, flowers and pebbles scattered over the grass
  for (let i = 0; i < 700; i++) { const x = rnd() * MAP_W, y = rnd() * MAP_H; g.fillStyle = '#667430'; g.fillRect(x, y, 2, 4); g.fillRect(x + 4, y + 1, 2, 3); g.fillStyle = '#8b9a46'; g.fillRect(x + 2, y - 1, 2, 2); }
  const petals = ['#f2ecd8', '#ffd54a', '#e87aa0', '#9ec7ea'];
  for (let i = 0; i < 160; i++) { const x = rnd() * MAP_W, y = rnd() * MAP_H; g.fillStyle = petals[i % 4]; g.fillRect(x, y, 3, 3); g.fillStyle = '#ffd54a'; g.fillRect(x + 1, y + 1, 1, 1); }
  for (let i = 0; i < 80; i++) { const x = rnd() * MAP_W, y = rnd() * MAP_H; g.fillStyle = '#a8a396'; g.fillRect(x, y, 4, 3); g.fillStyle = '#c9c4b6'; g.fillRect(x, y, 4, 1); }

  // trodden dirt paths: from the storehouse to the hill and to the river, and out to the trees
  const path = (pts, w) => {
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = '#a98f5e'; g.lineWidth = w + 4; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    g.strokeStyle = '#c4a874'; g.lineWidth = w; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 14; k++) { const u = rnd(), x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u + (rnd() - 0.5) * w, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u + (rnd() - 0.5) * w; g.fillStyle = k % 2 ? '#b59a68' : '#d6bd8a'; g.fillRect(x, y, 2, 2); }
  };
  const sx0 = store.x + store.w / 2, sy0 = store.y + store.h + 10;
  path([[sx0, sy0], [sx0 + 20, sy0 - 60], [sx0 + 10, sy0 - 110]], 14);
  path([[sx0, sy0], [sx0 - 90, sy0 + 30], [sx0 - 170, sy0 + 10]], 12);
  path([[sx0, sy0], [sx0 + 90, sy0 + 20], [sx0 + 160, sy0 + 40]], 12);
  path([[sx0, sy0], [sx0 + 20, sy0 + 90], [sx0 + 200, sy0 + 190], [MAP_W - 140, MAP_H - 70]], 14);

  // the hill: stacked, lighter terraces with a few stones and tufts
  if (HILL) {
    [[1, '#6f7c33'], [0.97, '#7f8c3a'], [0.84, '#8d9a45'], [0.68, '#99a653'], [0.5, '#a4b05f']].forEach(([k, color], i) => {
      g.fillStyle = color; g.beginPath(); g.ellipse(HILL.x, HILL.y - i * 14, HILL.rx * k, HILL.ry * k, 0, 0, Math.PI * 2); g.fill();
    });
    g.strokeStyle = 'rgba(70,80,30,0.35)'; g.lineWidth = 2;
    [0.84, 0.68, 0.5].forEach((k, i) => { g.beginPath(); g.ellipse(HILL.x, HILL.y - (i + 2) * 14 + 4, HILL.rx * k, HILL.ry * k, 0, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke(); });
    for (let i = 0; i < 60; i++) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()), x = HILL.x + Math.cos(a) * HILL.rx * 0.9 * d, y = HILL.y - 30 + Math.sin(a) * HILL.ry * 0.8 * d; g.fillStyle = i % 3 ? '#b4be78' : '#8d9a45'; g.fillRect(x, y, 3, 2); }
    for (let i = 0; i < 16; i++) { const a = rnd() * Math.PI * 2, x = HILL.x + Math.cos(a) * HILL.rx * 0.8, y = HILL.y + Math.sin(a) * HILL.ry * 0.8; g.fillStyle = '#a8a396'; g.fillRect(x, y, 5, 3); g.fillStyle = '#c9c4b6'; g.fillRect(x, y, 5, 1); }
  }

  // the river's sandy banks and reeds (the water itself moves, so it is drawn each frame)
  if (RIVER) {
    const trace = () => { g.beginPath(); RIVER.points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); };
    g.lineCap = 'round'; g.lineJoin = 'round';
    trace(); g.strokeStyle = '#8f8458'; g.lineWidth = RIVER.half * 2 + 22; g.stroke();
    trace(); g.strokeStyle = '#b8aa74'; g.lineWidth = RIVER.half * 2 + 14; g.stroke();
    for (let i = 0; i < 60; i++) {
      const seg = Math.floor(rnd() * (RIVER.points.length - 1)), u = rnd();
      const x = RIVER.points[seg][0] + (RIVER.points[seg + 1][0] - RIVER.points[seg][0]) * u, y = RIVER.points[seg][1] + (RIVER.points[seg + 1][1] - RIVER.points[seg][1]) * u;
      const side = i % 2 ? 1 : -1, rx = x + side * (RIVER.half + 6 + rnd() * 6);
      g.fillStyle = '#4f6f2a'; g.fillRect(rx, y - 8, 2, 10); g.fillRect(rx + 3, y - 5, 2, 7); g.fillStyle = '#8a5a1e'; g.fillRect(rx + 1, y - 11, 2, 4);
    }
  }

  // the forest along the north edge: rows of pines and olives over dark undergrowth
  g.fillStyle = '#2f4a22'; g.fillRect(0, 0, MAP_W, FOREST_H);
  for (let i = 0; i < 400; i++) { g.fillStyle = i % 2 ? '#25401b' : '#3a5a2a'; g.fillRect(rnd() * MAP_W, rnd() * FOREST_H, 3, 2); }
  const treeRows = [];
  for (let row = 0; row < 4; row++) for (let x = -10 + (row % 2) * 14; x < MAP_W + 20; x += 26 + rnd() * 6) treeRows.push([x, 18 + row * 22 + rnd() * 6, rnd() < 0.2 ? ART.olive : ART.pine]);
  treeRows.sort((a, b) => a[1] - b[1]).forEach(([x, y, img]) => {
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x, y + 1, 11, 4, 0, 0, Math.PI * 2); g.fill();
    g.imageSmoothingEnabled = false; g.drawImage(img, Math.round(x - img.width), Math.round(y - img.height * 2 + 6), img.width * 2, img.height * 2);
  });
  ART.ground = cv;
}

// ---------------------------------------------------------------- things that move on their own
function shadow(x, y, rx, ry, alpha) {
  ctx.fillStyle = 'rgba(30,20,5,' + (alpha || 0.28) + ')';
  ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

// A long soft shadow on the ground, to the south-east of a building
function buildingShadow(r) {
  ctx.fillStyle = 'rgba(30,20,5,0.22)';
  ctx.beginPath(); ctx.moveTo(r.x + 2, r.y + r.h); ctx.lineTo(r.x + r.w, r.y + r.h); ctx.lineTo(r.x + r.w + 16, r.y + r.h + 9); ctx.lineTo(r.x + 18, r.y + r.h + 9); ctx.closePath(); ctx.fill();
}

// The Tiber: water that flows. Light ripples slide down the river and sparkle.
function drawRiver() {
  if (!RIVER) return;
  const t = performance.now() / 1000;
  const trace = () => { ctx.beginPath(); RIVER.points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  trace(); ctx.strokeStyle = '#2a6fb0'; ctx.lineWidth = RIVER.half * 2; ctx.stroke();
  trace(); ctx.strokeStyle = '#3b86c8'; ctx.lineWidth = RIVER.half * 1.3; ctx.stroke();
  trace(); ctx.strokeStyle = '#4f9ad8'; ctx.lineWidth = RIVER.half * 0.5; ctx.stroke();
  // ripples: short light dashes that drift downstream
  for (let seg = 0; seg < RIVER.points.length - 1; seg++) {
    const [ax, ay] = RIVER.points[seg], [bx, by] = RIVER.points[seg + 1], len = Math.hypot(bx - ax, by - ay);
    const n = Math.floor(len / 22);
    for (let i = 0; i < n; i++) {
      const u = ((i / n) + t * 0.08 + seg * 0.31) % 1;
      const x = ax + (bx - ax) * u + Math.sin(t * 1.3 + i * 2.1 + seg) * RIVER.half * 0.55;
      const y = ay + (by - ay) * u;
      ctx.fillStyle = i % 3 ? 'rgba(220,240,255,0.55)' : 'rgba(255,255,255,0.8)';
      ctx.fillRect(Math.round(x), Math.round(y), i % 3 ? 8 : 5, 2);
    }
  }
}

// Silly: pairs of eyes blink in the dark of the forest
const FOREST_EYES = [[130, 40], [420, 66], [610, 30], [880, 58], [1090, 44], [300, 20]];
function drawForestEyes() {
  const t = performance.now() / 1000;
  FOREST_EYES.forEach(([x, y], i) => {
    const phase = (t * 0.35 + i * 0.37) % 1;
    if (phase > 0.12 && phase < 0.9) { // open most of the time, then blink and vanish
      ctx.fillStyle = '#fff2a0'; ctx.fillRect(x, y, 3, 3); ctx.fillRect(x + 7, y, 3, 3);
      ctx.fillStyle = '#2a1c08'; ctx.fillRect(x + 1, y + 1, 1, 2); ctx.fillRect(x + 8, y + 1, 1, 2);
    }
  });
}

// Sheep on the hill and geese by the river, wandering about for no reason at all (a mission lists them in 'ambient')
const critters = [];
function addCritters() {
  (M.ambient || []).forEach(group => {
    for (let i = 0; i < group.n; i++) {
      const [ax, ay, rad] = group.around, a = Math.random() * Math.PI * 2, d = Math.random() * rad;
      critters.push({ kind: group.kind, home: { x: ax, y: ay, r: rad }, x: ax + Math.cos(a) * d, y: ay + Math.sin(a) * d * 0.6, tx: null, ty: null, wait: Math.random() * 3, flip: Math.random() < 0.5 });
    }
  });
}
function updateCritters(dt) {
  critters.forEach(c => {
    if (c.tx === null) { // rest a while, then pick somewhere nearby to go
      c.wait -= dt;
      if (c.wait <= 0) { const a = Math.random() * Math.PI * 2, d = Math.random() * c.home.r; c.tx = c.home.x + Math.cos(a) * d; c.ty = c.home.y + Math.sin(a) * d * 0.6; }
    } else {
      const dx = c.tx - c.x, dy = c.ty - c.y, dist = Math.hypot(dx, dy), step = (c.kind === 'goose' ? 22 : 12) * dt;
      c.flip = dx < 0;
      if (dist <= step) { c.x = c.tx; c.y = c.ty; c.tx = null; c.wait = 1.5 + Math.random() * 4; } else { c.x += dx / dist * step; c.y += dy / dist * step; }
    }
  });
}
function drawCritter(c) {
  const set = ART[c.kind];
  if (!set) return;
  const frame = c.tx !== null ? Math.floor(performance.now() / 260 + c.x) % 2 : 0, img = set[frame];
  shadow(c.x, c.y + 1, 8, 3, 0.2);
  blit(img, c.x, c.y + 3, c.flip);
}

// ---------------------------------------------------------------- light: day turns to dusk as the fighting goes on
let dusk = 0;
function duskTarget() {
  if (typeof war === 'undefined' || war.phase === 'none') return 0;
  if (war.phase === 'won' || war.phase === 'over') return 0.1;
  return Math.min(1, 0.25 + war.wave * 0.3 + (war.phase === 'attack' ? 0.1 : 0));
}
function updateDusk(dt) { dusk += (duskTarget() - dusk) * Math.min(1, dt * 0.6); }

function drawLighting() {
  if (dusk < 0.02) return;
  const t = performance.now() / 1000;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';       // the whole world warms and darkens
  const k = dusk, c = (a, b) => Math.round(a + (b - a) * k);
  const g = ctx.createLinearGradient(0, 0, 0, MAP_H);
  g.addColorStop(0, 'rgb(' + c(255, 150) + ',' + c(255, 120) + ',' + c(255, 185) + ')');
  g.addColorStop(1, 'rgb(' + c(255, 235) + ',' + c(255, 165) + ',' + c(255, 150) + ')');
  ctx.fillStyle = g; ctx.fillRect(0, 0, MAP_W, MAP_H);
  const v = ctx.createRadialGradient(MAP_W / 2, MAP_H / 2, MAP_H * 0.35, MAP_W / 2, MAP_H / 2, MAP_W * 0.62);
  v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(1, 'rgba(60,40,90,' + (0.55 * k) + ')');
  ctx.fillStyle = v; ctx.fillRect(0, 0, MAP_W, MAP_H);
  ctx.globalCompositeOperation = 'lighter';        // and the windows and the torches glow
  const lights = [];
  buildings.forEach(b => {
    if (!b.done) return;
    if (b.type === 'house') lights.push([b.x + 20, b.y + 36, 38], [b.x + 44, b.y + 36, 38]);
    else if (b.type === 'gate') lights.push([b.x + 4, b.y + 8, 30], [b.x + b.w - 4, b.y + 8, 30]);
    else if (b.type === 'forum') lights.push([b.x + 16, b.y + 50, 52], [b.x + b.w - 16, b.y + 50, 52]);
  });
  lights.push([store.x + 28, store.y + 28, 44]);
  lights.forEach(([x, y, r], i) => {
    const flick = 0.85 + 0.15 * Math.sin(t * 9 + i * 1.7) + 0.05 * Math.sin(t * 23 + i);
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r * flick);
    rg.addColorStop(0, 'rgba(255,170,70,' + (0.5 * k) + ')'); rg.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  });
  ctx.restore();
}

// ---------------------------------------------------------------- stand-in portraits
// Until a speaker's painted portrait files are supplied, the message box shows a simple cartoon bust in the speaker's colors,
// with a different face for each mood. (Rome's Romulus has painted portraits; the others use these for now.)
function portraitSVG(speaker, face) {
  const look = {
    romulus: { skin: '#e0b088', hair: '#2a1c08', cloth: '#8a8a7a', cloak: '#4b5a3a', extra: 'laurel' },
    scout: { skin: '#e8c09a', hair: '#6b4a1e', cloth: '#7a6a4a', cloak: '#2d4a5a', extra: 'cap' },
    tatius: { skin: '#e0b088', hair: '#9a9a9a', cloth: '#6b2a5a', cloak: '#4a2d5a', extra: 'beard' },
    remus: { skin: '#e0b088', hair: '#3a2410', cloth: '#3f7a3f', cloak: '#2e5a2e', extra: 'curls' },
  }[speaker] || { skin: '#e0b088', hair: '#3a2410', cloth: '#8a8a7a', cloak: '#555', extra: '' };
  const f = face === 'pleased' ? 'pleased' : face === 'alarmed' ? 'alarmed' : 'neutral';
  const eyes = f === 'alarmed'
    ? '<circle cx="78" cy="118" r="10" fill="#fff"/><circle cx="122" cy="118" r="10" fill="#fff"/><circle cx="78" cy="119" r="3.5" fill="#222"/><circle cx="122" cy="119" r="3.5" fill="#222"/>'
    : f === 'pleased'
      ? '<path d="M68 120 Q78 108 88 120" stroke="#222" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M112 120 Q122 108 132 120" stroke="#222" stroke-width="4" fill="none" stroke-linecap="round"/>'
      : '<ellipse cx="78" cy="118" rx="7" ry="5" fill="#fff"/><ellipse cx="122" cy="118" rx="7" ry="5" fill="#fff"/><circle cx="80" cy="118" r="3" fill="#222"/><circle cx="124" cy="118" r="3" fill="#222"/>';
  const brows = f === 'alarmed'
    ? '<path d="M66 98 L90 104" stroke="#222" stroke-width="4" stroke-linecap="round"/><path d="M134 98 L110 104" stroke="#222" stroke-width="4" stroke-linecap="round"/>'
    : f === 'pleased'
      ? '<path d="M66 104 Q78 96 90 103" stroke="#222" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M110 103 Q122 96 134 104" stroke="#222" stroke-width="4" fill="none" stroke-linecap="round"/>'
      : '<path d="M66 105 L90 105" stroke="#222" stroke-width="4" stroke-linecap="round"/><path d="M110 105 L134 105" stroke="#222" stroke-width="4" stroke-linecap="round"/>';
  const mouth = f === 'alarmed' ? '<ellipse cx="100" cy="158" rx="9" ry="12" fill="#5a1e1e"/>'
    : f === 'pleased' ? '<path d="M78 148 Q100 172 122 148" stroke="#5a1e1e" stroke-width="4" fill="#fff" stroke-linecap="round"/>'
      : '<path d="M86 156 L114 156" stroke="#5a1e1e" stroke-width="4" stroke-linecap="round"/>';
  let hair = '', front = '';
  if (look.extra === 'laurel') { hair = '<path d="M52 100 Q50 52 100 50 Q150 52 148 100 Q140 70 100 70 Q60 70 52 100Z" fill="' + look.hair + '"/>'; for (let i = 0; i < 9; i++) front += '<ellipse cx="' + (58 + i * 10.5) + '" cy="' + (76 - Math.sin(i / 8 * Math.PI) * 14) + '" rx="7" ry="3.5" fill="#d9a83a" transform="rotate(' + (-40 + i * 10) + ' ' + (58 + i * 10.5) + ' 70)"/>'; }
  else if (look.extra === 'cap') { hair = '<path d="M52 108 Q52 50 100 48 Q148 50 148 108 Q140 80 100 78 Q60 80 52 108Z" fill="' + look.hair + '"/>'; front = '<path d="M50 84 Q100 30 150 84 Q100 66 50 84Z" fill="#2a6f5a"/><path d="M140 60 Q172 30 178 10 Q160 36 134 56Z" fill="#c0392b"/>'; }
  else if (look.extra === 'beard') { hair = '<path d="M48 120 Q40 50 100 46 Q160 50 152 120 L152 150 L48 150Z" fill="' + look.hair + '"/>'; front = '<path d="M58 140 Q60 205 100 215 Q140 205 142 140 Q120 168 100 164 Q80 168 58 140Z" fill="' + look.hair + '"/><rect x="56" y="70" width="88" height="8" fill="#e0b14a"/>'; }
  else { hair = '<path d="M50 104 Q46 48 100 46 Q154 48 150 104 Q140 72 100 70 Q60 72 50 104Z" fill="' + look.hair + '"/>'; for (let i = 0; i < 7; i++) front += '<circle cx="' + (58 + i * 14) + '" cy="' + (72 - Math.sin(i / 6 * Math.PI) * 10) + '" r="9" fill="' + look.hair + '"/>'; }
  return '<svg viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet">'
    + '<path d="M0 300 Q10 215 100 205 Q190 215 200 300Z" fill="' + look.cloak + '"/><path d="M30 300 Q40 224 100 214 Q160 224 170 300Z" fill="' + look.cloth + '"/>'
    + '<rect x="86" y="170" width="28" height="44" fill="#c99a70"/>' + hair
    + '<ellipse cx="100" cy="122" rx="48" ry="56" fill="' + look.skin + '"/>' + front
    + '<ellipse cx="54" cy="126" rx="6" ry="12" fill="' + look.skin + '"/><ellipse cx="146" cy="126" rx="6" ry="12" fill="' + look.skin + '"/>'
    + brows + eyes + '<path d="M100 122 L94 142 L104 142" stroke="#b98558" stroke-width="3" fill="none"/>' + mouth + '</svg>';
}
