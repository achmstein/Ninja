# Front-end architecture plan

Written 2026-11-28 from a read of all ten front-end code bases (six React
apps, four Flutter apps, two shared Dart packages). It says what is there,
what each app should be built as, and the order to get there without stopping
feature work. Every number below was counted in the code on that day.

## The short version

The back end is clean because it has three things: **boundaries** (a service
per business area, API / Domain / Infrastructure inside each), **one way to
do each thing**, and **shared building blocks**. The front ends have the
first only loosely and the other two hardly at all:

- **Nothing is shared on the web.** No workspace, no package. About 40 files
  are copied between two to five apps and have drifted (`brand.ts` by 227
  lines, the branch switcher by 220). The SignalR client is written four
  times. The API clients are generated five times and are out of step (the
  kitchen's Ordering client is 676 lines, the others' 914).
- **The customer app shares nothing on Flutter.** `client_app` imports
  `ninja_app_core` zero times and keeps its own drifted copies (its sign-in
  service differs by 922 lines).
- **Screens do everything.** 76 web files and 49 Flutter files are over 400
  lines; the worst are `places_screen.dart` (2,011), `ticket_screen.dart`
  (1,632) and `pos_web/features/ticket/index.tsx` (1,268). Screens fetch,
  decide, save and navigate in one place.
- **No data layer convention.** On the web 188 component files call the
  server directly, cache keys are typed by hand 183 times, and the cache is
  refreshed from 290 places. On Flutter 35 UI files call repositories
  directly and keep server data in `setState` (499 calls in two apps).
- **Tooling is uneven.** Three web apps have no lint at all; the kitchen web
  has no tests; three Flutter apps run the weakest lint set.

None of this needs a rewrite. It needs the three things the back end has,
brought in one slice at a time.

One thing to fix today, whatever else is decided: `client_app`'s
`core/network/api_client.dart:25` logs every request and response in full,
sign-in token included, in release builds.

## The rules, for every app

These mirror the back end, so one way of thinking covers the whole product.

| Back end | Web (React) | App (Flutter) |
|---|---|---|
| A service per business area | `features/<area>/` | `features/<area>/` |
| API layer (endpoints, contracts) | `routes/` thin + `features/x/components/` | `features/x/presentation/` |
| Application (commands, queries) | `features/x/api/` (queries, mutations) + `hooks/` | `features/x/application/` (notifiers, services) |
| Domain (rules, no I/O) | `features/x/model/` (pure TypeScript) | `features/x/domain/` (immutable models, pure Dart) |
| Infrastructure (EF, HTTP) | `@ninja/api` (generated) + `@ninja/web-core` | `features/x/data/` (repositories) + `ninja_app_core` |
| Integration events | one hub module: event to cache refresh | one realtime binder: event to provider refresh |
| ServiceDefaults | shared packages | shared packages |

1. **Dependencies point one way.** Screens depend on application code,
   application on domain and data. Shared code never imports a feature. A
   feature reaches another only through its public `index`. Checked by lint,
   not by memory.
2. **Server data has one home.** TanStack Query on the web, Riverpod async
   providers on Flutter. Never copied into a store or a widget's state.
3. **A screen draws and forwards.** It reads state and calls one function.
   Rules, requests, timers and navigation decisions live below it.
4. **Rules are pure and tested.** Money, totals, statuses, what may be done
   to a bill: plain functions with unit tests, no framework in them.
5. **One way to fail.** The server's problem code is mapped once to a typed
   failure and one sentence in the user's language.
6. **Small files.** 300 lines is the aim, 400 a lint warning. One public
   component or widget per file.
7. **Written once.** Anything two apps need lives in a package.

## React: the target

### Workspace and packages

npm workspaces rooted at `src/` (the apps already use npm; nothing new to
install). Four packages:

- **`@ninja/api`**: the generated clients, once, per service, with one
  generate script. Beside each, the hand-written part that every app repeats
  today: query options, key factories and the mutations that refresh them.
  Identity and Notifications get generated clients too, so the hand-written
  HTTP services (which duplicate generated ones in `admin_web`) go.
- **`@ninja/web-core`**: what is copied today: the axios client, OIDC config
  and session, the hub client, toast, problem mapping, the i18n engine, brand
  and brand theme, money, phone, currency, business day, cookies, sound,
  install prompt.
- **`@ninja/ui`**: the shadcn primitives for the four staff apps (already the
  same files), and the shared pieces built on them (branch switcher, branch
  gate, brand mark, boot splash, sign-in and callback pages).
  `client_web` keeps its own kit: it is a different product surface.
- **`@ninja/config`**: one ESLint config, one Prettier config, one tsconfig
  base, one Vitest preset.

### Inside an app

```
src/
  app/            providers, router, global error handling
  routes/         file routes: validate search, guard, mount a feature. Nothing else
  features/
    <area>/
      api/        queries.ts, mutations.ts (the only place that talks to @ninja/api)
      model/      pure rules and types, with their tests; client stores of this area
      hooks/      use-<thing>.ts: joins api + model for a component
      components/ what it draws
      index.ts    the area's public face
  shared/         ui/, lib/, stores/ that no single area owns
```

