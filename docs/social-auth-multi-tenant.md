# Social sign-in across tenants

**Status 2026-09-23:** the native half is built — a stamped tenant's realm now
gets the platform's shared Google and Apple providers, hidden from the login
page, so `client_app`'s token exchange works on any tenant. The browser half
(`kc_idp_hint` in `client_web`) is not: it needs a redirect URI per realm,
registered by hand, and the hub realm below is the way out of that. Until it
exists, the social buttons in the browser app work on Chillax and nowhere
else.

Before this, a stamped realm had no identity providers at all, and Chillax's
provider credentials — still committed to this repository — were the only
ones. `docs/social-authentication-setup.md` is the older guide: still correct
about how to create the provider apps, wrong about tenancy everywhere, because
it was written when Chillax was the product.

## Where things are

| Piece | Path | State |
|---|---|---|
| Chillax realm | `src/Ninja.AppHost/KeycloakConfiguration/realms/chillax-realm.json` | `identityProviders`: `google` (providerId `google`), `apple` (providerId `oidc`), both `enabled`, `trustEmail: true`, `syncMode: IMPORT`; two `hardcoded-user-session-attribute-idp-mapper` mappers stamping `idp` |
| Tenant template | `src/Control.API/Templates/tenant-realm.json` | **no `identityProviders` key** — every stamped realm has none |
| Platform realm | `src/Control.API/Templates/platform-realm.json` | none, and wants none: staff sign in with a password |
| Native client | `src/client_app/lib/core/auth/auth_service.dart` | `_exchangeSocialToken` posts RFC 8693 with `subject_issuer` = `google` \| `apple` |
| Browser client | `src/client_web/src/components/sign-in-options.tsx` | `signinRedirect` with `kc_idp_hint` to skip the Keycloak form |
| Apple secret | `.github/workflows/rotate-apple-secret.yml` | cron every 5 months; `REALM="chillax"` is hardcoded at line 41 |
| Tenant record | `src/Control.API/Model/Tenant.cs` | no social fields; the provisioner has no identity-provider step |

## Two flows, and only one of them has the hard problem

The two clients reach the same providers by different roads, and the roads
have different constraints. Reading them as one thing is what makes this
look simpler than it is.

**Native, `client_app`.** The Google and Apple SDKs run in the app, and what
comes back is exchanged at the tenant's own realm:

```
phone ──native SDK──▶ Google/Apple          (no browser, no redirect)
  │  id_token
  ▼
auth.<domain>/realms/<slug>/protocol/openid-connect/token
      grant_type=…token-exchange, subject_issuer=google
```

Keycloak validates that `id_token` against the `google` provider configured
**in that realm**. So each tenant realm needs the provider present — but only
as a validator. No redirect URI is involved anywhere.

**Browser, `client_web`.** `kc_idp_hint` sends the person through Keycloak's
broker:

```
browser ──▶ auth.<domain>/realms/<slug>/protocol/openid-connect/auth?kc_idp_hint=google
        ──▶ accounts.google.com
        ──▶ auth.<domain>/realms/<slug>/broker/google/endpoint     ← must be pre-registered
```

**The realm slug sits in the redirect path.** Google matches redirect URIs
exactly — no wildcards, no prefixes. Every new tenant is a new URI, and there
is no public API for adding one to a classic OAuth client: it is the Cloud
console, by hand. That is the whole difficulty. It means the naive approach —
one shared provider app, one redirect URI per tenant — puts a human in the
Google console in the middle of provisioning, and self-serve stamping stops
being self-serve.

## What not to do

**A provider app per café.** The consent screen would carry the café's own
name, which is the only real argument for it. Against it: Apple wants a paid
developer account per café, both vendors want domain verification, and the
owner would have to be walked through Google Cloud before they can sell a
coffee. Onboarding friction that large is a different product.

**One shared app, one redirect URI per tenant.** The manual console step
above. There is also a cap on redirect URIs per OAuth client — low enough to
matter at a few hundred tenants, and worth confirming before relying on it —
but the manual step rules this out long before the cap does.

**One realm for all customers.** Social login becomes trivial: one realm, one
redirect URI, nothing per tenant. It also throws away the isolation the rest
of the platform is built on, where a tenant is a realm and a database. A café
would be able to see nothing of another café's customers, but they would
share a user store and a password policy, and impersonation and export would
stop being per-tenant operations. Named here because it is genuinely the
simplest answer and should be rejected deliberately rather than by omission.

## The shape to build

Keep one shared Google/Apple app: the platform is the brand the customer sees
signing in, not the café. Then split the flows, because they want different
things.

```
                     ┌─ native: id_token validated in the tenant's own realm
                     │
phone / browser ─────┤
                     │                        ┌──▶ accounts.google.com
                     └─ browser: tenant realm ─┴──▶ auth.<domain>/realms/<hub>/broker/google/endpoint
                            (OIDC IdP "ninja")          ONE redirect URI, registered once
```

