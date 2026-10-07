#!/bin/sh
# Rebuilds latin.html (the students' link: Latin only, no choice) from index.html. Run this after editing index.html.
cd "$(dirname "$0")/.." && sed "s|<script src=\"engine/boot.js\"></script>|<script>window.ONLY_LANG = 'la';</script>\n<script src=\"engine/boot.js\"></script>|" index.html > latin.html
