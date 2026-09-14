# Chillax Finance — Design & Plan

**Goal:** see where the café's money goes beyond stock and staff — rent, bills, repairs, the supplier tab, and what the owners take — so that a month can be read as sales, costs and profit, per branch, with the partners' money kept apart from the café's.

**Status:** decided 2026-09-13; all three phases built the same day.

---

## 1. Where we were

Money left the café through three doors and two were counted:

- **Stock** — `Inventory.API` receipts: supplier (free text), invoice, lines with unit cost. Every sale snapshots what it cost, so the cost of goods is a sum.
- **Staff** — `Payroll.API`: wages, salaries, advances, what is owed.
- **Everything else** — rent, electricity, gas, water, internet, repairs, ads, licences: nothing, unless it came out of the drawer, where it was a pay-out with a free-text reason. Nobody could say what a month cost, or whether it made money.

Three facts from the owner (2026-09-13) shaped the design: most non-stock expenses are paid **from the drawer**, some by an owner from outside; suppliers are sometimes paid **on a tab**; and there are **two owners at one branch and one at the other**, so an owner taking money must be recorded against *that* owner.

## 2. Decisions (owner, 2026-09-13)

### D1 — A new bounded context: `Finance.API`

`Finance.API` + `Finance.Domain` + `Finance.Infrastructure`, Payroll as the template, database `financedb`, schema `finance`, BFF route `/api/finance`. It owns expenses, supplier accounts and partner accounts, and (Phase 2) the profit-and-loss projection. Per the house rule it never calls another service: Sales, Inventory and Payroll tell it what happened through events; the SPA joins names where it must.

### D2 — Three registers, one shape each

