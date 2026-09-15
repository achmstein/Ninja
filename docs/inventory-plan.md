# Chillax Inventory — Design & Plan

**Goal:** know what is on the shelf, get warned before it runs out, take items off the menu when it does, and see where stock goes: easy for a café to run day to day, powerful enough to price a latte's ingredients.

**Status:** decided and built 2026-09-12 (Phases 1–3). 2026-09-15: measured against the field (section 7); Phase 4 (cost control) built, Phases 5–6 planned.

---

## 1. Where we were

Nothing in Chillax counted stock. Catalog had one boolean per menu item (`CatalogItem.IsAvailable`), optionally restricted per branch by `BranchItemOverride.IsAvailable`; the order "stock check" (`OrderStatusChangedToAwaitingValidationIntegrationEventHandler`) only read that flag and ignored the units. Sold-out was flipped by hand on the till.

Three facts about the platform shaped the design:

- The only integration event that carries product ids and quantities is `OrderStatusChangedToConfirmedIntegrationEvent`. Voids and refunds in Sales carry money only (a `TicketLine` has no product id). A confirmed order can never be cancelled in Ordering.
- Chosen customization options are flattened to text before an order exists (`BasketItemExtensions.cs`); the structured option ids arrive on the basket and are dropped.
- A bus handler that throws is logged, acknowledged and lost (`RabbitMQEventBus.cs`, no dead-letter exchange). Every handler must be idempotent, and a lost message must be correctable.

## 2. Decisions (owner, 2026-09-12)

### D1 — A new bounded context: `Inventory.API`

`Inventory.API` + `Inventory.Domain` + `Inventory.Infrastructure`, Sales as the template, database `inventorydb`, schema `inventory`, BFF route `/api/inventory`. Catalog stays the menu and price authority; Inventory is the stock authority. Per the house rule (D5b in `pos-plan.md`) Inventory never calls Catalog: it keeps only catalog item ids, the admin SPA joins the names, and the two talk through two events.

### D2 — Ingredients and recipes from day one

A **stock item** is anything the storeroom counts: an ingredient (milk, beans, cups) or a sellable unit (a can, a slice). A menu item is tracked by giving it a **recipe**: base lines (what every unit sold takes) and, from Phase 2, option lines that apply only when a customization option was chosen. "Track by unit" is the one-tap case: a `pcs` stock item named after the menu item, auto-sold-out on, and a recipe of one each. A menu item without a recipe is simply not tracked.

### D3 — Stock leaves at confirmation and never comes back by itself

Deduction happens on `OrderStatusChangedToConfirmed` (which offline POS replays also raise). Voids and refunds never restock: a café cannot know whether the drink was made. Staff post a "Return to stock" adjustment when an unopened item comes back. Cancellation before confirmation needs no compensation because nothing was deducted. No Sales change was needed.

### D4 — Automatic sold-out, opt-in per stock item

Each stock item has `AutoSoldOut`. When such an item crosses zero at a branch, the menu items whose **base** recipe needs it are announced out of stock there; when every auto-sold-out base ingredient is back above zero, they are announced back. On by default for unit-tracked goods, off for ingredients, so paper drift on milk never pulls every coffee off the menu. Catalog stores it as a separate `BranchItemOverride.IsOutOfStock` flag beside the manual switch; marking an item available by hand clears the flag ("we found a box in the back"), and the next zero crossing re-arms it.

### D6 — A recipe is slots, not lines *(owner, 2026-09-15; supersedes the flat-lines part of D2)*

The flat list of option-keyed lines was correct but wrong-sized for the admin: a Turkish coffee whose bag depends on roast and spice and whose amount depends on size needed twelve lines, and any combination nobody typed deducted nothing, silently. The unit of authoring is now the **slot** — the things one sale takes: the coffee, the sugar, the cup — and how each choice changes each of them.

