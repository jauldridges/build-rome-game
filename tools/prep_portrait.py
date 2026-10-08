"""Resize a painted portrait and save it where the game looks for it.

    python3 tools/prep_portrait.py picture.png scout pleased
    python3 tools/prep_portrait.py picture.webp tatius alarmed --mission rome

The game wants 512 x 768 (2:3) PNG files named portrait_<speaker>_<neutral|pleased|alarmed>.png in
missions/<mission>/assets/portraits/. Needs Pillow: pip install pillow"""
import argparse, os
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('picture')
ap.add_argument('speaker')
ap.add_argument('mood', choices=['neutral', 'pleased', 'alarmed'])
ap.add_argument('--mission', default='rome')
a = ap.parse_args()

img = Image.open(a.picture).convert('RGB')
w, h = img.size
target = 2 / 3
if abs(w / h - target) > 0.02:  # crop to 2:3 from the top-middle, keeping the face
    if w / h > target:
        nw = int(h * target); x = (w - nw) // 2; img = img.crop((x, 0, x + nw, h))
    else:
        nh = int(w / target); img = img.crop((0, 0, w, nh))
out_dir = os.path.join('missions', a.mission, 'assets', 'portraits')
os.makedirs(out_dir, exist_ok=True)
out = os.path.join(out_dir, f'portrait_{a.speaker}_{a.mood}.png')
img.resize((512, 768), Image.LANCZOS).save(out, optimize=True)
print('saved', out)