### The patterns

- **Data**: a component calls `useQuery(ticketQueries.detail(id))`, never the
  generated function. Keys come from the generated key builders. A mutation
  refreshes what it changes inside `mutations.ts`. The hub is one table of
  "this event refreshes these keys". The `api-version` parameter is dropped
  from call sites (299 of them): the client already sends it.
- **State**: Query for server data; zustand only for what the server does not
  hold (cart, open panels, device settings), kept in the area's `model/`.
  The copies of server data in stores (currency, phone rule, the order
  status snapshot) become selectors over the query cache.
- **Logic out of components**: each large component is split into a hook that
  decides (`useSettle`, as `use-refund.ts` already does well) and components
  that draw. That one existing hook is the pattern to copy.
- **Forms**: `react-hook-form` with a `zod` schema for any form of three or
  more fields, in `admin_web` and `control_web` first (790 `useState` calls
  between them are mostly form fields).
- **Routing**: guards in `beforeLoad` of a layout route, not at render.
  `client_web` gets a signed-in layout instead of a check in each page, and
  its 3,074 lines of page logic move into features.
- **Errors**: one `problem.ts`; a global handler on the query cache; an error
  boundary per route and per independent panel; `client_web` gets both,
  having neither today.
- **i18n**: keep the typed dictionary (no library needed), move its engine to
  `web-core`, split each app's dictionary by feature, and keep the ARB files
  as the one source where a web app mirrors a Flutter app.
- **Tests**: unit tests stay for `model/`. Add component tests (Testing
  Library with a mocked server) for the flows that carry money: settle,
  refund, place order, pay. One Playwright smoke run per app. Looks stay the
  owner's to judge.
- **Tooling**: ESLint with boundary rules, `max-lines`, hooks and query
  plugins in all six; Prettier; knip for dead code; LF line endings fixed in
  `.gitattributes` (852 of 1,234 files are CRLF today, which makes every diff
  noisy); `site_web` added to pull-request checks.

## Flutter: the target

### Packages

- **`ninja_app_core`** (exists): sign-in, API client, hub client, brand,
  branch, locale, plus what is missing: a typed failure, a key-value store,
  money / phone / bidi helpers, the strict lint set.
- **`ninja_models`** (new): the models two apps parse from the same server
  answer: `Order`, `Place` / `Stay`, `DeliveryOrder`, `Branch`,
  `LocalizedText`. They differ by 400 to 700 lines between apps today.
- **`ninja_staff_ui`** (new): what the till, kitchen and rider apps copy:
  connect screen, sign-in screen, branch switcher, brand mark, connection
  rows, no-branch screen, kiosk service, kitchen printing.
- **`ninja_printing`** (exists).

`client_app` moves onto `ninja_app_core`. It is the single largest piece of
duplicated code in the product.

### Inside an app

```
lib/
  app/                 app widget, router, realtime binder, start-up
  core/                only what no feature owns; never imports a feature
  features/
    <area>/
      domain/          immutable models, pure rules
      data/            <area>_repository.dart: interface + API implementation
      application/     notifiers and services: no BuildContext, no widgets
      presentation/    screens, widgets, dialogs
```

### The patterns

- **State**: `AsyncNotifier` for anything from the server; `Notifier` for
  client state; `setState` only for what lives and dies with one widget (a
  text field, an animation). Polling and timers live in notifiers with
  `ref.onDispose`, not in screens.
- **Logic out of State classes**: the four mixins on the sale pad (926 lines
  that place orders, fall back to offline and navigate) become services in
  `application/`: `SaleChargeService`, `SettleService`, `CheckoutService`.
  A service returns a result; the screen decides where to go next.
- **Repositories**: named for what they are (`tickets_repository.dart`, not
  `_service`), always an interface with an API class, the only code that
  touches the API client. The direct calls from providers and widgets (6
  places) and from UI files (35) go through them.
- **Models**: `freezed` with `json_serializable` for models (equality,
  `copyWith`, safe parsing for free; 269 hand-written `fromJson` today, with
  almost no equality). Providers stay hand-written: Riverpod 3's notifiers
  are clear enough, and it keeps generated code to one kind. The unused
  generator packages in `client_app` are removed or put to this use.
- **Errors**: one sealed `AppFailure` (offline, signed out, the server's
  problem code, unknown) produced by the API client. Three `describeError`
  copies and 101 bare `catch (_)` go.
- **Realtime**: a binder per app that maps hub events to provider refreshes,
  out of `app.dart` (140 lines of it in the till).
- **Persistence**: one `KeyValueStore` provider over SharedPreferences,
  loaded once and overridable in tests. The module-level globals seeded by
  nine `initialize*()` calls in the till become providers. Offline sales and
  sending become a feature with `data/` and `application/`, out of `core/`.
- **Lints**: the strict set the rider app and the core already pass, for all
  six packages, plus `riverpod_lint`.