- A **slot** has a **default** (stock item + quantity for a sale where the customer changes nothing, or *none*: the slot only appears for some choice), **overrides** keyed on one option or a combination (replace the item and/or the quantity, or set *none*), and a **scalable** flag.
- The recipe has **scale factors** on options: دبل ×2, Large ×1.5. They multiply the scalable slots.
- **Resolution** for a sale with chosen options C: *for each slot, take the most specific override whose options are all in C (most options named; else the default); multiply scalable slots by the factors of the chosen options.* An override replaces within its slot; nothing is additive across a slot, so an uncovered combination falls back to the default instead of to nothing. The only way to deduct nothing is to say *none*.
- **Storage**: `RecipeLine` gains `Slot`, `Scalable` and `IsNone`; `RecipeScale(OptionId, Factor)` is a second collection on the recipe. Migration `RecipeSlotsAndScales` is additive and **behaviour-preserving**: every existing line becomes its own slot (a base line the slot's default, an option line an override with no default), so the old additive semantics hold until a recipe is restructured; `Scalable` starts as "unit is not pcs". The old constructor and `RecipeLineInput` without a slot keep working the same way.
- **Per-option sold-out** keeps its limit: a single-option override drives the option's status; combinations do not; a *none* override never does.
- **Cost**: the standard choice and the per-choice deltas are the same resolution over the branch's average costs, in C# and its TypeScript mirror; "the standard choice deducts nothing" can no longer happen by accident.

The editor shows a recipe as rows, one per slot — *7 g of بن وسط سادة · scales with size · depends on التحميص × التحويجة* — and, under a row that depends on groups, a grid (one group: a list; two: rows × columns) with the item and quantity per cell, an empty cell meaning "same as the default", a cell set to *none* meaning nothing. Size is one row of factors. The "try it" preview picks options like the cashier and shows the resolved deduction. The bulk review sheet uses the same editor per item, and the assistant proposes in this shape.

### D5 — No reservations; counts fix drift

Inventory does not join the order validation saga. A momentary oversell between two racing orders is accepted; the level goes negative and the next count corrects it. Counts are also what heals a lost bus message. `StockLevel` is a projection of the append-only ledger and can be rebuilt from it.

## 3. Model (schema `inventory`)

| Entity | What it is |
|---|---|
| `StockItem` (global) | Name (EN/AR), base `Unit` (pcs / g / ml), optional `PackSize` + `PackName` for receiving ("bag" = 1000 g), `AutoSoldOut`, `IsActive`. |
| `StockLevel` PK (BranchId, StockItemId) | `OnHand`, `ReorderLevel?`, `AvgUnitCost`. Moved only by `StockLedger` under a row lock (`SELECT … FOR UPDATE`, created with `INSERT … ON CONFLICT DO NOTHING`), never through the change tracker: an optimistic-concurrency throw in a bus handler would be a lost deduction, a row lock is a short wait. |
| `StockMovement` (append-only) | BranchId, StockItemId, `Type` (Purchase / Sale / Waste / Count / Adjustment), signed `Quantity`, `UnitCost` snapshot (the branch average at posting; a receipt at its own price), `Reference?` (`order:{id}`, `purchase:{id}`, `count:{id}`), `Reason?`, who, when. Unique filtered index on `(Reference, StockItemId)`: the redelivery and retry guard. |
| `Recipe` PK CatalogItemId | Lines of (`Slot`, StockItemId, Quantity per unit sold, `OptionIds` integer[], `Scalable`, `IsNone`) and `Scales` of (OptionId, Factor). Lines with the same `Slot` are one slot: the line with no options is its default, the others its overrides, keyed on one option or a combination (a bag that exists for medium roast + spiced is one override tied to both). `Explode(units, chosenOptionIds)` resolves each slot to its most specific applicable override (else the default), skips *none*, and multiplies scalable slots by the chosen options' factors (D6, migration `RecipeSlotsAndScales`, 2026-09-15). Only single-option overrides drive per-option sold-out. |
| `Purchase` | Branch, supplier (free text), invoice ref, who/when, lines (StockItemId, quantity in base units, unit cost). Posted once, never edited; fixed by an adjustment. Its id is its number. |
| `StockCount` | Branch, note, who/when, lines (StockItemId, `Expected` frozen at posting, `Counted`, `Variance`). The document is the variance report; the differences post Count movements. |
| `MenuItemStockStatus` PK (BranchId, CatalogItemId) | The last `InStock` Catalog was told, so a restock of one ingredient does not announce "back" while another is still out, and nothing is announced twice. Locked before the levels are read, so two postings against different ingredients of one item recompute in order. |

## 4. Flows

- **Deduction** — `OrderStatusChangedToConfirmedIntegrationEventHandler` (partial event copy: OrderId, BranchId, Items[ProductId, Units, OptionIds?]) → skip if `order:{id}` is already on the ledger → `SaleDeduction.BuildDrafts` explodes each line through its recipe and sums per stock item → one transaction of Sale movements. Untracked products post nothing.
- **One posting choke point** — `StockPostingService.PostAsync(branchId, drafts, actor)` → `StockLedger.PostAsync` → for auto-sold-out items that crossed zero either way, recompute the menu items whose base recipe uses them and enqueue `CatalogItemStockChangedIntegrationEvent(BranchId, CatalogItemIds, InStock)` only on change → for downward crossings of the reorder level enqueue `StockLowIntegrationEvent`. Everything rides the outbox (`InventoryTransaction`, the mirror of `SalesTransaction`).
- **Catalog** — consumes `CatalogItemStockChanged` → upserts the branch override's `IsOutOfStock` (idempotent) → republishes its existing `CatalogItemAvailabilityChangedIntegrationEvent` → Notification's `CatalogChanged` push → every menu refreshes. Effective availability everywhere is `item.IsAvailable && override.IsAvailable && !override.IsOutOfStock`; the DTO exposes `isOutOfStock` so the till can say why the switch is off.
- **Low stock** — Notification forwards `StockLow` to the admin SignalR group; admin_web toasts it for the active branch and the dashboard "Low stock" card reads `GET /api/inventory/levels?low=true`. No FCM in v1.
- **Costing** — `AvgUnitCost` per branch moves only on receipts (or an adjustment carrying a unit cost, e.g. opening stock); when nothing is on hand the receipt sets the price. Every movement snapshots the unit cost it was worth, so COGS and waste value are a sum, later.

Known, accepted: an offline replay that syncs *after* a count double-deducts (the count already absorbed it). If it bites, `PlacedAt` on the event and skipping Sale movements older than the branch's latest count for the item is additive.

## 5. API (`/api/inventory`, policy Admin; branch from `X-Branch-Id` where scoped)

`GET|POST /items`, `GET|PUT /items/{id}`, `PUT /items/{id}/reorder-level` · `GET /levels?low` · `GET /movements?stockItemId&from&to&pageIndex&pageSize`, `POST /movements` (waste / adjustment) · `GET|POST /purchases`, `GET /purchases/{id}` · `GET|POST /counts`, `GET /counts/{id}` · `GET /recipes`, `GET|PUT|DELETE /recipes/{catalogItemId}`, `POST /recipes/track-by-unit`. Posting endpoints take `x-requestid` and are deduplicated like the till's.

## 6. Phases

**Phase 1 — built 2026-09-12 (local).** Service, ledger, receipts, counts, base recipes, "track by unit", deduction, the sold-out loop (Catalog `IsOutOfStock` + migration `AddBranchItemOutOfStock`), low-stock push, admin_web Inventory section (Stock / Items / Recipes / Purchases / Counts / Movements, Menu row actions, dashboard card, `StockLow` toast), pos_web availability hint. 15 unit tests. Wiring: slnx, AppHost (`inventorydb`, `inventory-api`, `/api/inventory` route), compose, both workflows. **`inventorydb` must be created on prod by hand before the first deploy** (the init script only runs on first boot; same as `salesdb`).

**Phase 2 — option-level ingredients: built 2026-09-12 (local).** Ordering keeps `OrderItem.OptionIds` (JSON list, additive migration) filled from `BasketItemCustomization.OptionId`, and `OrderConfirmedItem.OptionIds` rides the confirmed event; Inventory's partial copy declares the field and `Recipe.Explode` honours it (`SaleDeduction` passes each line's option ids); the recipe editor has an "Applies to" control per line (base, or one of the item's customization options) and preserves option lines on save. Option-level sold-out ("oat milk out") stays out: `CustomizationOption` has no availability today.

**Phase 3 — built 2026-09-12 (local).** (1) Usage report `GET /api/inventory/reports/usage?from&to`: per stock item and period, purchased / sold (cost of goods sold) / waste / adjustments / count variance / transfers, each valued at the cost the movement was posted with, plus the current stock value (`StockLevelView.Value` = on hand × average, never below zero). (2) **Per-option sold-out**: option recipe lines whose auto-sold-out ingredient crosses zero drive `MenuOptionStockStatus` and `CatalogOptionStockChangedIntegrationEvent(BranchId, OptionIds, InStock)`; Catalog keeps `BranchOptionStockOut` rows, exposes `CustomizationOptionDto.IsOutOfStock` per branch and republishes the parent item's availability event so every menu refreshes; the web and Flutter customize dialogs disable such options. Order validation does not check options (client-side gate, like tables). (3) **Replay guard**: the confirmed event carries `PlacedAt` (= `Order.OrderDate`); Inventory drops a replayed sale's lines for items counted after the sale (`SaleDeduction.DropCountedAfter`). (4) **Transfers**: `Transfer` document, `TransferOut` at the source and `TransferIn` at the destination in one transaction, the destination receiving at the source's average cost (`POST /api/inventory/transfers/to/{branchId}`, the route value so branch access covers both sides). (5) **Rebuild**: `POST /api/inventory/levels/rebuild` (Owner) recomputes the branch's on-hand figures from the ledger. Migration `TransfersAndOptionStatuses`. Not built: FCM to the owner for low stock (SignalR toast + dashboard card only).

## 7. Where the field is ahead, and the phases that close it *(owner, 2026-09-15)*

Measured against the restaurant inventory tools (MarketMan, xtraCHEF/Toast, Restaurant365, Lightspeed, Apicbase) and the general ones the café used before (Loyverse, Odoo). What is already here — event-driven depletion with idempotency and a replay guard, **option-level** depletion and per-option 86 (most tools only 86 whole items), transfers at cost, a moving average that feeds the P&L by itself, a full ledger, AI receipt reading — is not rebuilt. What they have and Phases 1–3 do not:

| Capability | Chillax today | Value for two branches | Phase |
|---|---|---|---|
| **Menu item cost & margin** — recipe × current cost vs price, food-cost %, items over target flagged; menu engineering (popularity × margin) later | Recipes and averages exist; nothing computes plate cost | Very high: the report an owner opens daily | 4 |
| **Price change at receiving + cost history** — a line ±10 % against the last receipt is flagged; the cost trend per item | Cost snapshotted per line, never compared | High: cost creep is where margin goes | 4 |
| **Actual vs theoretical (AvT) period report** — opening + received − closing = actual; sales × recipes = theoretical; the gap per item, valued; cost of goods as % of sales | Usage report and count variance carry the parts, not framed as a period | High | 4 |
| **Par levels → suggested order** — what to buy today per branch (and supplier) = par − on hand | `ReorderLevel` alert only | High: the low-stock toast becomes a shopping list | 5 |
| **Item categories & storage areas** — dairy / dry / packaging; fridge / dry store / bar; count sheets in shelf order | Flat list | High: counts three times faster, reports readable | 5 |
| **Counts by area, partial, in packs, blind, on a schedule** | Full count, base units, expected shown | Medium-high: the count is where drift dies | 5 |
| **Waste reason codes + waste by reason** | Free-text reason | Medium-high, trivial | 5 |
| **Storekeeper role** — count and receive without admin rights | Admin only | Medium | 5 |
| **Low stock pushed to the manager's phone** | SignalR toast + dashboard card | Medium-high | 5 (needs the manager app, `docs/system-map.md`) |
| **Sub-recipes / prep batches with yield** — cold brew concentrate, syrups, sauces made from items, then used as items | Menu-item recipes only | Medium, depends on how much is prepped | 6 |
| **Supplier item catalog** — item ↔ supplier(s), last cost per supplier | Supplier on the purchase only | Medium | 6 |
| **Period close** — no back-dated movements once the month is closed | None | Medium (accounting hygiene) | 6 |
| **Purchase orders** — order → send → receive against it, partials, discrepancies | Receive only | Medium; a suggested-order list shared to WhatsApp covers most of it | 6, if the list is not enough |
| Slow-moving / dead stock | None | Low-medium, trivial | 6 |
| Expiry / lots (FEFO), barcodes, forecasting, offline counting | None | Low for a café | not planned |

### Phase 4 — cost control *(decided 2026-09-15)*

Everything here is a query over data the ledger already holds; no new movement type, no new aggregate.

1. **Recipe cost** — `GET /api/inventory/recipes/costs` (branch from `X-Branch-Id`): for every tracked menu item, the base cost (base lines × the branch's average cost), the extra cost of each option line set, the ingredient breakdown, and which ingredients have no cost yet (never received at this branch) so a margin is shown as incomplete rather than wrong. Inventory does not know prices: the admin SPA joins Catalog's items (the house pattern) and shows **cost, margin and food-cost %** in the item sheet's stock section and on a **Menu cost** report (`/inventory/menu-cost`), items over a target food-cost % (35 % by default, a UI setting) flagged first. Popularity × margin (menu engineering) waits for a per-item sales count from Ordering.
2. **Cost changes** — the branch's **last purchase cost** per item (the newest `Purchase` movement, `DISTINCT ON` over the ledger; no new column) rides `StockLevelView.LastCost`/`LastCostAt`. The receive dialog and the receipt review sheet show it beside the unit cost and flag a line that moved more than 10 % either way; the receipt scanner's validator adds the same as a `line N:` warning so the proposal already says "milk is up 8 %". `GET /api/inventory/items/{id}/costs` lists the item's receipts at the branch (date, supplier, quantity, unit cost), shown as a cost history on the stock item panel.
3. **Variance report** — `GET /api/inventory/reports/variance?from&to`, the usage report reframed as the period the field expects, per item: **opening** (the ledger summed before `from`), received, transferred in/out, **theoretical usage** (sales through recipes), waste, adjustments, **count variance**, **closing**, each in quantity and value, plus variance as a % of theoretical. The totals give the period's cost of goods; the page shows it as a % of the month's net sales from Finance's profit endpoint when the range is one calendar month (the SPA joins; Inventory never learns money). `/inventory/reports` keeps the usage columns and gains the AvT ones.

**Also 2026-09-15 — slots (D6):** recipes are edited as slots with defaults, overrides and size factors; every existing recipe migrated line-for-line into its own slots and deducts as before.

**Also 2026-09-15 — "Track items":** the cliff between a menu and a tracked menu is closed from the menu page: pick the untracked items, sell them as units in one go, or let the assistant propose a recipe each with the missing ingredients (`ai-assistant-plan.md`, "Track items"). The menu list shows a *Tracked* badge with the food cost per item, so what is left to do is visible.

**Fixed along the way (2026-09-15):** `recipe_lines.CatalogItemId` was a nullable shadow key, so saving a recipe again (the editor's normal path) left its old lines behind with no recipe instead of deleting them, and the sold-out lookup — which reads the key as an `int` — threw `Nullable object must have a value` on the next receipt or sale touching one of their ingredients. The relationship is now required (EF deletes a replaced line) and migration `RequireRecipeLineRecipe` deletes the orphans before making the column `NOT NULL`. The inventory E2E flow saves its recipe twice before the delivery so this cannot come back.

### Phase 5 — running the storeroom *(planned)*

Categories and storage areas on `StockItem` (additive migration); count sheets per area in shelf order, partial counts (only the area's items get `Count` movements), entry in packs, a blind mode that hides `Expected`; waste reason codes (a short editable list like Finance's expense categories) and a waste-by-reason report; `ParLevel` beside `ReorderLevel` and a **suggested order** list per branch (par − on hand, grouped by the supplier of the last receipt) shareable as text; a `Storekeeper` realm role and a `Stock` policy (count, receive, waste; no items, recipes or reports); `StockLow` pushed by `FcmService` to the manager's phone.

### Phase 6 — production and control *(planned)*

Sub-recipes: a stock item that is *made* (a `Production` movement pair: ingredients out, the prepared item in, at the summed cost, with a yield); supplier item catalog (item ↔ supplier, SKU, last cost per supplier, feeding the suggested order); period close (a `ClosedThrough` date per branch, movements before it refused); slow-moving report (no `Sale` movement in N days, valued); purchase orders only if the suggested-order list proves not enough.
