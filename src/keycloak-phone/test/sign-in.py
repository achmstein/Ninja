"""Drives the phone sign-in on a local Keycloak: the direct grant, then the browser pages.

Keycloak's cookies are Secure, so on http they are carried by hand.
"""
import base64
import hashlib
import html
import json
import os
import re
import sys
import time
import urllib.parse

import requests

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8097'
REALM = 'chillax'
TOKEN = f'{BASE}/realms/{REALM}/protocol/openid-connect/token'
AUTH = f'{BASE}/realms/{REALM}/protocol/openid-connect/auth'
CODE = '482193'
ok = True


def check(name, cond, detail=''):
    global ok
    ok = ok and bool(cond)
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))


def grant(**fields):
    r = requests.post(TOKEN, data={'grant_type': 'password', 'client_id': 'mobile-app', 'scope': 'openid', **fields})
    try:
        return r.status_code, r.json()
    except ValueError:
        return r.status_code, {'raw': r.text[:200]}


def claims(token):
    part = token.split('.')[1]
    return json.loads(base64.urlsafe_b64decode(part + '=' * (-len(part) % 4)))


print('--- direct grant (the app)')
n1 = '+201000000001'
s, b = grant(phone='+201055555555')
check('a number that is not a test number gets no code', s == 401 and b.get('error_description') == 'phone_unavailable', b)
s, b = grant(phone='0100')
check('a number not written the international way is refused', s == 400 and b.get('error_description') == 'phone_invalid', b)
s, b = grant(phone=n1)
check('a code is sent', s == 401 and b.get('error_description') == 'phone_code_sent', b)
s, b = grant(phone=n1)
check('a second code at once is too soon', b.get('error_description') == 'phone_too_soon', b)
s, b = grant(phone=n1, code='000000')
check('a wrong code is refused', s == 401 and b.get('error_description') == 'phone_code_wrong', b)
s, b = grant(phone=n1, code=CODE)
check('a new number is asked for its name, the code left good', b.get('error_description') == 'phone_name_needed', b)
s, b = grant(phone=n1, code=CODE, first_name='Mona', last_name='Ibrahim')
check('the code and the name make the account and sign it in', s == 200 and 'access_token' in b, b)
if s == 200:
    c = claims(b['access_token'])
    check('the token is the number\'s account', c.get('preferred_username') == n1 and c.get('given_name') == 'Mona', c)
    print('   claims:', {k: c.get(k) for k in ('preferred_username', 'name', 'phone_number', 'phoneNumber', 'email', 'realm_access')})
    r = requests.post(TOKEN, data={'grant_type': 'refresh_token', 'client_id': 'mobile-app', 'refresh_token': b['refresh_token']})
    check('its refresh token renews', r.status_code == 200, r.text[:200])
s, b = grant(phone=n1, code=CODE)
check('a spent code is gone', b.get('error_description') == 'phone_code_gone', b)
s, b = grant(username='nobody@example.com', password='x')
check('a password sign-in still goes by the password', s == 401 and b.get('error') == 'invalid_grant' and 'phone' not in str(b.get('error_description')), b)

print('--- browser (the web)')


class Browser:
    """One browser's visit: cookies kept whatever their Secure flag."""

    def __init__(self):
        self.cookies = {}

    def _take(self, r):
        for header in r.raw.headers.getlist('Set-Cookie'):
            name, _, rest = header.partition('=')
            value = rest.split(';', 1)[0]
            if 'Max-Age=0' in header or value == '':
                self.cookies.pop(name, None)
            else:
                self.cookies[name] = value

    def go(self, method, url, data=None):
        for _ in range(8):
            r = requests.request(method, url, data=data, allow_redirects=False,
                                 headers={'Cookie': '; '.join(f'{k}={v}' for k, v in self.cookies.items())})
            self._take(r)
            if r.status_code in (301, 302, 303):
                url = urllib.parse.urljoin(url, r.headers['Location'])
                if not url.startswith(BASE):
                    return r.status_code, url, ''
                method, data = 'GET', None
                continue
            return r.status_code, url, r.text
        raise RuntimeError('too many redirects')


def action_of(page):
    m = re.search(r'<form[^>]*action="([^"]+)"', page)
    return html.unescape(m.group(1)) if m else None