**1. Native stays per-realm.** Every tenant realm carries `google` and `apple`
providers on the *shared* client id, hidden from the login page. They exist so
`subject_issuer` token exchange has something to validate against, and they
cost nothing per tenant: no redirect URI, no console.

They are **not** stamped into `tenant-realm.json`, which was the first plan.
Two things argued against it: the credentials are the platform's and rotate
(Apple's secret expires), so they do not belong in a per-tenant realm file;
and `Templates.Render` fills every `{{slot}}` unconditionally, so a platform
with no social app would stamp providers with an empty client id — a realm
with a provider that cannot work, which is worse than one without. They go on
through the admin API instead, which also covers the realms already imported.

**2. Browser goes through a hub realm.** One realm holds the real providers
with exactly one redirect URI each, registered once and never touched again.
Each tenant realm gets a single OIDC identity provider pointing at the hub.
Provisioning a tenant becomes Keycloak admin API calls only — a client in the
hub realm, an OIDC provider in the tenant realm — which is the shape
`Infra.EnsureAssistantClientsAsync` already established for the `mcp` scope
and the assistant clients, and drops into the same realm step.

The hub can be the existing `ninja` platform realm or a realm of its own. Its
own: the platform realm is where staff sign in, and a customer-facing broker
does not belong in the same blast radius.

What it costs: one more redirect hop, and every tenant's browser login now
depends on the hub realm being up. Users stay separate records per tenant,
which is correct — a customer of one café is not a customer of another.

## What changes where

**Built 2026-09-23** — the native half:

| Change | Where |
|---|---|
| `Platform:Social:{Google,Apple}:{ClientId,ClientSecret}`; a provider is off unless it has both | `src/Control.API/Platform/PlatformOptions.cs` |
| `Templates.SocialProviders` — the hidden `google`/`apple` representations, only the configured ones | `src/Control.API/Platform/Templates.cs` |
| `EnsureSocialProvidersAsync` — idempotent, re-runnable, a no-op with no app; a rotated secret lands on a realm that already has the provider | `src/Control.API/Platform/Infra.cs` |
| Called from the realm step, on a fresh realm and on one that already exists | `src/Control.API/Platform/Provisioner.cs` |

Still to do — the browser half:

| Change | Where |
|---|---|
| The hub realm: real providers, one redirect URI each | new template beside `platform-realm.json` |
| A hub client per tenant and an OIDC provider pointing at it, in the same Ensure | `Infra.cs` |
| Rotate against the hub realm, not `chillax` | `.github/workflows/rotate-apple-secret.yml:41` |
| Bring already-imported realms up, as Keycloak imports a realm once | a script beside `deploy/keycloak-assistant.py` |

## To confirm before building

- ~~**`hideOnLogin`.**~~ Settled: Keycloak 26.4.7 returns it as a top-level
  field on the provider representation, and carries no `hideOnLoginPage`
  inside `config`. Read back from the dev realm's `google` provider through
  the admin API.
- **Apple domain verification.** A wildcard over `*.<platform-domain>` should
  cover every stamped tenant, but a café on its own `CustomerDomain` will not
  be covered. Under the hub design only the hub's host is ever a redirect
  target, which probably makes this a non-issue — worth proving before
  relying on it.
- **The redirect-URI cap** on a Google OAuth client, if the hub is ever not
  used for some flow.
- **`firstBrokerLoginFlowAlias`.** Chillax uses the stock `first broker
  login`; through a hub the tenant realm sees one OIDC provider rather than
  Google directly, so check the account-linking and `trustEmail` behaviour
  end to end rather than assuming it carries over.

## The secrets, separately and sooner

`chillax-realm.json` carries a live Google `clientSecret` and an Apple
`clientSecret` in the repository, with the Google client id
`781709613952-…apps.googleusercontent.com` beside them. That is true today,
independent of anything above, and it is in the history as well as the
working tree. They want rotating and moving to a `{{placeholder}}` the
provisioner fills, the way `{{platformPassword}}` and `ASSISTANT_SECRET`
already work. Do this first: it is smaller than the tenancy work and does not
depend on any of the decisions in it.

## Checks

When it is built, the shape is right if:

- a freshly stamped tenant shows Google and Apple on its login page with no
  console visit during provisioning;
- `client_app` built with `REALM=<new slug>` signs in through the native SDK,
  and the user lands in that tenant's realm and no other;
- the same Google account signing into two tenants produces two unrelated
  users, one per realm;
- re-provisioning an existing tenant adds the providers without disturbing
  the users already in it;
- `rotate-apple-secret.yml` renews one secret and every tenant keeps working.
