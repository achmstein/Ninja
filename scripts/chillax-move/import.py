"""
Puts the exported Chillax menu and places (export.py) into a café on the
platform, through the café's own API, signed in as its owner:

  1. branches: the café's first branch takes the first exported one's name and
     details; the others are created;
  2. the café's current places, dishes and categories are removed;
  3. categories, dishes (their photos, their option groups) and each branch's
     places with their rates are created.

A dry run by default: it signs in, reads the café and says what it would do.
--apply does it. The owner's sign-in comes from a JSON file of your own
({"email": "...", "password": "..."}, default ./prod.json beside this script,
which git ignores), never from the command line.

    python scripts/chillax-move/import.py --slug chillax [--domain ninjapp.net] [--apply]
"""
import argparse, json, mimetypes, os, sys, urllib.parse, urllib.request, urllib.error, uuid

here = os.path.dirname(os.path.abspath(__file__))
parser = argparse.ArgumentParser()
parser.add_argument('--slug', required=True)
parser.add_argument('--domain', default='ninjapp.net')
parser.add_argument('--credentials', default=os.path.join(here, 'prod.json'))
parser.add_argument('--export', default=os.path.join(here, 'export'))
parser.add_argument('--apply', action='store_true')
parser.add_argument('--api', help='The café API, when not api.<slug>.<domain> (a local stack)')
parser.add_argument('--token-url', help="Keycloak's token endpoint, when not auth.<domain>/realms/<slug>")
args = parser.parse_args()

API = args.api or f'https://api.{args.slug}.{args.domain}'
TOKEN_URL = args.token_url or f'https://auth.{args.domain}/realms/{args.slug}/protocol/openid-connect/token'
data = json.load(open(os.path.join(args.export, 'chillax.json'), encoding='utf-8'))


def sign_in():
    creds = json.load(open(args.credentials, encoding='utf-8'))
    form = urllib.parse.urlencode({'grant_type': 'password', 'client_id': 'pos-app', 'scope': 'openid',
                                   'username': creds['email'], 'password': creds['password']}).encode()
    try:
        with urllib.request.urlopen(TOKEN_URL, form, timeout=30) as r:
            return json.load(r)['access_token']
    except urllib.error.HTTPError as e:
        sys.exit(f'Sign-in refused ({e.code}): {e.read().decode()[:200]}')


TOKEN = sign_in()


def call(method, path, body=None, branch=1, files=None):
    sep = '&' if '?' in path else '?'
    headers = {'Authorization': f'Bearer {TOKEN}', 'X-Branch-Id': str(branch)}
    payload = None
    if files:
        boundary = uuid.uuid4().hex
        name, content, ctype = files
        payload = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\n'
                   f'Content-Type: {ctype}\r\n\r\n').encode() + content + f'\r\n--{boundary}--\r\n'.encode()
        headers['Content-Type'] = f'multipart/form-data; boundary={boundary}'
    elif body is not None:
        payload = json.dumps(body).encode()
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(f'{API}{path}{sep}api-version=1.0', data=payload, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw and r.headers.get_content_type() == 'application/json' else raw)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def must(label, result):
    status, body = result
    if status >= 300:
        sys.exit(f'{label} refused ({status}): {body}')
    return body


def image_type(content):
    if content[:3] == b'\xff\xd8\xff': return 'pic.jpg', 'image/jpeg'
    if content[:8] == b'\x89PNG\r\n\x1a\n': return 'pic.png', 'image/png'
    if content[:4] == b'RIFF' and content[8:12] == b'WEBP': return 'pic.webp', 'image/webp'
    return 'pic.jpg', 'image/jpeg'


# ---- What the café has now
branches = must('reading branches', call('GET', '/api/branches/all'))
first = min(branches, key=lambda b: b['id'])
theirs = {'categories': must('reading categories', call('GET', '/api/catalog/categories')),
          'items': must('reading dishes', call('GET', f"/api/catalog/items", branch=first['id']))}
their_places = {b['id']: must('reading places', call('GET', '/api/places', branch=b['id'])) for b in branches}

exported = sorted(data['branches'], key=lambda b: b['id'])
print(f'Cafe {args.slug} at {API}')
print(f'  now: {len(branches)} branch(es) ({", ".join(b["name"]["en"] for b in branches)}), '
      f'{len(theirs["categories"])} categories, {len(theirs["items"])} dishes, {sum(len(p) for p in their_places.values())} places')
print(f'  after: {len(exported)} branches ({", ".join(b["name"]["en"] for b in exported)}), {len(data["categories"])} categories, '
      f'{len(data["items"])} dishes, {sum(len(p) for p in data["places"].values())} places')
if not args.apply:
    print('Dry run: nothing changed. Run again with --apply to do it.')
    sys.exit(0)


def branch_body(b, active=True):
    body = {k: b.get(k) for k in ('name', 'address', 'phone', 'displayOrder', 'taxNumber', 'receiptFooter',
                                   'dayStartTime', 'dayEndTime', 'isOrderingEnabled', 'isReservationsEnabled')}
    body['isActive'] = active
    return body