def start(browser, hint=None, **extra):
    verifier = base64.urlsafe_b64encode(os.urandom(32)).decode().rstrip('=')
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')
    params = {'client_id': 'client-web', 'redirect_uri': 'http://localhost:5174/auth/callback', 'response_type': 'code',
              'scope': 'openid profile', 'state': 'x', 'code_challenge': challenge, 'code_challenge_method': 'S256', **extra}
    if hint:
        params['login_hint'] = hint
    status, url, page = browser.go('GET', AUTH + '?' + urllib.parse.urlencode(params))
    return verifier, status, url, page


def tokens(url, verifier):
    code = urllib.parse.parse_qs(urllib.parse.urlparse(url).query).get('code', [None])[0]
    r = requests.post(TOKEN, data={'grant_type': 'authorization_code', 'client_id': 'client-web', 'code': code,
                                   'redirect_uri': 'http://localhost:5174/auth/callback', 'code_verifier': verifier})
    return r.status_code, r.json()


b1 = Browser()
_, status, url, page = start(b1)
check('with no number named the ordinary sign-in page shows', 'id="kc-form-login"' in page or 'name="password"' in page, page[:300])

b2 = Browser()
_, status, url, page = start(b2, hint='+201055555555')
check('a number no code can reach gets the ordinary page', 'name="password"' in page and 'ninja-phone-form' not in page, page[:300])

n2 = '+201000000002'
b3 = Browser()
verifier, status, url, page = start(b3, hint=n2, ui_locales='ar')
check('a named number gets the code page', 'ninja-phone-form' in page and n2 in page, page[:400])
check('the page is the business\'s own (the theme), in Arabic', 'nj-card' in page and 'الكود' in page, re.sub(r'\s+', ' ', page)[:300])
status, url, page = b3.go('POST', action_of(page), {'code': '111111'})
check('a wrong code says so on the page', 'ninja-phone-form' in page and ('مش صح' in page), re.sub(r'\s+', ' ', page)[-600:])
status, url, page = b3.go('POST', action_of(page), {'resend': 'true'})
check('another code so soon is refused, said on the page', 'دقيقة' in page, re.sub(r'\s+', ' ', page)[-600:])
time.sleep(1.2)
status, url, page = b3.go('POST', action_of(page), {'code': CODE})
check('the right code, for a new number, asks for the name', 'name="firstName"' in page and 'name="lastName"' in page, re.sub(r'\s+', ' ', page)[:600])
status, url, page = b3.go('POST', action_of(page), {'firstName': 'Karim', 'lastName': ''})
check('half a name is asked for again', 'name="lastName"' in page and 'value="Karim"' in page, re.sub(r'\s+', ' ', page)[:600])
status, url, page = b3.go('POST', action_of(page), {'firstName': 'Karim', 'lastName': 'Mostafa'})
check('the name makes the account and goes back to the app with a code', url.startswith('http://localhost:5174/auth/callback') and 'code=' in url, f'{status} {url} {re.sub(chr(10), " ", page)[:500]}')
if 'code=' in url:
    s, t = tokens(url, verifier)
    check('the app\'s code turns into tokens', s == 200 and 'access_token' in t, t)
    if s == 200:
        c = claims(t['access_token'])
        check('they are the number\'s account, with its name', c.get('preferred_username') == n2 and c.get('name') == 'Karim Mostafa', c)

# The same number again, in a new browser, its name passed by the app: straight in after the code
time.sleep(61)
b4 = Browser()
verifier, status, url, page = start(b4, hint=n2, nj_first='Someone', nj_last='Else')
check('the number\'s next sign-in asks for the code again', 'ninja-phone-form' in page, page[:300])
status, url, page = b4.go('POST', action_of(page), {'code': CODE})
check('and the code alone signs its account in', url.startswith('http://localhost:5174/auth/callback') and 'code=' in url, f'{status} {url} {page[:300]}')
if 'code=' in url:
    s, t = tokens(url, verifier)
    c = claims(t['access_token']) if s == 200 else {}
    check('the same account, its name unchanged', c.get('name') == 'Karim Mostafa', c or t)

b5 = Browser()
_, status, url, page = start(b5, hint=n1)
status, url, page = b5.go('POST', action_of(page), {'otherWay': 'true'}) if 'ninja-phone-form' in page else (status, url, page)
check('"sign in another way" hands over to the ordinary page', 'name="password"' in page, re.sub(r'\s+', ' ', page)[:400])

print('ALL PASS' if ok else 'SOME FAILED')
sys.exit(0 if ok else 1)
