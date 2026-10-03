"""Which spec nodes does a mission practice?  Reads latin1-spec.yaml and each mission's content/latin.yaml
(main spec_node_id plus any "# also ..." nodes in the comment on that line) and prints a coverage report.

    python3 tools/coverage.py                 every mission together
    python3 tools/coverage.py rome            one mission
    python3 tools/coverage.py --unit 1        only spec nodes taught in unit 1 (repeat --unit for more)
    python3 tools/coverage.py --csv out.csv   also write the full table to a CSV file

Use it to see what a new mission should practice next."""
import argparse, csv, glob, os, re, sys, yaml

ap = argparse.ArgumentParser()
ap.add_argument('missions', nargs='*')
ap.add_argument('--unit', type=int, action='append')
ap.add_argument('--csv')
args = ap.parse_args()

spec_files = sorted(glob.glob('latin1-spec*.yaml'))
if not spec_files:
    sys.exit('No latin1-spec*.yaml in the project folder.')
spec = yaml.safe_load(open(spec_files[0], encoding='utf-8'))
nodes = {n['id']: n for n in spec['nodes']}

names = args.missions or sorted(d for d in os.listdir('missions') if os.path.isdir(os.path.join('missions', d)))
uses = {}      # node id -> list of (mission, entry id, 'main' or 'also')
unmapped = []
for m in names:
    entry = None
    for raw in open(os.path.join('missions', m, 'content', 'latin.yaml'), encoding='utf-8'):
        mm = re.match(r'- id: (\S+)', raw)
        if mm:
            entry = mm.group(1)
            continue
        mm = re.match(r'\s+spec_node_id: (\S+)(.*)', raw)
        if mm and entry:
            main, rest = mm.group(1), mm.group(2)
            if main == 'unmapped':
                unmapped.append((m, entry))
                continue
            uses.setdefault(main, []).append((m, entry, 'main'))
            also = re.search(r'#\s*also\s+(.*)', rest)
            if also:
                for node in re.findall(r'[A-Z]{2}-\d{3}', also.group(1)):
                    uses.setdefault(node, []).append((m, entry, 'also'))

wanted = {n for n, v in nodes.items() if not args.unit or v.get('unit') in args.unit}
covered = sorted(n for n in wanted if n in uses)
missing = sorted(n for n in wanted if n not in uses)
unknown = sorted(n for n in uses if n not in nodes)

print('Missions:', ', '.join(names))
for strand in ('MS', 'RW', 'MW', 'CR'):
    total = [n for n in wanted if n.startswith(strand + '-')]
    got = [n for n in total if n in uses]
    print(f'  {strand}: {len(got)} of {len(total)} nodes practiced')
print(f'\nEntries with no spec node (unmapped): {len(unmapped)}')
if unknown:
    print('\nNodes named in the content that are not in the spec:', ', '.join(unknown))
print('\nPracticed:')
for n in covered:
    print(f'  {n}  unit {nodes[n].get("unit")}  {nodes[n]["label"]}  <- {len(uses[n])} item(s)')
print('\nNot practiced yet:')
for n in missing:
    print(f'  {n}  unit {nodes[n].get("unit")}  {nodes[n]["label"]}')

if args.csv:
    with open(args.csv, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['node', 'unit', 'label', 'practiced', 'items'])
        for n in sorted(wanted):
            w.writerow([n, nodes[n].get('unit'), nodes[n]['label'], 'yes' if n in uses else 'no', ' '.join(f'{m}:{e}' for m, e, _ in uses.get(n, []))])
    print('\nwrote', args.csv)
