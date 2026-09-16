# Chillax — the minimal-UI review

**Owner's verdict (2026‑09‑16):** the UIs carry far too much text and feel heavy. Goal: a minimal UI — label, value, control; no helper prose; depth behind disclosure — with the same powerful features underneath.

**The finding, in one line:** almost no single string is long. The weight comes from *how many secondary strings sit on each screen* — a label plus a muted explanation of the label, a dialog title plus a sentence restating it, an empty state with a second line, a money summary written as a sentence. The fix is structural and mechanical, not a rewrite.

Where the English lives (edit these; the generated files follow):

| Surface | Source of truth | Generated |
|---|---|---|
| client_web + client_app | `src/client_app/lib/l10n/app_en.arb` (+ `app_ar.arb`) | `client_web/src/lib/i18n.gen.ts` (`npm run generate:i18n`), `app_localizations_*.dart` |
| client_web only | `client_web/src/lib/i18n.ts` (`webExtras`) | — |
| pos_web | `src/pos_web/src/lib/i18n.ts` (hand-written `{en, ar}` dict) | — |
| pos_app | `src/pos_app/lib/l10n/app_en.arb` (+ `app_ar.arb`) | `flutter gen-l10n` |
| kds_web / kds_app | `kds_web/src/lib/i18n.ts` / `kds_app/lib/l10n/app_en.arb` | — |
| admin_web | (section 3, pending) | |

pos_web ⇄ pos_app and kds_web ⇄ kds_app have **zero wording drift** (353 and 33 shared keys, byte‑identical), so every cut below is one edit in two files.

---

## 1. Tills and kitchen (pos_web, pos_app, kds_web, kds_app)

### The five patterns that make the weight

1. **`description` is a required prop on the confirm dialog** — `pos_web/src/components/confirm-dialog.tsx:15`, `pos_app/lib/core/widgets/confirm_dialog.dart:11`. Nine call sites each invent a 60–120‑char sentence (ticket guards, room panel, session bar). *Make it optional; title + two buttons is the default.* Removes 6 of the top 15 alone.
2. **Dialog header = title + description even when the title says it** — ten `DialogDescription` sites (new‑ticket, discard, refund, move‑target, start‑session, shift‑panel, order‑detail, customize, KDS history). *Any real datum (time, count, amount) goes beside the title; prose goes.*
3. **Muted caption under a control** — `text-muted-foreground text-sm` / Forui `FTextField(description:)` / `FCard(subtitle:)`: void dialog, shift panel, settle, customer card, customer picker, movement dialog, floor + shift empty states, and the three settings cards in pos_app (~480 characters of subtitle before any control). *Ban captions under fields; a constraint is a disabled button.*
4. **Two‑line empty states** — nine `no*` keys carry a paired `*Hint`. *One line + the action button; delete every `*Hint`.*
5. **Sentence‑form money/meta summaries by concatenation** — ticket bottom bar (`Subtotal X · Service 12% Y · Includes VAT 14% Z` + refunded + time rows), refund cards, voided block, shift movements. *Total only; a label/value list behind a “Breakdown” disclosure.*

Bonus: four near‑duplicate “— add them in the admin app” empty states in the pay‑out dialog → one “None”.

### Top 15 to delete first (one dictionary edit + one ARB edit each)

| # | String | Key @ location |
|---|---|---|
| 1 | "Pins the kitchen display so Home, Recents and notifications…" (206) | `kioskHint` kds_app arb:60 |
| 2 | "Pins the till so Home, Recents…" (195) | `kioskHint` pos_app arb:687 |
| 3 | "Counter sales rung up while the network was down…" (148) | `offlineSalesHint` pos_app arb:720 |
| 4 | "An 80 mm network printer on the café Wi‑Fi…" (133) | `printerHint` pos_app arb:674 |
| 5 | "End it first so the time lands on this bill. Settled now…" (121) | `settleWithSessionHint` i18n.ts:238 / arb:255 |
| 6 | "Pick what goes back. Each item returns what was paid…" (120) | `refundHint` i18n.ts:255 / arb:292 → keep only "{amount} left" |
| 7 | "End it first so its time lands on this bill, then void or settle…" (109) | `voidWithSessionHint` i18n.ts:243 / arb:257 |
| 8 | "The network is down. This sale is kept here…" (109) | `savedOfflineHint` pos_app arb:725 → chip "Saved on the till" |
| 9 | "Confirm it first so it lands on this bill…" (108) | `settleWithPendingHint` i18n.ts:141 / arb:123 |
| 10 | "Nothing was added to it, so it leaves no trace…" (100) | `discardTicketHint` i18n.ts:466 / arb:546 |
| 11 | "Start the timer for {name} right now. Customers can join…" (86) | `startWalkInDescription` i18n.ts:178 / arb:167 |
| 12 | "Orders marked ready today, newest first. Bring one back…" (85) | `historyHint` kds_web i18n.ts:82 / kds arb:20 |
| 13 | "No time is charged and the room frees up…" (84) | `cancelSessionHint` i18n.ts:201 / arb:206 → "No charge." |
| 14 | "Your account is not assigned to any branch yet…" (80, ×4 apps) | `noBranchDescription` → "Ask the owner to assign a branch." |
| 15 | "A counter bill with no table, for someone who will order in a moment." (69) | `newTabHint` i18n.ts:296 / arb:370 |

