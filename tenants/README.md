# Tenant records for the native apps

One file per café whose customer app is built natively (D4 in
`docs/ninja-plan.md`): what a Flutter build of client_app is told about the
stack it talks to. The code carries no tenant of its own; a release build
without a record fails at first use and says which key is missing.

```
flutter build apk --release --dart-define-from-file=../../tenants/chillax.json
```

`mobile-deploy.yml` passes the record named by its `tenant` input to the
customer app's builds. In debug, hosts default to the Aspire AppHost on the
dev machine and only the realm needs saying: `flutter run --dart-define=REALM=chillax`.

The till (`pos_app`) and the kitchen display (`kds_app`) take no record:
one generic build of each serves every café, and a tablet connects to its
own café from inside the app (the QR code on the admin's Apps page, or the
café's address typed). A record still pins them to one stack when that is
wanted, and then they never ask.

| Key | What |
|---|---|
| `API_URL` | The stack's gateway, `https://api.{slug}.{domain}` on the platform |
| `AUTH_URL` | Keycloak's public host, `https://auth.{domain}` |
| `REALM` | The tenant's realm, `{slug}` on the platform |
| `GOOGLE_SERVER_CLIENT_ID` | client_app only: the Web Client ID the realm's Google identity provider uses; leave out for no Google sign-in |

Not here yet, because the customer app's native folders still carry tenant
one's: the application id and redirect scheme (`REDIRECT_SCHEME` is read,
defaulting to what the manifest declares), display name, launcher icon,
splash, App Links domain, Firebase config and store credentials. Those are
the flavor work of Phase 5.
