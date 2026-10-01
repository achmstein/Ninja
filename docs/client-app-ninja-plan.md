# Customer app (Flutter) in the web's Ninja style — plan and handoff

Written 2026-09-30 to continue on another machine. The goal: `src/client_app` (the Flutter customer app, web build included) looks and behaves like `src/client_web`, which wears one style, Ninja. Decisions already taken with the owner:

- **The web's shell for every business**: top bar, floating dock with tabs, the order as a tray inside the dock, dark slab sheets. The business's `theme.layout.menuItem` still picks how dishes show (`row`, `card`, `compact`, `hero`, `deck`, `tiles`), exactly as on the web; every other old style part is gone.
- **Forui (the Flutter shadcn port) is removed.** Own widgets in `lib/core/ui/`, Lucide icons (`lucide_icons_flutter`, same names as the web's `lucide-react`).
- **The menu matches the web**: no search, no hearts on photos, no offers strip, no long-press ordering; holding a dish puts it in the tray.

Phases 1, 2 and 3 are committed, and so are the gaps found along the way (see below, updated 2026-10-02). What is left is at the end of **Remaining**.

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

### Phase 3 — the pages (web: `client_web/src/components/ninja/page/`) — done

The page kit is in `lib/core/ui/ninja_page.dart` (`NinjaPage` with the shrinking title and its own back bar when pushed, `PageTitle`, `RiseGroup`, `PointsRing`, `pointsAmber`), and every page is on it: **You** (slab hero, ring, tier chip, tiles), **Loyalty** (148 px ring on the slab, recent activity; `TierChip`/`tierName` in `loyalty_screen.dart`), **Transactions** (balance slab, ledger panel), **Bills** (one list: open bills as a stack of rounds, rounds on their way on top of their bill, waiting/turned-down orders, on-your-tab, history by month; `bill_tile.dart`, `placeRounds`/`PendingRound`), **Stays**, **Settings**, **Favorites**, **Receipt** (the printed slip), **Places** (`NinjaPage` "Book", web `place-card.tsx` cards, booking inside the card via `widgets/hold_form.dart`, a hold as the web's reservation panel `widgets/reservation_panel.dart`, a running clock as `StayBanner` opening `showRoomSheet`), **Register** / **Claim** / sign-in pills, empty states via `EmptyState`. `AppTheme`, `BalanceCard` and `LoyaltyCard` are gone.

Left from phase 3:
- The web's "forming" bill for rounds with no open bill shows on the dock's bills sheet (`OpenBills`) but the Bills page still lists those as a waiting group.
- Places: the card opening into the reservation panel (the web's shared-layout morph).
- The expandable receipt under a tab charge on Transactions (needs `ticketId` on `AccountTransaction`).
- Loyalty / Bills / Stays / Places have not been looked at with live data (the local stack was down); the owner checks them.

### Gaps from phases 1–2 — done

| Gap | Where it landed |
|---|---|
| **Dish view over the dock**: a dish opens on the frame's own layer, over the page, its bar and the categories, under the dock, so the tray stays in reach and an added dish lands on it; back or another tab closes it first | `lib/core/shell/dish_layer.dart` (`DishLayer`, `DishNavigator`, `dishOpen`), `main_scaffold.dart` |
| **Top bar** scrolls away with a list and comes back on the way up (`topBarAt`, `TopBarOnScroll`, `TopBarSlot`); past the deck's first card it goes up by its own height (0.3 s, easeOut) and comes back on the first card. The deck swallows its scroll notifications and drives the dock's tuck and `deckCompactProvider` itself (`null` when no cards are on screen, so the page's scroll has the bar; the two never fight) | `lib/core/shell/{top_bar,deck_compact,tuck}.dart`, `menu_screen.dart` |
| **Deck extras**: pinch out/in (`pinchIntent`, 0.78), photo flights between cards and tiles on zoom, compact chrome past the first card, first-visit cues (swipe, pinch, hold to add) | `features/menu/widgets/{pinch,zoom_flight,deck}.dart`, `lib/core/ui/gesture_hint.dart` |
| **One cue on screen at a time** across menu and tray: one book (`ninja-style-hints`, as the web; the tray's old `ninja-hint-tray` key is read once into it), `cueOnScreen`; the deck's cues wait while the order or a dish is open (`orderOpenProvider`, `dishOpen`) | `gesture_hint.dart`, `features/cart/widgets/tray_hint.dart`, `tray.dart` |
| **Tray extras**: seat flights (circles from the dock to their rows following the finger), the one-time peek + "drag up" cue on the first dish | `features/cart/widgets/{tray_seats,tray_hint}.dart` |
| **Goes-well-with flight**: a suggestion added from the dish view flies from its card's photo | `dish_view.dart` |
| **Dock row sheet**: the bill / table / room open as a slab sheet out of the dock (`showDockBills`, request tiles, `showRoomSheet`) | `lib/core/shell/dock_bill.dart`, `bills/widgets/open_bills.dart`, `service_request/widgets/request_tiles.dart` |
| **Visit tab countdown** while a place is held | `lib/core/shell/live_visit.dart` |
| **`/item/{id}` deep link** opens the menu with the dish over it, or says it is not on the menu | `features/menu/dish_link.dart`, `app_router.dart` |
| **Hold ring** on a deck card (hold to add) | `features/menu/widgets/deck.dart` |
| **Old helpers**: `app_theme.dart` deleted, its colours on `NinjaColors` | |
| **Hard-coded colours**: statuses map to `NinjaColors.success/warning/error` and their web neighbours added beside them (`successSolid/Ink/OnSlab`, `warningSolid/Ink/InkDeep/OnSlab/OnSlabPale`, `errorSolid/OnSlab`, `otherRate`), the rating's stars to amber-400 over faint muted ink as on the web, spinners on buttons to `primaryForeground`. Left on purpose: the receipt paper (black on white), white/black on photos and their shades, the camera screens, white on a solid status fill, shadows' black with alpha | `lib/core/theme/ninja_theme.dart` |

**The island**: the web's island no longer shows a sticky live order face since web commit 34750373 (the order lives in the dock), so the app matches that: Sent and Confirmed are the dock row's quiet change, and only an order turned down opens the island for a moment.

### Still open

- **Neutral brand's Order button**: slate-900 primary on the slate-950 slab is hard to see; the web has the same issue — an open decision for both.
- `Layout` still parses the six-style era's `categories` and `header` parts (`lib/core/brand/styles.dart`, only read by `test/core/brand/styles_test.dart`); `buttons`, `surface` and `density` are still used by the dishes.
- The phase 3 leftovers above.

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