Runners‑up: `pointsFollowWholeOrder`, `cancelOrderConfirm` → "Cancel order?", `payOutNoEmployees/Partners/Suppliers/Categories` → "None", `switchModeDescription` → "Now {rate}/hr", `noOrdersHint` (KDS), `joinsFromApp`, `takingAutoHint` → info icon, `noShiftOpenHint`, `typeToSearch`, `emptySale`, `voidReasonHint`.
Dead keys in pos_app (0 references): `cancelOrderConfirmation`, `cancelOrderQuestion`, `noKeep`, `yesCancel`, `comingSoon`, `each`, `priceFormat`.

### Per screen (worst offenders → fix)

| Screen | Cut / shorten | Structural fix |
|---|---|---|
| Floor | "Start a sale, or pick a room or table beside." → cut; "Every room and table already has a bill" → "All busy"; "No rooms/tables configured for this branch" → "No rooms"/"No tables"; "Waiting for confirmation" → "Waiting" + count; search placeholder → "Search" | Empty state = icon + "Nothing open" |
| New tab dialog | `newTabHint` cut; "Name on the tab (Optional)" → "Name"; "Already has a bill open · {where}" → badge | Title + one field + one button |
| Ticket screen | the three session/pending guard hints (5, 7, 9 above) cut; `pointsFollowWholeOrder` cut; amber "{n} orders … waiting for confirmation" → "Waiting ({n})"; "No items on this ticket yet" → "Empty" | Bottom bar: Total only, breakdown behind disclosure; refund cards and voided block as label/value rows |
| Settle dialog | "Whose account?" cut; "No payments taken yet" cut; "On the customer's tab" → "On tab"; "Confirm & settle" → "Settle · {total}" | Already the model otherwise |
| Void dialog | `voidReasonHint` cut; action "Void ticket" → "Void" | Title + field + Cancel/Void |
| Discard dialog | `discardTicketHint` cut | Title + Cancel/Discard |
| Refund dialog | `refundHint` → "{amount} left"; "Nothing is left to refund…" → "Nothing left"; "Issue credit note · {amount}" → "Refund {amount}"; "Refund everything" → "All" | |
| Move‑to dialog | count into the title; "No other open bills" → "None"; "New ticket for this place" → "Same place" | |
| Sale pad | "Tap items to add them…" cut; "Order sent — the ticket will show…" → "Order sent"; "(Optional)" spans cut; "Order note (optional)" → "Note"; "Special instructions (optional)" → "Notes"; "No items in this category" → "Empty" | Customer strip: name + chip row only |
| Customer picker | "Type at least 2 characters to search" cut; "Just a name — no account" cut; placeholder → "Search" | |
| Customer card / pay tab | "Customers join and use their points from the app." cut; "Not in the loyalty program" → "Not enrolled"; "Capped at what is owed" cut (clamp silently) | Two label/value rows, not two cards |
| Rooms: panel / session bar / start | `startWalkInDescription` cut; `cancelSessionHint` → "No charge."; `switchModeDescription` → "Now {rate}/hr"; "The timer stops and {hours} land…" → "{hours} on the bill"; "The room becomes available…" cut; "Cancel, no charge" → "No charge"; "Under maintenance" → "Maintenance" | All six are ConfirmDialog bodies → title + buttons |
| Service requests | "Switch to single player/multiplayer" → "→ Single" / "→ Multi" | |
| Pending orders / order detail | "Cancel this order? The customer will be told…" → "Cancel order?"; "Waiting for confirmation" → "Waiting"; reminder toast → "#{id} · {min}m" | |
| Shift screen / X‑Z | "Count the float and open the drawer shift…" cut; "Expected in drawer" → "Expected"; "Pay‑ins & pay‑outs" → "Drawer"; "No pay‑ins or pay‑outs" → "None" | Report body already label+value |
| Shift panel | `takingAutoHint` → info icon; description "Opened {datetime}" → caption beside title; switch labels → "Orders" / "Reservations" | |
| Open / close shift | "Counted drawer cash" → "Counted"; "Count & close" → "Close shift" | **Template: already minimal** |
| Pay‑in / pay‑out | the four "add them in the admin app" → "None"; "Which supplier?/Which partner?/What for?/Who?" → nouns | |
| Shift history | "No closed shifts yet" → "None yet" | |
| Receipts | "No receipts yet" → "None"; "Includes VAT {rate}%" → "VAT {rate}% incl." | |
| Availability | "Out of stock" caption → lock icon; drop the status word next to the switch; "No items match" → "Nothing found" | 4 text nodes per row → 2 |
| Auth gates | `noBranchDescription` shorten; "Your account does not have access to the POS." → "No access."; "You have been signed out of the POS." cut; sign‑in Card header flattened | |
| pos_app Settings | `kioskHint`, `offlineSalesHint`, `printerHint` → info icons; "Not device owner: Android screen pinning only" → badge | **Heaviest screen in the estate** |
| KDS board | "New orders show up here the moment they are confirmed." cut; sound `Alert` banner → speaker icon button | |
| KDS history | `historyHint` cut; "Nothing ready yet today" → "Nothing yet" | |
| KDS header / gates | iPad install toast → "Safari → Share → Add to Home Screen"; access/branch strings as POS | |
| kds_app Settings | `kioskHint` (206, longest in the estate) → info icon | |

