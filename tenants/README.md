# Tenant records for the native apps

One file per café that gets native apps (D4 in `docs/ninja-plan.md`): what a
Flutter build of client_app, pos_app or kds_app is told about the stack it
talks to. The code carries no tenant of its own; a release build without a
record fails at first use and says which key is missing.

```
flutter build apk --release --dart-define-from-file=../../tenants/chillax.json
```

`mobile-deploy.yml` passes the record named by its `tenant` input to every
build. In debug, hosts default to the Aspire AppHost on the dev machine and
only the realm needs saying: `flutter run --dart-define=REALM=chillax`.

| Key | What |
|---|---|
| `API_URL` | The stack's gateway, `https://api.{slug}.{domain}` on the platform |
| `AUTH_URL` | Keycloak's public host, `https://auth.{domain}` |
| `REALM` | The tenant's realm, `{slug}` on the platform |
| `GOOGLE_SERVER_CLIENT_ID` | client_app only: the Web Client ID the realm's Google identity provider uses; leave out for no Google sign-in |

Not here yet, because the native folders still carry tenant one's: the
application ids and redirect schemes (`REDIRECT_SCHEME` is read, defaulting
to what the manifests declare), display names, launcher icons, splash,
App Links domain, Firebase config and store credentials. Those are the
flavor work of Phase 5.
