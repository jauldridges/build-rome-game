"""Builds the one-page fact-check review (an HTML file) from missions/<name>/kit/facts.yaml.
    python3 tools/build_factcheck_page.py rome OUTPUT.html
Each claim becomes a card with its candidate sources, a "Find passage" search button, and Looks right / Fix it / Can't find it buttons."""
import json, os, sys, yaml

mission, out = sys.argv[1], sys.argv[2]
base = os.path.join('missions', mission)
facts = yaml.safe_load(open(os.path.join(base, 'kit', 'facts.yaml'), encoding='utf-8'))
content = {e['id']: e for e in yaml.safe_load(open(os.path.join(base, 'content', 'latin.yaml'), encoding='utf-8'))}

groups, order = {}, []
for f in facts:
    gid = next((g for g in f['game'] if g.startswith('culture_')), 'other')
    f['group'] = gid
    if gid not in groups:
        c = content.get(gid, {})
        groups[gid] = {'id': gid, 'title': c.get('latin') or c.get('en_title') or 'Other lines', 'text': c.get('english', '')}
        order.append(gid)
    f.setdefault('note', '')
slim = [{k: f[k] for k in ('id', 'claim', 'group', 'sources', 'confidence', 'note')} for f in facts]
tpl = open('tools/factcheck_template.html', encoding='utf-8').read()
page = tpl.replace('__FACTS__', json.dumps(slim, ensure_ascii=False)).replace('__GROUPS__', json.dumps([groups[g] for g in order], ensure_ascii=False))
open(out, 'w', encoding='utf-8').write(page)
print('wrote', out, len(facts), 'claims')