Strings > 60 chars rendered: pos_web 13, pos_app 17, kds_web 2, kds_app 3. Nine of pos_web's are dialog descriptions; making `description` optional + the three settings subtitles takes the estate from 35 to ~8.

---

## 2. Customer apps (client_web, client_app)

Only **four** strings in the whole product exceed 60 characters (`passwordRequirements` 108, `aboutDescription` 94, `reservationCancelledIfNoCheckIn` 89, `deleteAccountConfirmation` 75). The weight is "explain‑only" strings — neither label, value nor action — stacked per screen.

### The five patterns

1. **Label + muted explanation of the label** (~11 sites): settings switches, notify banner, reserve sheet, loyalty card, profile loyalty tile, theme picker. *Row = label + control; an ⓘ if the explanation is truly needed.*
2. **Three‑deck empty state** (icon + title + line + CTA, ~11 sites): orders ×2, sessions ×2, cart, favorites, loyalty. *Icon + one line + button.*
3. **Tinted notice box** (icon + bold + muted body, ~13 sites): ordering/reservations unavailable, cart guest notice, reserve sheet arrival notice, notify banner, rating error. *One chip next to the control it constrains, or a disabled state.*
4. **Confirm dialog = title + sentence + verbose verbs** (~12 sites): clear cart, cancel reservation, leave room, delete account, sign out, fast‑order. *Title is the question ("Clear cart?"), no body, Cancel / Verb — kill "No, Keep" / "Yes, Cancel".*
5. **Sentence‑form values** ("Total: {x}", "Duration: {d}", "Base price: {p}", "Note: {n}", "Lifetime: {p} pts", "Your rating: ", "{n} members", "{p} pts to {tier}", ~16 sites). *Label/value columns or bare value + icon.*
6. (web) **Double‑titled toasts** — `client_web/src/lib/toast.ts:17‑24` prepends "Success"/"Something went wrong"/"Heads up" to every toast. *Delete the title layer: ~25 call sites lighter at once.*

### Top 15 to delete first