# ---- 1. Branches: the first takes the first exported one's details, the rest are made
branch_map = {}
must('renaming the first branch', call('PUT', f"/api/branches/{first['id']}", branch_body(exported[0])))
branch_map[exported[0]['id']] = first['id']
by_name = {b['name']['en'].strip().lower(): b for b in branches if b['id'] != first['id']}
for b in exported[1:]:
    existing = by_name.get(b['name']['en'].strip().lower())
    if existing:
        must(f"updating branch {b['name']['en']}", call('PUT', f"/api/branches/{existing['id']}", branch_body(b)))
        branch_map[b['id']] = existing['id']
    else:
        created = must(f"creating branch {b['name']['en']}", call('POST', '/api/branches', branch_body(b)))
        branch_map[b['id']] = created['id']
print(f'Branches: {branch_map}')

# ---- 2. What was there goes: places, then dishes, then categories
refused = []
for branch_id, places in their_places.items():
    for p in places:
        status, body = call('DELETE', f"/api/places/{p['id']}", branch=branch_id)
        if status >= 300: refused.append(f"place {p['name']['en']}: {status} {body}")
for item in theirs['items']:
    status, body = call('DELETE', f"/api/catalog/items/{item['id']}")
    if status >= 300: refused.append(f"dish {item['name']['en']}: {status} {body}")
for cat in theirs['categories']:
    status, body = call('DELETE', f"/api/catalog/categories/{cat['id']}")
    if status >= 300: refused.append(f"category {cat['name']['en']}: {status} {body}")
print(f'Removed the old menu and places' + (f' ({len(refused)} refused)' if refused else ''))
for r in refused: print('  refused:', r)

# ---- 3. Categories, dishes, options, photos
cat_map = {}
for cat in sorted(data['categories'], key=lambda c: c.get('displayOrder', 0)):
    created = must(f"category {cat['name']['en']}", call('POST', '/api/catalog/categories', {'name': cat['name'], 'displayOrder': cat.get('displayOrder', 0)}))
    cat_map[cat['id']] = created['id']

photos = options = 0
for item in sorted(data['items'], key=lambda i: (i['catalogTypeId'], i.get('displayOrder', 0))):
    body = {k: item.get(k) for k in ('name', 'description', 'price', 'isAvailable', 'isOnOffer', 'offerPrice', 'isPopular', 'preparationTimeMinutes', 'displayOrder')}
    body['catalogTypeId'] = cat_map[item['catalogTypeId']]
    created = must(f"dish {item['name']['en']}", call('POST', '/api/catalog/items', body))
    new_id = created['id']
    if item.get('isOnOffer') and (item.get('offerWeekdays') or item.get('offerFrom')):
        update = {**body, 'offerWeekdays': item.get('offerWeekdays'), 'offerFrom': item.get('offerFrom'), 'offerTo': item.get('offerTo')}
        must(f"offer on {item['name']['en']}", call('PUT', f'/api/catalog/items/{new_id}', update))
    for group in sorted(item.get('customizations') or [], key=lambda g: g.get('displayOrder', 0)):
        must(f"options on {item['name']['en']}", call('POST', f'/api/catalog/items/{new_id}/customizations', {
            'name': group['name'], 'isRequired': group.get('isRequired', False), 'allowMultiple': group.get('allowMultiple', False),
            'displayOrder': group.get('displayOrder', 0),
            'options': [{'name': o['name'], 'priceAdjustment': o.get('priceAdjustment', 0), 'isDefault': o.get('isDefault', False),
                         'displayOrder': o.get('displayOrder', 0)} for o in group.get('options') or []]}))
        options += 1
    if item.get('_pic'):
        content = open(os.path.join(args.export, 'pics', item['_pic']), 'rb').read()
        name, ctype = image_type(content)
        must(f"photo of {item['name']['en']}", call('POST', f'/api/catalog/items/{new_id}/pic', files=(name, content, ctype)))
        photos += 1
print(f'Menu: {len(cat_map)} categories, {len(data["items"])} dishes, {options} option groups, {photos} photos')

# ---- 4. Places, each in its branch, with its rates
made = 0
for old_branch, places in data['places'].items():
    branch_id = branch_map[int(old_branch)]
    for p in places:
        tariff = p.get('tariff')
        body = {'kind': p['kind'], 'name': p['name'], 'description': p.get('description'), 'reservable': p.get('reservable'),
                'tariff': {'options': [{'code': o['code'], 'name': o['name'], 'hourlyRate': o['hourlyRate']} for o in tariff['options']],
                           'roundingMinutes': tariff.get('roundingMinutes', 15)} if tariff and tariff.get('options') else None}
        # A new place answers with its id alone
        place_id = must(f"place {p['name']['en']}", call('POST', '/api/places', body, branch=branch_id))
        if p.get('isActive') is False:
            must(f"place {p['name']['en']} off", call('PUT', f"/api/places/{place_id}/active", {'isActive': False}, branch=branch_id))
        made += 1
print(f'Places: {made}')
print('Done.')
