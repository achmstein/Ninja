"""
Exports the local Chillax menu and places (the dev AppHost's) to ./export:
branches, categories, dishes with their options, their photos, and each
branch's places with their rates. Reads through the local web app's proxy,
anonymously; nothing is changed.

    python scripts/chillax-move/export.py [--base http://[::1]:5174]
"""
import argparse, json, os, sys, urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--base', default='http://[::1]:5174')
parser.add_argument('--out', default=os.path.join(os.path.dirname(__file__), 'export'))
args = parser.parse_args()
os.makedirs(os.path.join(args.out, 'pics'), exist_ok=True)


def get(path, branch=1, raw=False):
    sep = '&' if '?' in path else '?'
    req = urllib.request.Request(f'{args.base}{path}{sep}api-version=1.0', headers={'X-Branch-Id': str(branch)})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read()
        return body if raw else json.loads(body)


branches = get('/api/branches')
categories = get('/api/catalog/categories')
items = get('/api/catalog/items')
for item in items:
    # The café-wide price, not a branch's own
    base = item.get('base')
    if base:
        for k in ('price', 'offerPrice', 'isOnOffer', 'isAvailable', 'offerWeekdays', 'offerFrom', 'offerTo'):
            if k in base: item[k] = base[k]
    if item.get('pictureUri'):
        try:
            data = get(f"/api/catalog/items/{item['id']}/pic", raw=True)
            name = f"{item['id']}.img"
            open(os.path.join(args.out, 'pics', name), 'wb').write(data)
            item['_pic'] = name
        except Exception as e:
            print(f"  no photo for {item['name']['en']}: {e}", file=sys.stderr)

places = {}
for b in branches:
    places[str(b['id'])] = get('/api/places', branch=b['id'])

json.dump({'branches': branches, 'categories': categories, 'items': items, 'places': places},
          open(os.path.join(args.out, 'chillax.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f"{len(branches)} branches, {len(categories)} categories, {len(items)} dishes "
      f"({sum(1 for i in items if i.get('_pic'))} photos, {sum(len(i.get('customizations') or []) for i in items)} option groups), "
      + ', '.join(f"{len(p)} places in branch {k}" for k, p in places.items()))