| # | Key (EN) | Where |
|---|---|---|
| 1 | `passwordRequirements` (108) | arb:388; settings_screen.dart:954, dead change_password_screen.dart:151 → inline "min 8" on error |
| 2 | `aboutDescription` (94) | arb:223; profile.tsx:293, profile_screen.dart:500 |
| 3 | `reservationCancelledIfNoCheckIn` (89) | arb:161; reserve-sheet.tsx:89, rooms_screen.dart:1273 → chip "⏱ 10 min" |
| 4 | `earnPointsDescription` (59) | arb:342; loyalty.tsx:121, profile.tsx:181, loyalty_card.dart:261 |
| 5 | `profileRequiredMessage` (56) | arb:507; profile-gate.tsx:113, profile_gate.dart:170 |
| 6 | `guestCheckoutMessage` (59) | client_web i18n.ts:23; guest-gate.tsx:100 |
| 7 | `orderStatusUpdatesDescription` | arb:227; settings ×2 |
| 8 | `getNotifiedWhenAvailable` | arb:154; notify-banner.tsx:62, rooms_screen.dart:923 |
| 9 | `promotionsDescription` | arb:229; settings ×2 |
| 10 | `lightThemeDescription` + `darkThemeDescription` + `systemDefaultDescription` | arb:240‑244; settings_screen.dart:466 (web already has the inline `ThemeSwitch`) |
| 11 | `previousOrdersWillAppearHere` | arb:124; orders ×2 |
| 12 | `orderFromMenuToStart` | arb:105; orders ×2 |
| 13 | `pleasePayAtCounter` + `willBeAppliedToNextPurchase` + `noOutstandingBalance` | arb:329‑331; balance cards ×3 (colour + Due/Credit already say it) |
| 14 | `guestOrdersKeptOnThisDevice` + `guestOrderNoPoints` + `scanTableOrSignIn` | client_web i18n.ts:35‑46; orders + cart |
| 15 | `orderDeliveredToTable` (toast description) | arb:501; table/$tableId.tsx:87 |

Runners‑up: `noFavoritesDescription`, `makePurchaseToEarn`, `reserveRoomToStart`, `addItemsFromMenu`, `pullDownToRetry`, `needSomething`, `removeAllItemsFromCart`, `confirmCancelReservation`, `leaveSessionConfirmation`.
Dead weight: `client_app/.../update_email_screen.dart` (unrouted, references 8 keys that do not exist), `change_password_screen.dart` (unrouted), 22 unused ARB keys (`signUp`, `usernameOrEmail`, `enterUsername`, `orderStatusPending/Confirmed/Cancelled`, `noItems`, `willBeNotifiedWhenAvailable`, `notifyMe`, `perHour`, `supportEmail`, `yourPhoneNumber`, `updateName`, `enterNewName`, `nameUpdatedSuccessfully`, `failedToUpdateName`, `fastOrderConfirmation`, `switchBranch`, `scanQr`, `pointCameraAtQr`, …).

### Per screen

| Screen | Cut / shorten | Structural fix |
|---|---|---|
| Menu | "Ordering is currently unavailable" alert → grey add buttons + "Closed" pill; install banner off the menu (Settings tile only); "Includes: 2× Latte…" → chips; item description off the list rows; "Customizable" badge cut; "Special Offers 🔥" → "Offers"; fast‑order confirm → undo toast | Name + price per row |
| Item / customize sheet | description → 1 line + "more"; "Base price" cut (app); "Special Instructions" header cut (placeholder only); "Required" → asterisk; "Out of stock" in chips → strike/opacity | |
| Cart / checkout | "Scan the QR… / Or sign in…" → one line + QR icon; "Sign in to earn points" row cut; empty state 2nd line cut; "Remove all items from your cart?" cut ("Clear cart?"); "Order as guest / Sign in instead" → "Order" + link; "Use Loyalty Points" → "Points" + switch; note label cut (placeholder) | Heaviest web screen |
| Guest / profile gate | descriptions cut | Title + fields + Done |
| Orders + rating | "Guest orders are only kept on this device" → ⓘ; "Sign in to see your orders, or place one as a guest" → shorten; both empty‑state 2nd lines cut; "Pull down to retry" → Retry button; "Total: / Note: / Your rating:" prefixes cut; rating sheet → stars + one placeholder + Submit | |
| Rooms + reserve + banners | arrival notice 2nd line cut → chip; notify card 2nd line cut → "Notify me when free" + switch; "Reservations are currently unavailable" → disabled buttons + pill; cancel/leave confirms → title + Keep/Cancel; room description off rows; "Need something?" header cut; "Single: £X/hr + Multi: £Y/hr" → "£X · £Y /hr" | Heaviest mobile screen |
| Room QR / scanner | "Sign in to see your orders and points" reused as gate → "Sign in to join"; "{n} members" → avatars + number; viewfinder hint → "Scan a QR code"; "Room not available" → disabled "Occupied" button | |
| Table QR | toast description cut (app already does) | |
| Sessions | empty‑state 2nd lines cut; "Duration:" prefix cut; one shared error component | |
| Loyalty | join description cut; "No loyalty account yet + Make a purchase…" → join CTA; "Lifetime:" → "4,300 lifetime"; progress row: bar + "250 to Gold" only | |
| Account / tab | the three balance captions cut; "Recent Activity" header cut; "POS receipt #123" → "#123" + icon; "by Ahmed" → detail row | |
| Profile | About description cut; loyalty tile sublabel cut; "Sign in to see your orders and points" → "Sign in"; "Are you sure you want to sign out?" → "Sign out?"; app Help sheet → the web's one "Call Us" tile | |
| Settings | `passwordRequirements` cut; both switch sublabels cut; theme descriptions cut (port web `ThemeSwitch`); delete‑account body → title; Theme/Language rows → inline value | Worst explanation‑to‑control ratio |
| Install prompt (web) | banner off the menu; iOS steps → "Share → Add to Home Screen" | |
| Auth | "Continue with Google/Apple/email" → "Google"/"Apple"/"Email" (app already); "Sign in to see your orders and points" reused 3× → cut 2; "Don't have an account?" → "Register" link; register fields: label only, no hints | |
| Favorites (app) | 2nd line cut | |

