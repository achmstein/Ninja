# Ninja style — what's next

The Ninja style (built as "Counter", renamed to Ninja on 2026-09-26) is the motion-first customer menu in `src/client_web/src/components/ninja/`: a swipeable deck of dish cards, zoom out to a grid of the whole menu, cards that open in place into their options, a tray the dishes fly into, hold to order, and the order status pill. Motion tokens live in `src/client_web/src/lib/motion.ts`; the same values are used by the till and kitchen apps (`lib/core/motion/`). Try it locally at `http://localhost:5174/?layout=ninja` in a phone-size window.

## Plan: the menu, the live bill and notifications (2026-09-27)

Everything up to `50602f21` is committed on `main` locally, not pushed; the deploy is still on hold. Each step below gets its own commit, so it can be checked on the local stack before the next one starts. The motion follows the owner's prompt and the menu's own open (shared `layoutId`, `springOpen`, no crossfade where contents differ, transform and opacity only, nothing covering the card a view closes back into). The shared parts are in `components/motion/` and `lib/motion.ts`.

### 1. Adding from the grid (and the deck): one image, not two

Today, Add closes the options view by morphing its photo back into the tile, while a copy of the photo flies to the tray. Two images move at once, and one of them squeezes into a small tile inside a scrolling grid.

- On Add, the photo itself flies to the tray; it does not go back to the tile.
- The options view folds away without its photo, its content leaving first.
- The tile fades back in at its place as the photo lands.
- Closing without adding keeps today's morph back into the card.
- The same for the deck.

### 2. The menu, reviewed for best practice

- `ninja-home.tsx` (386 lines) and `tray.tsx` (681) split into hooks and parts: the deck state, the flights, the tray row, the order sheet and the seat flights.
- Every spring and duration comes from `lib/motion.ts`; no local numbers.
- What animates is only transform and opacity. The press rings stop animating an SVG stroke (a known gap).
- The top bar's backdrop blur over moving photos is checked on a mid-range phone, and replaced with a plain fade if it costs frames.

### 3. The live bill on the menu

While a bill is open, it is part of the menu, not a tab away:

- **The dock's row shows the bill.** When the tray is empty, the row shows the bill: the place, the rounds, and the total rolling. When a dish is added, the tray takes the row over with a blur swap, and the bill comes back once the tray is empty again.
- **The bill opens out of the dock.** Pulling up or tapping opens it as the dock's sheet: the stack of rounds, and Pay and Split, as on the Bills card today.
- **An order lands on it.** A held order's photos fly from the tray into the bill row, where they become a faint "waiting" round. When the till confirms, the round turns solid and the total rolls up.
- **The pill stays.** The order pill at the top keeps the kitchen's side (preparing, ready); the bill row keeps the money.

### 4. Notifications: one island

Toasts are pinned 72 px from the top today, just under the top bar, so they land on the content, next to the order pill and the chips.

- **Proposed (A):** toasts become an island that grows out of the middle of the top bar, the same slot the order pill uses.
  - A toast briefly morphs the island, then the island goes back to the order's status.
  - One toast at a time. One with an action (Undo) opens downward in place.
  - Sileo already draws toasts as morphing pills, so it is kept and placed and sized to fit the bar.
- **Alternative (B):** toasts rise out of the dock at the bottom, as sheets do.

### 5. Branch: fixed while you are there

With an open bill, a held place, a running clock or a scanned table, the customer is at that branch. Switching would show another branch's menu and prices over a bill that is here.

- The branch chip becomes a plain label while any of those is on.
- Switching with dishes in the tray asks first.

### 6. The Bills tab

Once the live bill is on the menu (step 3), a Bills tab only repeats it.

- **Proposed:** the dock's tabs become Menu · Book · You, and bill history moves to You as "Your bills":
  - a strip of months with each month's total;
  - each visit as a small receipt card (the place, when, the total, the stars), which opens the receipt;
  - "On your tab" as a row above it.
- The link a failed payment returns to (`/bills?pay=`) stays as a route and opens the bill's pay sheet over the menu.
- Guests get the same history under You.

### Order and decisions