- **Tests**: shared fakes in `test/support` (the till redefines
  `TicketsRepository` nine times), `mocktail`, widget tests on the money
  flows, one `integration_test` smoke run for a sale on the till.

## Each app

| App | Size | What it should be | The work, biggest first |
|---|---|---|---|
| `admin_web` | 77.7k lines, 29 features | Feature slices, forms on react-hook-form | Even out feature internals (hooks in four places, services in three shapes); drop the hand-written Accounts and Loyalty clients; split the 8 files over 800 lines; merge `promos`/`promotions` and `assist`/`assistant`; 153 feature-to-feature imports through `index` |
| `pos_web` | 32.3k, 18 features | Feature slices, model-heavy (money) | Lint from zero; split `ticket/index.tsx` (1,268) and `phone-delivery-form.tsx` (1,132) into hook + parts; offline and sending as proper features; share `places` and order actions with `admin_web` |
| `client_web` | 31.8k, no features | Feature slices; own UI kit | Move `components/<area>` + `lib/` (89 mixed entries) into features; logic out of 16 route files; signed-in layout; error handling it lacks; server snapshots out of stores |
| `control_web` | 19.6k, 2 features | Feature slices, forms | Lint; split the `tenants` files (5 over 500 lines) by tab; forms |
| `kds_web` | 4.5k, 1 feature | Already close | Lint, a test runner and first tests; take shared code from packages; regenerate its stale client |
| `site_web` | 1.6k | Leave as is | Add to pull-request checks |
| `pos_app` | 41.6k | Layered features | Mixins to services; `ticket`+`tickets` and `receipt`+`receipts` merged; feature code out of `core/` (78 imports the wrong way); split the 5 files over 1,000 lines; storage and globals |
| `client_app` | 38.4k | Layered features on the shared core | Onto `ninja_app_core`; notifiers out of `services/` (44 providers there); split `places_screen.dart` (2,011, 24 classes) and `pay_sheet.dart`; typed failures |
| `kds_app` | 4.3k | Already close | Strict lints; shared staff UI |
| `rider_app` | 4.6k | Already close | Repository interface; shared staff UI and models |

## The order

Each step ships on its own and leaves the apps working. Features keep being
built throughout; from step 2 on, new code follows the target and old code is
moved when it is touched, plus the named clean-ups.

**Step 0. Guard rails** (days). Stop the token logging in `client_app`.
LF line endings in one commit. The shared ESLint and Prettier configs in all
six web apps and the strict lint set in all Flutter packages, new rules as
warnings first, with the count of warnings recorded so it can only go down.
Pull-request checks run all of it.

**Step 1. Share what is already the same** (1 to 2 weeks). The web workspace
and the four packages, starting with the files that are identical today, then
the drifted ones merged one at a time. One generated API package.
`client_app` onto `ninja_app_core`. `ninja_staff_ui` from the three staff
apps' identical screens. No behaviour changes; this step only removes copies.

**Step 2. The data layer** (1 to 2 weeks). Query options, keys and mutations
per feature on the web; the hub as one table. On Flutter the typed failure,
repositories renamed and completed, the key-value store. After this step no
screen talks to the server directly.

**Step 3. Features, worst first** (ongoing, one area per release). The order
is by money and by size: the till's ticket and settle on both platforms, then
sale, then the customer's order and pay, then places, then the back office's
largest pages. Each area: tests around its behaviour first, rules into
`model/` or `domain/`, logic into hooks or services, the screen split.

**Step 4. Forms, models, state** (alongside step 3). react-hook-form in the
back office and the console as forms are touched; freezed models as models
are touched, the shared ones first; server copies out of stores.

**Step 5. Tests that protect money** (alongside). Component and widget tests
on settle, refund, place order and pay; one end-to-end smoke run per app.

## How we will know

Counted by a script in CI, each expected to fall to the target:

| Measure | Today | Target |
|---|---|---|
| Files copied between web apps | about 40 | 0 |
| `ninja_app_core` imports in `client_app` | 0 | every core concern |
| Web components calling the server directly | 188 files | 0 |
| Hand-typed cache keys | 183 | 0 |
| Flutter UI files calling a repository | 35 | 0 |
| Files over 400 lines | 125 | under 15, each with a reason |
| Imports from shared code into a feature | 143+ | 0 |
| Web apps with lint / with tests | 3 of 6 / 5 of 6 | 6 / 6 |
| Flutter packages on strict lints | 2 of 6 | 6 |

## What I need from the owner

1. **Go for steps 0 and 1.** They change no behaviour and no screen.
2. **Codegen for Flutter models (freezed).** It adds a build step
   (`build_runner`) to the apps' builds. My advice is yes.
3. **A release without new features for step 2**, or accept it spread over
   three or four releases. My advice: spread it.
4. **`main` first.** The till's trial branch (`one-order-screen`) holds weeks
   of work that is not on `main`. Restructuring two diverging branches doubles
   the cost: merge the trial, or decide it is the new `main`, before step 1.