Where one app is already the model: web for theme/language (inline segmented), help (one tile), orders error (Retry button), no base‑price line; app for title‑only toasts, "Google"/"Apple" buttons, QR‑path short reserve toast.

### Suggested order of work (customer apps)
1. Delete the 22 dead ARB keys + 2 dead screens (zero UI risk).
2. Apply the top‑15 in `app_en.arb`/`app_ar.arb`, `npm run generate:i18n`, remove the orphaned render sites (the compilers point at each).
3. Sweep P4 confirm dialogs and P2 empty states (23 sites, mechanical).
4. Port web `ThemeSwitch` / "Call Us" tile into Flutter Settings/Profile.
5. Collapse P3 notice boxes to chips and P5 sentence‑values to label/value rows (component work).

---

## 3. admin_web

Strings live in `src/admin_web/src/lib/i18n.ts` (`webExtras`, ~1063 entries — where most of the prose is, directly editable) and `i18n.gen.ts` (generated from `src/admin_app/lib/l10n/app_en.arb`). 85 keys over 60 chars, ~74 live render sites, ~6,300 characters of prose. Card grids are already gone (only announcements, sign‑in, signed‑out still use `CardHeader`); the weight is prose, and a `description`/`hint` slot baked into every shared primitive.

### The five patterns

1. **`PageHeader description` is a ritual on all 28 pages** (`components/page-header.tsx:56`), nearly always a title restatement or a reading of the tabs/columns below (`menu-page.tsx:27`, `till-page.tsx:40`, `history-page.tsx:23`, `orders/board.tsx:86`, every finance/payroll/inventory page…). *Description holds a value only (date range, count, status) — never a sentence. Delete ~25 `*Subtitle` keys. Six pages hand‑roll `<h1>+<p>` instead of `PageHeader` — consolidate.*
2. **Every dialog/sheet opens with a description paragraph (44 files).** A third are pure restatement (branch, category, stock‑item, receive, transfer, add‑charge, record‑payment, earn/adjust‑points, item‑sheet, reserve‑room, start‑session, bundle, add‑staff, employee‑sheet, partners, suppliers, expense, categories, recurring, track‑items, the three review sheets, announcements). The good third hold a *datum* (order date, shift opened‑at, count meta, ticket meta, payslip period). *Rule: the slot holds identity/metadata only, never instructions.*
3. **Switch‑in‑a‑bordered‑box with a caption** — identical markup ×5 (pricing‑dialog `pricesIncludeVatHint`, stock‑item `autoSoldOutHint`, add‑staff `ownerDescription`, bundle `visibleToCustomers`, item‑details `onOfferHint`). *One `SettingSwitch` primitive: label + optional ⓘ + switch. No box, no caption.*
4. **Local `Section({title, hint})` re‑implemented three times** (customer‑panel, item‑sheet, employee‑sheet) plus two inline clones (partners, suppliers); the hint is always a paragraph. *One shared `Section` with `title` + optional `action`, no `hint` prop.*
5. **Sentences smuggled into `title=` tooltips and empty states** — 100+‑char native tooltips (`menu/index.tsx:343,699`, `track-items-sheet.tsx:304,318`, `stock-rule-section.tsx:139`, `attendance.tsx:213`); all 10 `EmptyState` call sites pass a description that restates the title or button; `ConfirmDialog.desc` carries paragraphs at 11 sites. *Real `<Tooltip>` capped at ~40 chars; `EmptyState.description` rare; confirm = object in the title + at most "Cannot be undone."*

