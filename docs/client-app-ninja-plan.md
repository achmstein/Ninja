# Customer app (Flutter) in the web's Ninja style — plan and handoff

Written 2026-09-30 to continue on another machine. The goal: `src/client_app` (the Flutter customer app, web build included) looks and behaves like `src/client_web`, which wears one style, Ninja. Decisions already taken with the owner:

- **The web's shell for every business**: top bar, floating dock with tabs, the order as a tray inside the dock, dark slab sheets. The business's `theme.layout.menuItem` still picks how dishes show (`row`, `card`, `compact`, `hero`, `deck`, `tiles`), exactly as on the web; every other old style part is gone.
- **Forui (the Flutter shadcn port) is removed.** Own widgets in `lib/core/ui/`, Lucide icons (`lucide_icons_flutter`, same names as the web's `lucide-react`).
- **The menu matches the web**: no search, no hearts on photos, no offers strip, no long-press ordering; holding a dish puts it in the tray.

Phases 1 and 2 are committed (see below). Phase 3 and a list of smaller gaps remain.

---

## Done

### Phase 1 — foundation and shell

| What | Where |
|---|---|
| Theme: the web's slate palette light/dark (values from `client_web/src/styles/theme.css`), the slab and its ink, type scale (title/headline/name/body/note/caption/micro/display), radii, shadows; read as `context.theme` (`.colors`, `.typography`, `.radius`, `.surface()`) | `lib/core/theme/ninja_theme.dart` |
| Brand seeds → colours, the port of `brand-theme.ts` `brandColors` (surface, primary, accent, **slab**, `theme.slab == 'neutral'`); OKLCH gamut-mapped by lowering chroma like a browser does | `lib/core/brand/brand_theme.dart` |
| One style, Ninja (`styles.ts` port): headings 800 × 1.1, −0.02em; defaults radius xl, Plus Jakarta Sans / IBM Plex Sans Arabic | `lib/core/brand/styles.dart`, `brand_style.dart` |
| Material theme per scheme with `NinjaTheme` on it; `NinjaSchemes` + `DarkScope` for always-dark parts; `SlabInk` re-inks a subtree for the slab | `ninja_theme.dart`, `lib/core/ui/parts.dart`, `lib/main.dart` |
| Motion constants (same numbers as `client_web/src/lib/motion.ts` and pos/kds): `spring`, `springSoft`, `springOpen`, `springTray`, liquid pill edges; `BlurSwap`, `RollingNumber`, `SpringCurve` | `lib/core/motion/` |
| UI kit: `NinjaButton`/`NinjaIconButton` (pills), `NinjaField`, `NinjaBadge`, `NinjaAlert`, `NinjaSwitch`, `NinjaAvatar`, `Segment`, `NinjaTabs`, `TileGroup`/`NinjaTile`, `Panel`, `SlabCard`, `SectionLabel`, `EmptyState`, `PageHeader`/`HeaderAction`, `Pressable`, `LiquidSlots`, `LiquidChips`, `showNinjaSheet` + `NinjaDialog` (dark slab sheet), island toast (`showIsland`, `IslandHost`) | `lib/core/ui/` (barrel `ui.dart`) |
| Shell: top bar (wordmark, branch chip, scan), floating dock (tabs Menu / Places / You with the liquid pill; tucks on scroll-down via the page's scroll notifications), the dock's row (tray on the menu; else the order on its way / table / room / bill) | `lib/core/widgets/main_scaffold.dart`, `lib/core/shell/{top_bar,tuck,dock_bill}.dart` |
| The tray replaces `/cart`: thumbnails, count, rolling total, Order → Place order; the order sheet rises out of the dock and follows the finger; swipe-to-remove with Undo on the island; the one suggestion (CartNudge); note / promo / points pills | `lib/features/cart/widgets/{tray,tray_extras,tray_model}.dart`, `services/checkout_flow.dart` (`placeTrayOrder`, `orderNoteProvider`, `liveOrderProvider`) |
| Bills moved from a tab to a page pushed from You (`/bills`) | `lib/core/router/app_router.dart`, `features/bills/screens/bills_screen.dart` |
| Sheets moved onto the slab: profile gate, branch picker, settings (update profile, change password), about, every former Forui dialog | various |

### Phase 2 — the menu

| What | Where |
|---|---|
| List menu (`list/menu-grid.tsx` port): large title, categories only (the popular pseudo-category `id -1` is dropped), dishes per style, rise-in; the category chips above the dock with scroll-spy and jump | `lib/features/menu/screens/menu_screen.dart` |
| Dishes (`list/row.tsx`, `photo-tile.tsx`, `compact-row.tsx`, `hero-card.tsx`, `dish-parts.tsx`): price pill, round plus → stepper, chevron when something must be chosen; tap opens, hold quick-adds | `lib/features/menu/widgets/dish.dart` (`quickAdd`, `openDish`, `dishFor`) |
| Full-screen dish view (`tune.tsx`): photo flight from the dish into the banner and back (`DishPhotos` registry hides the source), questions as pills (required first, "Choose X" + glow), goes-well-with, note, qty, add with rolling total; on Add the view fades and the banner photo flies to the tray | `lib/features/menu/widgets/dish_view.dart` |
| Fly to tray (`flights.tsx`): two-leg arc, clip closes to a circle, lands on the tray's first thumbnail, tray bumps; no layer mounted (tests) → lands at once | `lib/features/cart/widgets/tray_flights.dart` |
| Deck (`deck/deck.tsx`): columns side by side (usuals first), vertical snap with 44 px peek, "Up next" card auto-advances, hold ring; zoom out to tiles and back via chips/button; tiles layout | `lib/features/menu/widgets/deck.dart` |
| Removed: `cart_screen.dart`, `item_customization_sheet.dart`, `goes_well_with.dart` | |

Tests: 114 passing (`flutter test` in `src/client_app`), incl. ported `tray-model` and `use-tuck` tests, tray/dish/deck widget tests. `flutter analyze` clean.

---

## Remaining

### Phase 3 — the pages (web: `client_web/src/components/ninja/page/`)

1. **Page title that shrinks and fades** (`page.tsx` `PageTitle`): large title, opacity `1 − y/44`, scale 1 → 0.92 over 44 px of scroll, origin at the start edge; a new title blur-swaps. Make a `NinjaPage` scaffold (title, subtitle, action, back) used by every tab/pushed page; replace today's `PageHeader` uses (`profile`, `places`, `bills`, `stays`, `favorites`, `loyalty`, `transactions`, `receipt`, `settings`, menu's `_Head`).
2. **You** (`routes/profile.tsx`): the `SlabCard` hero (who you are, points ring 96 px, balance), then `TileGroup`s. Today it is the old avatar + `BalanceCard` + `LoyaltyCard` (metallic tier gradients) — restyle to the slab.
3. **PointsRing** (`page/points-ring.tsx`): 8 px stroke amber-400 (`0xFFFBBF24`) over a 14 % track, rolling number in the middle; 148 px on Loyalty, 96 px on You.
4. **Loyalty, Account (transactions), Bills, Stays, Settings, Receipts**: the web's layouts with `Panel` / `SlabCard` / `TileGroup` / `SectionLabel` / `Segment` (Bills and Stays already use `NinjaTabs`). Receipts keep their printed slip.
5. **Places** (`routes/places.tsx`, `components/places/*`): room list, reservation sheet, active-stay view; the visit tab's live countdown ring in the dock (`nav.tsx` `LiveVisit`).
6. **Empty states** everywhere via `EmptyState` (floating 80 px tile).
7. **Login / register / claim** (`components/auth/sign-in-options.tsx`): full pills for Google (outline), Apple (`foreground` fill), Email (secondary), "or" divider.

### Gaps left in phases 1–2 (in rough priority)

- **Dish view over the dock**: web keeps the dock/tray visible under an open dish (the dish layer is inside the menu, above the categories, below the dock). Flutter pushes `DishRoute` on the root navigator, covering the dock. Moving it into the shell's stack (below the dock) would match and let the Add flight land on a visible tray.
- **Top bar scrolls away** with the page (web `NinjaTopBar` translates up with the scroller; past the deck's first card it goes up). Flutter's top bar is fixed.
- **Deck extras**: pinch to zoom out/in (`pinchIntent`, 0.78), photo flights between cards and tiles on zoom (`planFlight`), the chrome going compact past the first card, first-visit gesture hints (`components/ninja/gestures/`).
- **Tray extras**: the "seat flights" (thumbnails flying from the dock to their rows as the sheet opens), the one-time peek + "drag up" hint on the first dish.
- **Goes-well-with flight**: a suggestion added from the dish view goes in without a flight (needs the card's rect).
- **Island live face**: the web island also shows the live order ("Sent · #12") as a sticky face (`lib/island.ts`, `order-pill.ts`); Flutter shows the stage in the dock row only.
- **Dock row sheet**: the web opens the bill / table / room as a sheet out of the dock (`dock-bill.tsx`); Flutter pushes `/bills`, opens the table-requests sheet, or goes to Places.
- **Neutral brand's Order button**: slate-900 primary on the slate-950 slab is hard to see (the web has the same issue — decide once for both).
- **Old helpers**: `lib/core/theme/app_theme.dart` still holds zinc-era constants used for a few icon colours; swap for `NinjaColors.success/warning/error` and delete. `BrandStyle` still carries the unused `categories/header/buttons/surface/density` parts from the six-style era; trim with the tests in `test/features/menu/menu_item_variants_test.dart`.
- **Hard-coded colours** outside the theme (about 16 `Color(0x…)` and 20 `Colors.*` uses: notice card amber, rating widget, transactions, balance card, loyalty tier gradients) — revisit during phase 3.

---

## How to work on it

### Build, test, run

```bash
cd src/client_app
flutter pub get
flutter analyze
flutter test                                   # rewrites windows/linux generated_plugin files with LF churn:
git checkout -- windows/flutter linux/flutter  # ...so revert those after every test/pub run
```

Seeing it for real against the local dev stack (AppHost running; mobile BFF on `127.0.0.1:5000`, Keycloak on `:8080`):

```bash
flutter build web --release --no-tree-shake-icons \
  --dart-define=API_URL=http://localhost:5000 --dart-define=AUTH_URL=http://localhost:8080 \
  --dart-define=REALM=chillax --dart-define=GOOGLE_SERVER_CLIENT_ID=none -o <scratch>/web
python -m http.server 5199 --bind 127.0.0.1   # in <scratch>/web
```

- The BFF sends no CORS headers: drive it with Playwright (repo root `node_modules`; put the script under the repo, e.g. a temp folder in `marketing/explainer/capture/`, delete after) launched with `--disable-web-security --disable-site-isolation-trials`, viewport 390×844.
- Sign in as `tester@chillax.site` / `Tester123$` (the bare username is rejected); Flutter web is one canvas, so click coordinates and type. Save `storageState` to skip login next time.
- Try another menu style by routing `GET **/api/tenant**` and setting `theme.layout.menuItem`.
- A Flutter web deck/scroll view ignores mouse drags unless `ScrollConfiguration` allows them (the deck does).
- `Page.captureScreenshot` over CDP gives ~10 fps — enough to see flights.

### Gotchas learned

- **Errors are invisible on web**: `main.dart` sends `FlutterError` and zone errors to Crashlytics only, so a broken frame is a white page with nothing in the console. Temporarily make both hooks `print`; if still silent, bisect with a `Uri.base.queryParameters['hide']` switch in one build.
- **A `Stack` whose other children are all positioned collapses to the size of a non-positioned `SizedBox.shrink()`** — the shell's stack uses `fit: StackFit.expand` for that reason; keep it.
- **Line endings**: most Dart files are CRLF, a few LF, ARBs LF; `pubspec.yaml` has a UTF-8 BOM (keep it — `flutter pub add` strips it). Edit with a script that detects per file; new Dart files are CRLF.
- **Localisation**: add keys to `lib/l10n/app_en.arb`, `app_ar.arb` (Egyptian) and, where the wording differs, `app_ar_001.arb` (MSA); copy the web's wording from `client_web/src/lib/i18n.ts` / `i18n.ar-standard.ts`; then `flutter gen-l10n` (the generated files are committed).
- **Widget tests**: `AnimatedSwitcher`/`BlurSwap` need a frame after their duration (or `pumpAndSettle`) before the old child is gone; the island times itself in `IslandHost` so no timer outlives a test.
- The web is the source of truth: when in doubt read the matching file in `client_web/src/components/` and port its numbers.
