"""Turns a mission's content/latin.yaml into content/latin.js so the game can read it
when index.html is opened straight from a folder (browsers block reading the .yaml file that way).
Run from the project folder:
    python3 tools/build_content.py            builds every mission in missions/
    python3 tools/build_content.py rome       builds just one
Needs PyYAML (pip install pyyaml)."""
import json, os, sys, yaml

def build(mission):
    src = os.path.join('missions', mission, 'content', 'latin.yaml')
    out = os.path.join('missions', mission, 'content', 'latin.js')
    with open(src, encoding='utf-8') as f:
        entries = yaml.safe_load(f)
    ids = set()
    for e in entries:
        assert e['id'] not in ids, 'duplicate id: ' + e['id']
        ids.add(e['id'])
        assert e['review_status'] in ('draft', 'approved'), e['id'] + ': review_status must be draft or approved'
        if 'en' in e or 'en_title' in e:
            assert e.get('en_status') in ('draft', 'approved'), e['id'] + ': en_status must be draft or approved'
    with open(out, 'w', encoding='utf-8') as f:
        f.write('// GENERATED from latin.yaml by tools/build_content.py. Do not edit by hand.\n')
        f.write('const LATIN = ' + json.dumps(entries, ensure_ascii=False, indent=1) + ';\n')
    print('wrote', out, 'with', len(entries), 'entries')

names = sys.argv[1:] or sorted(d for d in os.listdir('missions') if os.path.isdir(os.path.join('missions', d)))
for n in names:
    build(n)