### Top 15 to delete first (all in `i18n.ts` unless `[gen]`)

| # | Key (chars) | Render site |
|---|---|---|
| 1 | `monthlyGridHint` (185) | `payroll/attendance.tsx:419` |
| 2 | `attendanceLegend` (138) | `payroll/attendance.tsx:419` — three keys concatenated into one ~425‑char paragraph with `overtimeModeHint` → icon legend row + ⓘ |
| 3 | `recipeSlotsHint` (148) | `menu/components/recipe-editor.tsx:150` |
| 4 | `paidDaysOffHint` (148) | `payroll/components/employee-sheet.tsx:385` |
| 5 | `reviewMenuScanDescription` (148) | `menu/components/menu-review-sheet.tsx:191` |
| 6 | `reviewRecipesDescription` (144) | `menu/components/recipe-review-sheet.tsx:231` |
| 7 | `builderHint` (135) | `menu/components/recipe-builder.tsx:107` |
| 8 | `proposeRecipesHint` (136) + `proposeRecipeHint` (123) | `track-items-sheet.tsx:318`, `stock-rule-section.tsx:139` — near duplicates |
| 9 | `reviewScanDescription` (128) | `inventory/components/receipt-review-sheet.tsx:189` |
| 10 | `sellAsUnitsHint` (128) | `track-items-sheet.tsx:304` (a `title=`) |
| 11 | `ledgerHint` (125) | `employee-sheet.tsx:100` |
| 12 | `trackItemsDescription` (119) | rendered twice: `track-items-sheet.tsx:194`, `menu/index.tsx:343` |
| 13 | `receiptPricingDescription` (118) `[gen]` | `branches/components/pricing-dialog.tsx:96` |
| 14 | `newIngredientsHint` (111) | `recipe-review-sheet.tsx:254` |
| 15 | `paidSinceGenerated` (104) | `payroll/payslips.tsx:567` |

Dead in admin_web (delete if also unused in admin_app): `batteryOptimizationBody`, `fullScreenIntentBody`, `unblockAdminConfirmation`, `blockAdminConfirmation`, `endSessionConfirmation`, `unblockCustomerConfirmation`, `blockCustomerConfirmation`, `failedToDeleteOrders`, `failedToDeleteOrder`; `recipeSlotEmpty` / `recipeOverrideIncomplete` are live validation strings → 3‑word labels.

### Per page