The steps go in this order, 1 → 5 → 4 → 3 → 6, smallest and safest first.

Waiting on the owner:

- A or B for notifications.
- Whether to drop the Bills tab (step 6).
- Whether the branch lock (step 5) is right.

## State at hand-off (2026-09-26)

- **Released to main, not deployed:** commit `2b196935`, tag `v2026.09.26.6`. The images are built, but the owner said to hold the deploy. They still use the old "counter" name.
- **Uncommitted since `.6`:** these need checking on the local stack, then a commit and a new tag (`v2026.09.26.7`) before deploying.
  - The rename Counter → Ninja, run by an agent: the style key is `ninja`. It is selectable in admin and control, listed first as recommended, and is the default for new cafés. The Flutter customer app falls back to a classic look.
  - The tab pill is re-measured when the tab set changes.
  - The Menu/Bills/You pill slides across page changes.
  - The café mark and name have a gap between them.
  - Tray initials are in the right language.
  - The category pill is now one piece, because the old three-piece one could come apart.
  - The dock lines up with the cards: 16px side margin, and content starts at the card's text inset.
  - The cart opens by pulling a sheet out of the dock that follows the finger, and the page darkens with it.
  - When the cart opens, the dock circles fly to their rows (reversed on close), the item count collapses and the total grows.
- **The owner has not yet signed off on the cart motion.** Start by asking what still looks off.

## Ninja is the only style (2026-09-26)

The owner chose to build Ninja out first and bring other styles back later. The other looks (classic, minimal, bold, cozy, night), the four templates (Showcase, Paper, Tiles, Poster) and the per-part layout overrides are gone from client_web, admin_web and control_web. The pickers are gone too, and the brand forms save `style: 'ninja'`. Every café gets Ninja whatever it has stored, and Ninja's seeds fill anything the café left unset. Tenant.API still accepts the old keys, and the Flutter app still has its own table. Git history (`934a0b9d` and before) has the removed code.

## Next, in order

1. **End of a category flows into the next.** Scrolling past the last dish continues into the next category:
   - a short "Next: Desserts" card rises;
   - the category pill slides along;
   - the next category's first card comes up.

   It uses the same motion as the sideways swipe, so the menu reads as one continuous surface. At the last category, it ends with a gentle stop, with no wrap-around.
2. **Scan table in Ninja style.** The camera opens full-screen out of the dock's "Scan table" button, and once scanned it collapses into the table chip in the top bar.
3. **Bills in Ninja style.**
   - Each bill is a card stack that fans open to show its orders.
   - Totals roll like the tray's total.
   - Online payment opens from the card.
   - A newly added order slides into its bill.
4. **Book (places) in Ninja style.** Places are large cards like the deck. Picking a time slides in beneath the card, the way Tune does, and booking morphs into the stay chip.
5. **You (profile) in Ninja style.**
   - A profile card with loyalty points as a ring.
   - Settings as grouped tiles.
   - Language and theme switches that change shape between states instead of cutting.
6. **Known gaps from the build:**
   - Sileo capitalises toast titles, and toasts with an action are large.
   - Categories are not ordered by time of day.
   - The hold and press rings animate an SVG stroke.
7. **Flutter customer app (`client_app`):** a Ninja home, after the web design settles.

## Also planned

- **Upselling, phases 0–3 (approved):** the plan is in `C:\Users\Admin\.claude\plans\indexed-percolating-alpaca.md`.
  - Phase 0 lets customers get "Ready": the ready event goes to the buyer, with wording for pickup vs place.
  - Then owner pairings, tray suggestions, learned pairs, margin ranking, waiting-time offers and till prompts.
  - Decisions: no sets or bundles, waiting offers once each, available on all plans.
- **Phone layout for the till app (`pos_app`), proposed:**
  - Lift the landscape lock when the screen's shortest side is under 600.
  - Menu full-screen with the cart as a bottom bar and sheet.
  - A one-column ticket with a sticky Settle.
  - Bottom navigation.
  - A waiter-handheld flow first.
- **Waiting on the owner:**
  - Whether to simplify "Divide equally".
  - Details for Cove's Till page showing zero.
