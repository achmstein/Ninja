#!/usr/bin/env python3
"""Brings a realm that already exists up to what the realm file says about the owner's assistant.

Keycloak imports a realm file once, on the first start, and never again. The
single Chillax stack's realm therefore lacks what chillax-realm.json gained for
Assistant.API: the mcp client scope (the audience chat-app tokens must carry),
the realm's default scope lists, the ninja-mcp and assistant-api clients, the
mcp role mappings and the anonymous registration policies that let ChatGPT and
Claude register a client of their own. This script adds them through the admin
REST API, the same way the control plane's Infra.EnsureAssistantClientsAsync
does for stamped tenants, and can be run again at any time.

    KEYCLOAK_PASSWORD=... python3 keycloak-assistant.py \
        --keycloak https://auth.chillax.site --realm chillax \
        --realm-file KeycloakConfiguration/realms/chillax-realm.json \
        --api-url https://api.chillax.site --secret "$ASSISTANT_SECRET"

Standard library only, so it runs on the deploy host as it is.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

POLICY_TYPE = "org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy"


class Admin:
    def __init__(self, base, realm, token):
        self.base = base.rstrip("/")
        self.admin = f"{self.base}/admin/realms/{realm}"
        self.token = token

    def call(self, method, path, body=None, ok=(200, 201, 204, 409)):
        url = path if path.startswith("http") else f"{self.admin}/{path.lstrip('/')}"
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(url, data=data, method=method)
        request.add_header("Authorization", f"Bearer {self.token}")
        if data is not None:
            request.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                text = response.read().decode()
                return response.status, response.headers, (json.loads(text) if text else None)
        except urllib.error.HTTPError as e:
            if e.code in ok:
                return e.code, e.headers, None
            raise SystemExit(f"Keycloak refused {method} {url} ({e.code}): {e.read().decode()[:500]}")

    def get(self, path):
        return self.call("GET", path)[2]


def token(base, user, password):
    form = urllib.parse.urlencode({"grant_type": "password", "client_id": "admin-cli", "username": user, "password": password}).encode()
    with urllib.request.urlopen(f"{base.rstrip('/')}/realms/master/protocol/openid-connect/token", form, timeout=30) as response:
        return json.loads(response.read())["access_token"]


def parts(realm_file, api_url, secret, password_grants):
    realm = json.load(open(realm_file, encoding="utf-8"))
    scope = next(s for s in realm["clientScopes"] if s["name"] == "mcp")
    for mapper in scope.get("protocolMappers", []):
        if "included.custom.audience" in mapper.get("config", {}):
            mapper["config"]["included.custom.audience"] = f"{api_url.rstrip('/')}/mcp"
    clients = [c for c in realm["clients"] if c["clientId"] in ("ninja-mcp", "assistant-api")]
    for c in clients:
        if c["clientId"] == "assistant-api":
            c["secret"] = secret
        if c["clientId"] == "ninja-mcp":
            # Keycloak refuses password grants for a client that requires consent: the dev realm's tests need the grant, everyone else the consent screen
            c["directAccessGrantsEnabled"] = password_grants
            c["consentRequired"] = not password_grants
    policies = realm["components"][POLICY_TYPE]
    roles = next(m for m in realm["scopeMappings"] if m.get("clientScope") == "mcp")["roles"]
    return scope, clients, policies, realm["defaultDefaultClientScopes"], realm["defaultOptionalClientScopes"], roles


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--keycloak", required=True, help="Keycloak base URL, e.g. https://auth.chillax.site")
    p.add_argument("--realm", required=True)
    p.add_argument("--realm-file", required=True, help="the realm JSON the stack imports (chillax-realm.json)")
    p.add_argument("--api-url", required=True, help="the public API host, e.g. https://api.chillax.site (the MCP audience is <api-url>/mcp)")
    p.add_argument("--secret", required=True, help="the assistant-api client secret (ASSISTANT_SECRET in the stack's .env)")
    p.add_argument("--admin-user", default="admin")
    p.add_argument("--password-grants", action="store_true", help="keep password grants on ninja-mcp (dev only)")
    args = p.parse_args()
    password = os.environ.get("KEYCLOAK_PASSWORD")
    if not password:
        raise SystemExit("KEYCLOAK_PASSWORD is not set")

    admin = Admin(args.keycloak, args.realm, token(args.keycloak, args.admin_user, password))
    scope, clients, policies, defaults, optionals, roles = parts(args.realm_file, args.api_url, args.secret, args.password_grants)

    # 1. the mcp client scope and its audience mapper
    scopes = {s["name"]: s["id"] for s in admin.get("client-scopes")}
    if "mcp" not in scopes:
        _, headers, _ = admin.call("POST", "client-scopes", scope)
        scopes["mcp"] = headers["Location"].rstrip("/").split("/")[-1]
        print("created client scope mcp")
    else:
        mappers = admin.get(f"client-scopes/{scopes['mcp']}/protocol-mappers/models")
        for wanted in scope["protocolMappers"]:
            existing = next((m for m in mappers if m["name"] == wanted["name"]), None)
            if existing is None:
                admin.call("POST", f"client-scopes/{scopes['mcp']}/protocol-mappers/models", wanted)
                print("added mapper", wanted["name"])
            else:
                admin.call("PUT", f"client-scopes/{scopes['mcp']}/protocol-mappers/models/{existing['id']}", dict(wanted, id=existing["id"]))
                print("updated mapper", wanted["name"])

    # 2. the realm's default scopes for clients that register themselves
    for name in defaults:
        if name in scopes:
            admin.call("PUT", f"default-default-client-scopes/{scopes[name]}")
    for name in optionals:
        if name in scopes:
            admin.call("PUT", f"default-optional-client-scopes/{scopes[name]}")
    print("realm default scopes:", ", ".join(defaults), "| optional:", ", ".join(optionals))

    # 3. the realm roles the mcp scope hands a client that may not see every role
    reps = []
    for role in roles:
        status, _, rep = admin.call("GET", f"roles/{role}", ok=(200, 404))
        if rep:
            reps.append({"id": rep["id"], "name": role})
    if reps:
        admin.call("POST", f"client-scopes/{scopes['mcp']}/scope-mappings/realm", reps)
    print("mcp scope roles:", ", ".join(r["name"] for r in reps))

    # 4. the two clients, created or brought up to the file
    for wanted in clients:
        found = admin.get(f"clients?clientId={urllib.parse.quote(wanted['clientId'])}")
        if not found:
            admin.call("POST", "clients", wanted)
            print("created client", wanted["clientId"])
        else:
            admin.call("PUT", f"clients/{found[0]['id']}", dict(wanted, id=found[0]["id"]))
            print("updated client", wanted["clientId"])

    # 5. the anonymous registration policies
    realm_id = admin.get("")["id"]
    components = admin.get(f"components?type={urllib.parse.quote(POLICY_TYPE)}")
    for wanted in policies:
        existing = next((c for c in components if c["providerId"] == wanted["providerId"] and c.get("subType") == wanted["subType"]), None)
        # The realm file's "subComponents" is import-only; the admin API rejects it on a component
        body = {k: v for k, v in dict(wanted, parentId=realm_id, providerType=POLICY_TYPE).items() if k != "subComponents"}
        if existing is None:
            admin.call("POST", "components", body)
            print("created policy", wanted["subType"], wanted["providerId"])
        else:
            admin.call("PUT", f"components/{existing['id']}", dict(body, id=existing["id"]))
            print("updated policy", wanted["subType"], wanted["providerId"])

    print("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