| Page | Cut / shorten | Structural fix |
|---|---|---|
| Dashboard | `dashboardSubtitle` fallback cut | Already minimal; count sub‑captions stay |
| Orders live | header description cut; "New orders will appear here instantly." cut; "Are you sure you want to cancel this order?" cut | |
| Orders history | "Every order, past and present." cut; delete confirms → "#{n}" in title + "Cannot be undone." | |
| Rooms | "Sessions and reservations." cut; "Manage its session…" cut; end/switch/cancel session sentences → value row / "Rate changes to {next} now." / cut; `startWalkInDescription` cut; reserve dialog description cut | |
| Rooms history / print | "Completed sessions across all rooms." cut; print instruction keep | |
| Tables | subtitle cut; delete‑table paragraph → one clause + "Deactivate instead" button; cancel‑order body cut | |
| Requests | subtitle cut; "No requests of this kind right now" → "None of this kind" | |
| **Menu** (23 keys > 60 — heaviest) | `recipeSlotsHint`, `builderHint`, `trackItemsDescription` ×2, both review‑sheet descriptions, `sellAsUnitsHint`, `proposeRecipe(s)Hint`, `newIngredientsHint` cut; uncosted‑ingredients line → "{n} uncosted — lower bound"; AI button paragraphs → tooltip; "Fill in the details to add a new menu item" cut; section hints cut; "Sales of this item do not touch stock yet" → "Not tracked"; photo dropzone captions cut; category/bundle dialog descriptions cut; "Items customers can order." cut | Recipe editor/builder: column labels carry it; ⓘ popover on the section heading |
| Bundles | delete confirm → title only; "Visible to customers" caption cut | |
| Inventory stock | rebuild confirm → "Nothing in the ledger changes."; retire confirm → "History stays. Restore from Show retired."; `autoSoldOutHint` → ⓘ; `reviewScanDescription` cut; count‑mode hint cut; empty pane line cut; receive/transfer descriptions cut; reorder popover → "Empty = off."; subtitle cut | |
| Inventory reports / menu cost / history | subtitles cut (history's is a literal list of the four tabs below it); variance clause → tooltip; purchase sheet description cut; use `PageHeader` | |
| Customers | subtitle cut; empty pane line cut; disable confirm → "Cannot sign in or order."; the four dialog descriptions ("Adjust the points balance for {name}." …) cut; "Use positive to add…" → "±" placeholder | |
| Till | subtitle cut; "No shift is open. The drawer opens from the till." → "No shift open" | Leanest page already |
| Finance expenses | empty state → title + button; void confirm paragraph cut; subtitle cut; partner‑pocket sentence → ⓘ on the field; categories/recurring descriptions cut/→ "Posted automatically each month." | |
| Finance partners / suppliers | all five explanatory sentences cut (sign convention is the In/Out columns); share field → "% of monthly profit." | Duplicate inline section blocks → shared `Section` |
| Finance profit | subtitle cut; labour formula + benchmark → ⓘ; "Sales include {amount} VAT…" → "incl. VAT {amount}" | |
| **Payroll attendance** | the ~425‑char footer paragraph (legend + grid hint + overtime hint) cut → icon legend + ⓘ; empty state → title + button; "Tap a day to mark it…" cut | Worst single block in the app |
| Payroll employees | `paidDaysOffHint` → ⓘ; `ledgerHint` cut; pay‑terms hint → "from" on the date label; leave confirm → "Ledger and payslips stay."; subtitle cut; "A login is optional…" cut | |
| Payroll payslips | `paidSinceGenerated` cut; pay‑changed sentence → ⓘ; days‑off sentence → label/value row; delete confirm → "Earnings line is removed too."; empty state + subtitle cut | |
| Staff | "Creates a Keycloak account…" cut (leaks implementation); role/owner captions → one‑line tooltip inside the select; subtitle cut; use `PageHeader` | |
| Branches | `receiptPricingDescription` → footer note "Receipts already printed keep their figures."; service‑charge sentence → ⓘ; VAT switch caption → label "Prices include VAT" + live example; branch dialog descriptions cut; subtitle cut | |
| Announcements | "Broadcast push messages to customers." cut; long description → "Cannot be recalled" inside the send confirm; drop the Card | Last `CardHeader` page |
| Settings / auth / errors | "Your account information and settings." cut; sign‑out confirm cut; "Your session has ended. See you soon." → "Signed out."; error pages → "Page not found." etc.; the two auth Cards flattened | |
| Shell / gates | branch gate → "No branch assigned. Ask the owner."; access denied → "No access."; owner gate → "Owners only." | |

Applying the five patterns mechanically removes ~45 render sites and ~4,000 characters without touching a feature; `recipe-editor.tsx`, `recipe-builder.tsx`, `track-items-sheet.tsx` and `payroll/attendance.tsx` carry a third of it.

---

## 4. The rules that fall out of all three

1. A page header is a title and, at most, a value (range, count). No sentence.
2. A dialog is a title, its inputs, one primary action. The description slot holds a datum or nothing.
3. Nothing is explained under a field. A constraint is a disabled button; a rule is an ⓘ.
4. Empty state = one line + the action.
5. Confirm = the object in the title ("Clear cart?", "Void #123?"), buttons Cancel / Verb. At most "Cannot be undone."
6. Money and meta are label/value rows or chips, never a sentence; secondary detail behind disclosure.
7. Kill the tooltip‑as‑paragraph and the double‑titled toast.
8. Fix the primitive, not the call sites: `ConfirmDialog.description` optional, `PageHeader.description` value‑only, one `Section` without `hint`, one `SettingSwitch`, `EmptyState.description` rare.
