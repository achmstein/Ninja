"""
Deletes one place from a café on the platform through its API, as its owner
(the same git-ignored prod.json as import.py), so the rest of the café hears of
it. Shows the place and asks nothing more: pass --yes to delete.

    python scripts/chillax-move/delete_place.py --slug chillax --branch 1 --id 5 [--yes]
"""
import argparse, json, os, sys, urllib.parse, urllib.request, urllib.error

here = os.path.dirname(os.path.abspath(__file__))
parser = argparse.ArgumentParser()
parser.add_argument('--slug', required=True)
parser.add_argument('--domain', default='ninjapp.net')
parser.add_argument('--branch', type=int, required=True)
parser.add_argument('--id', type=int, required=True)
parser.add_argument('--credentials', default=os.path.join(here, 'prod.json'))
parser.add_argument('--yes', action='store_true')
args = parser.parse_args()

api = f'https://api.{args.slug}.{args.domain}'
creds = json.load(open(args.credentials, encoding='utf-8'))
form = urllib.parse.urlencode({'grant_type': 'password', 'client_id': 'pos-app', 'scope': 'openid',
                               'username': creds['email'], 'password': creds['password']}).encode()
token = json.load(urllib.request.urlopen(f'https://auth.{args.domain}/realms/{args.slug}/protocol/openid-connect/token', form, timeout=30))['access_token']
headers = {'Authorization': f'Bearer {token}', 'X-Branch-Id': str(args.branch)}

place = json.load(urllib.request.urlopen(urllib.request.Request(f'{api}/api/places/{args.id}?api-version=1.0', headers=headers), timeout=30))
print(f"Place {place['id']}: {place['name']['en']} (branch {place['branchId']}, {'active' if place.get('isActive') else 'off'})")
if not args.yes:
    sys.exit('Not deleted: run again with --yes.')
try:
    urllib.request.urlopen(urllib.request.Request(f'{api}/api/places/{args.id}?api-version=1.0', method='DELETE', headers=headers), timeout=30)
    print('Deleted.')
except urllib.error.HTTPError as e:
    sys.exit(f'Refused ({e.code}): {e.read().decode()[:300]}')
