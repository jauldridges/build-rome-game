"""Turns content/latin.yaml into content/latin.js so the game can read it
when index.html is opened straight from a folder (browsers block reading
the .yaml file that way). Run from the project folder:  python3 tools/build_content.py
Needs PyYAML (pip install pyyaml)."""
import json, yaml

with open('content/latin.yaml', encoding='utf-8') as f:
    entries = yaml.safe_load(f)
for e in entries:
    assert e['review_status'] in ('draft', 'approved'), e['id']
with open('content/latin.js', 'w', encoding='utf-8') as f:
    f.write('// GENERATED from content/latin.yaml by tools/build_content.py. Do not edit by hand.\n')
    f.write('const LATIN = ' + json.dumps(entries, ensure_ascii=False, indent=1) + ';\n')
print('wrote content/latin.js with', len(entries), 'entries')
