# Ninja style — what's next

The Ninja style (built as "Counter", renamed to Ninja on 2026-09-26) is the motion-first customer menu in `src/client_web/src/components/ninja/`: a swipeable deck of dish cards, zoom out to a grid of the whole menu, cards that open in place into their options, a tray the dishes fly into, hold to order, and the order status pill. Motion tokens live in `src/client_web/src/lib/motion.ts`; the same values are used by the till and kitchen apps (`lib/core/motion/`). Try it locally at `http://localhost:5174/?layout=ninja` in a phone-size window.

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
