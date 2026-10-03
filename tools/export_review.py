"""Lists everything that still needs proofreading, as a spreadsheet you can mark up.

    python3 tools/export_review.py            every mission
    python3 tools/export_review.py rome       one mission

Writes review/<mission>-to-proofread.csv (open it in Google Sheets or Excel). It lists every entry whose
review_status is draft, and every entry whose English-mode wording (en_status) is still a draft.
Columns: what to check, the id, the type, the Latin, the English translation, the English-mode wording,
and empty columns for your decision and notes. Then tell Claude which ids to approve."""
import csv, os, sys, yaml

names = sys.argv[1:] or sorted(d for d in os.listdir('missions') if os.path.isdir(os.path.join('missions', d)))
os.makedirs('review', exist_ok=True)
for m in names:
    entries = yaml.safe_load(open(os.path.join('missions', m, 'content', 'latin.yaml'), encoding='utf-8'))
    rows = []
    for e in entries:
        what = []
        if e['review_status'] == 'draft': what.append('Latin / content')
        if e.get('en_status') == 'draft': what.append('English-mode wording')
        if not what: continue
        extra = ''
        if e['type'] == 'quiz_item':
            extra = e.get('question', '') + ' | ' + ' / '.join(e.get('choices', [])) + ' | answer: ' + str(e.get('choices', [''])[e.get('answer', 0)])
        rows.append([' + '.join(what), e['id'], e['type'], e.get('latin', ''), e.get('english', ''), e.get('en_title', '') + (' | ' if e.get('en_title') and e.get('en') else '') + e.get('en', ''), extra, '', ''])
    out = os.path.join('review', m + '-to-proofread.csv')
    with open(out, 'w', newline='', encoding='utf-8-sig') as f:  # utf-8-sig so Excel shows macrons correctly
        w = csv.writer(f)
        w.writerow(['Check', 'Id', 'Type', 'Latin', 'English (translation or body)', 'English-mode wording', 'Quiz details', 'Approve? (y/n)', 'Notes'])
        w.writerows(rows)
    print(f'{m}: {len(rows)} entries to proofread -> {out}')
