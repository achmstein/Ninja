# Chillax Inventory — Design & Plan

**Goal:** know what is on the shelf, get warned before it runs out, take items off the menu when it does, and see where stock goes: easy for a café to run day to day, powerful enough to price a latte's ingredients.

**Status:** decided and built 2026-09-12 (Phase 1). Phases 2–3 listed at the end.

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

### D5 — No reservations; counts fix drift

Inventory does not join the order validation saga. A momentary oversell between two racing orders is accepted; the level goes negative and the next count corrects it. Counts are also what heals a lost bus message. `StockLevel` is a projection of the append-only ledger and can be rebuilt from it.

## 3. Model (schema `inventory`)

| Entity | What it is |
|---|---|
| `StockItem` (global) | Name (EN/AR), base `Unit` (pcs / g / ml), optional `PackSize` + `PackName` for receiving ("bag" = 1000 g), `AutoSoldOut`, `IsActive`. |
| `StockLevel` PK (BranchId, StockItemId) | `OnHand`, `ReorderLevel?`, `AvgUnitCost`. Moved only by `StockLedger` under a row lock (`SELECT … FOR UPDATE`, created with `INSERT … ON CONFLICT DO NOTHING`), never through the change tracker: an optimistic-concurrency throw in a bus handler would be a lost deduction, a row lock is a short wait. |
| `StockMovement` (append-only) | BranchId, StockItemId, `Type` (Purchase / Sale / Waste / Count / Adjustment), signed `Quantity`, `UnitCost` snapshot (the branch average at posting; a receipt at its own price), `Reference?` (`order:{id}`, `purchase:{id}`, `count:{id}`), `Reason?`, who, when. Unique filtered index on `(Reference, StockItemId)`: the redelivery and retry guard. |
| `Recipe` PK CatalogItemId | Lines of (StockItemId, Quantity per unit sold, `OptionIds` integer[]). Empty = base line, used by every unit sold; otherwise the line is used only when **all** of its options were chosen, so a bag that exists for a combination (medium roast + spiced) is one line tied to both options (migration `RecipeLineOptionSets`, 2026-09-12). Only single-option lines drive per-option sold-out. `Explode(units, chosenOptionIds)` is pure. |
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