- **Expense** — date, category, amount, how it was paid (drawer / bank / a partner's own money), vendor (free text, remembered), note, branch. Append-only; a mistake is voided with a reason and re-entered, like a receipt. Categories are a short editable list with sensible defaults (إيجار، كهرباء، غاز، مياه، إنترنت، صيانة، تسويق، رخص، أخرى).
- **Supplier account** — a supplier is a record (name, phone, notes); its account is a ledger per branch: **Invoice** (+, a delivery received), **Payment** (−), **Credit** (−, a return or a discount). Balance = what the café owes them. Paid on delivery is an invoice and a payment on the same day; a tab is invoices that wait.
- **Partner account** — a partner is a record with the branches they own. Their account per branch is a ledger: **Drawing** (−, money taken), **Contribution** (+, money put in, including an expense they paid from their own pocket). Balance = what the café holds of theirs. Drawings are never expenses and never touch the P&L.

### D3 — No double counting: cost lives in one place

- A delivery's **cost** is on the Inventory receipt and nowhere else. Paying that supplier from the drawer is a **payment on their account**, not an expense.
- Everything that is not stock and not staff is an **expense**, whether it left the drawer or a partner's pocket.
- Staff cost is Payroll's (earned, not paid). Partner drawings are equity, not cost.

### D4 — The till says what money was for

The POS pay-out already names staff. It gains three more kinds and their pickers: **مورد** (a supplier, from Finance's list — the payment goes on their account), **مصروف** (a category — an expense paid from the drawer) and **شريك** (a partner — a drawing). A pay-in gains **شريك** (a contribution). Sales publishes `CashMovedIntegrationEvent` for these, through the outbox, keyed on shift and movement; Finance posts the right line idempotently on `shift:{id}:movement:{id}`. The supplier picker shows **what the branch owes them** beside the name *(2026-09-14, `GET /till/suppliers` is branch-scoped for it)*, so a delivery man's "you owe us 3,400" can be checked on the spot; partners and categories carry no balance. Both tills have the dialog, `pos_web` and the Flutter `pos_app`.

### D5 — Suppliers come from Finance; Inventory keeps the id

Inventory's receipt gets a supplier picker (Finance's list, read by the SPA) and stores `SupplierId` beside the free-text name it already had. On receiving, Inventory publishes `PurchaseReceivedIntegrationEvent(PurchaseId, BranchId, SupplierId?, SupplierName, InvoiceRef, Total, ReceivedAt, ReceivedBy)`; Finance posts an **Invoice** on the supplier's account, idempotent on `purchase:{id}`. A receipt with no supplier picked posts nothing — it is stock without a creditor.

### D6 — Profit and loss is a projection *(built 2026-09-13)*

Per branch and month: net sales (Sales' `TicketSettled` / `TicketRefunded`, one `SalesFact` per ticket or credit note), cost of goods and waste (Inventory's new `StockConsumedIntegrationEvent`: what each sale or waste posting cost at the branch average, one `CostFact` per posting keyed on the event id), labour (Payroll's new `EmployeeEarningsChangedIntegrationEvent`: the period's net earnings, one `LabourFact` per employee-period, the latest value winning), operating expenses by category from the register → profit, margin, and prime cost (goods + labour) ÷ net sales. Facts carry the reference that produced them, so redelivery changes nothing; nothing is asked of another service at read time. Sales figures are the till's totals (VAT shown as a note when charged); partners' money is nowhere in it.

## 3. Model (schema `finance`)

| Entity | What it is |
|---|---|
| `ExpenseCategory` | `Name` (EN/AR), `DisplayOrder`, `IsActive`. Seeded with the defaults. |
| `Expense` (append-only) | `BranchId`, `Date`, `CategoryId`, `Amount`, `PaidFrom` (Drawer / Bank / Partner), `PartnerId?` (when a partner paid), `Vendor?`, `Note?`, `Reference?` (`shift:{id}:movement:{id}`), `Source` (Manual / Till), who, when, `VoidedAt?` + `VoidReason?`. Unique filtered index on `Reference`. |
| `Supplier` | `Name`, `Phone?`, `Notes?`, `IsActive`. |
| `SupplierEntry` (append-only) | `SupplierId`, `BranchId`, `Type` (Invoice / Payment / Credit), `Amount`, `Date`, `Note?`, `Reference?` (`purchase:{id}`, `shift:{id}:movement:{id}`), `Source` (Manual / Purchase / Till), who, when. Unique filtered index on `Reference`. |
| `Partner` | `Name`, `Phone?`, `UserId?`, `BranchIds` (integer[]), `IsActive`. |
| `PartnerEntry` (append-only) | `PartnerId`, `BranchId`, `Type` (Drawing / Contribution), `Amount`, `Date`, `Note?`, `Reference?`, `Source` (Manual / Till), who, when. Unique filtered index on `Reference`. |
| `SalesFact` / `CostFact` / `LabourFact` | The profit projection: (branch, date, kind, amount, reference unique) for sales and costs; (branch, employee, period, amount) for labour, unique per employee-period. |
| Sales: `CashMovement` | `Kind` gains **Expense** and **Partner**; new `SupplierId?`, `PartnerId?`, `CategoryId?` and the matching names. |
| Inventory: `Purchase` | gains `SupplierId?`. |

## 4. Flows

- **Expenses** — `GET /expenses?from&to` (branch, with category totals), `POST /expenses`, `POST /expenses/{id}/void`; `GET/POST/PUT /categories`.
- **Suppliers** — `GET /suppliers` (with the branch's balance), `POST`, `PUT`; `GET /suppliers/{id}/ledger`, `POST /suppliers/{id}/ledger` (a manual payment, credit or invoice).
- **Partners** — `GET /partners` (for the branch, with balance), `POST`, `PUT`; `GET /partners/{id}/ledger`, `POST /partners/{id}/ledger`.
- **Till** — `GET /till/suppliers`, `/till/partners`, `/till/categories` under the Pos policy: the pickers.
- **Events in** — `CashMovedIntegrationEvent` (Sales) → expense / supplier payment / partner drawing or contribution; `PurchaseReceivedIntegrationEvent` (Inventory) → supplier invoice. Both idempotent on the reference.
- Everything through `FinanceTransaction` (the mirror of `PayrollTransaction`): one transaction per command, outbox after commit, `x-requestid` on every POST.

## 5. Admin UI (`admin_web`)

A `navFinance` group, branch-scoped:

- **المصروفات** `/finance/expenses` — the month: totals by category, then the lines; add / void; a paperclip per line for the **bill's photo or PDF** (`ExpenseReceipt`, one per expense, 5 MB at most, kept in the database beside the line and served back as the file it was); export as CSV.
- **الموردين** `/finance/suppliers` — the list with what is owed; a sheet with the account and "record a payment".
- **الشركاء** `/finance/partners` — per branch: each partner's drawings and contributions; a sheet with the account (exportable) and, per branch they hold, their **share of its profit** in percent (`PartnerShare`; two at 50/50 at one branch, one at 100 at the other).
- **الأرباح** `/finance/profit` — the month as a statement (sales, refunds, net, goods, waste, wages, expenses by category, profit), the margin and prime cost as headline figures, the last six months as a table, **how the profit falls to the partners** by their shares (with a warning when the shares do not add up to 100), and export of either the month's statement or the trend as CSV.
- **POS** — the pay-out dialog's kinds become مورد / يومية / سلفة / مصروف / شريك / أخرى; a pay-in offers شريك / أخرى.
- **Inventory receipt** — a supplier picker.

## 6. Phases

1. **Registers, accounts, the till and the receipt feeds.** *(built 2026-09-13)*
2. **Profit and loss.** *(built 2026-09-13)* The three feeds, the fact tables, the page.
3. **Extras.** *(built 2026-09-13)* Recurring bills (`RecurringExpense`, posted by an hourly job once per month under `recurring:{id}:{yyyy-MM}`, a partner's contribution alongside); supplier invoices keyed in without a stock receipt; **owner-only** partners, P&L and pay changes (the Owner policy on those endpoints, the sidebar and the pay button follow); the dashboard's "this month in money" strip for owners; receipt photos on expenses; partners' profit shares and the split on the P&L; CSV export of expenses, supplier and partner accounts, the P&L and its trend.

## 7. Questions

- **Q1** *(answered)* Most non-stock expenses are paid from the drawer; some by an owner from outside → D4 + `PaidFrom`.
- **Q2** *(answered)* Suppliers are sometimes on a tab → supplier accounts in Phase 1 (D2, D5).
- **Q3** *(answered)* Money an owner takes is recorded against that owner; two owners at one branch, one at the other → partners per branch (D2), never in the P&L (D3).
