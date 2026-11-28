# The customers' account by phone

A Keycloak extension: a customer proves a phone number is theirs with a code
sent to it, and that number is their account. No password, no email. It is a
step of Keycloak's own sign-in and ends in Keycloak's ordinary tokens.

- **The web** (`client-web`): the app sends the customer to sign in with their
  number as `login_hint`, in the international form (`+201012345678`). Keycloak
  sends the code, shows the page that asks for it (the business's theme), and
  for a number that is new asks the name (or takes `nj_first` / `nj_last` when
  the app passed what the customer gave for their order). Flow: `customer
  browser`. With no number named, or no way to send a code, the step stands
  aside and the ordinary sign-in page shows.
- **The app** (`mobile-app`): signs in on its own screens, by the token
  endpoint. `phone` alone sends the code (`phone_code_sent`); `phone` and
  `code` sign in, with `first_name` and `last_name` for a new number
  (`phone_name_needed` asks for them, the code staying good). Flow: `customer
  direct grant`.

Both flows are made in every realm that has those clients, when Keycloak
starts and when a realm is created (`PhoneFlowSetup`).

## The rules (`Phone.java`)

Six digits, good for five minutes, five wrong tries at a code, a minute
between two sendings, five sendings to a number in an hour. Codes are kept in
Keycloak's single-use store. An account belongs to a number only when the
number was proved for it (`PhoneAccounts`): an account that merely has the
number typed in its profile is not signed in to.

## How codes are sent (`CodeSender.java`)

Set on the Keycloak container (`deploy/platform/docker-compose.yml`):

| `NINJA_PHONE_SENDER` | |
| --- | --- |
| `none` (the default) | The phone is never offered; every sign-in is as before. |
| `test` | Nothing is sent. The numbers in `NINJA_PHONE_TEST_NUMBERS` (comma separated, international form) take the six digit `NINJA_PHONE_TEST_CODE`; no other number is ever given a code. |

A real sender (a text message, WhatsApp) is one more implementation of
`CodeSender`, chosen by the same setting. Before one goes live, delete the
accounts the test numbers made: a test number may be somebody's real one.

## Building and trying it

```
docker run --rm -v "$PWD:/work" -w /work maven:3.9-eclipse-temurin-17 mvn -q -B package
```

Run `quay.io/keycloak/keycloak:26.4 start-dev --import-realm` with the jar in
`/opt/keycloak/providers`, the ninja theme and a realm mounted, and the three
variables set. `keycloak.version` in the pom follows the server's image.
`test/sign-in.py` then drives both ways of signing in against it.
