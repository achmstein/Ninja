# Chillax Payroll — Design & Plan

**Goal:** know who works at the café, whether they came in, what they are owed and what they were paid — for people paid by the day and people paid by the month — without a login for every runner and cleaner, and with the cash that leaves the drawer for a salary or an advance landing on the right person's account.

**Status:** decided 2026-09-13; all three phases built the same day (PIN clock-in deliberately left out).

---

## 1. Where we were

- **Staff were Keycloak users** (`Identity.API`, the `الموظفين` page): name, roles, branches. No pay terms anywhere, and a person who never touches a screen had no record at all.
- **Shifts** (Sales) know who opened and closed the drawer and publish `ShiftOpened` / `ShiftClosed` — attendance, but only for cashiers.
- **Pay-outs** (`CashMovement.PayOut`, free-text reason) are how a salary or an advance left the drawer: "سلفة أحمد 200". The drawer count stayed right; nothing knew who was paid what against what they were owed.
- **Accounts** already had the shape payroll needs: a ledger per person with typed lines and a running balance (`CustomerAccount`).

## 2. Decisions (owner, 2026-09-13)

### D1 — A new bounded context: `Payroll.API`

`Payroll.API` + `Payroll.Domain` + `Payroll.Infrastructure`, Inventory as the template, database `payrolldb`, schema `payroll`, BFF route `/api/payroll`. Not inside Sales (the drawer), not Identity (a Keycloak proxy), not Accounts (customer money). Per the house rule (D5b in `pos-plan.md`) Payroll never calls another service: it keeps ids, the admin SPA joins names, and money that leaves the till reaches it as an event (Phase 2).

### D2 — Employees are their own record; a login is optional

Identity is *who can sign in*; Payroll is *who works here*. `Employee` has its own id, its own name, job title, phone, home branch and pay terms, and an optional, unique `UserId` (Keycloak subject) for the ones who also have a login. Attendance, the ledger and payslips key on `EmployeeId`, never on the user id. A runner needs no account. Someone who leaves is `EndedOn = date`, never deleted — the ledger and old payslips stay. Payroll stores the name itself even for linked users: a payslip keeps the name it was issued under.

### D3 — The ledger is the truth; a payslip is a statement

Every amount owed or paid is one signed line on the employee's ledger: **Earned** (+), **Bonus** (+), **Deduction** (−), **Advance** (−), **Payment** (−). Balance = the sum = what the café owes the person. An advance is money already handed over, so it reduces what is due without anyone doing arithmetic. A payslip for a period posts the period's *Earned* line and reports the balance; paying it posts a *Payment*. Cadence is free: a daily worker paid every evening (Phase 2, from the till) and one paid weekly both come out right.

### D4 — Pay terms are dated; a change inside a period splits it *(revised 2026-09-13)*

`Daily(rate)` or `Monthly(salary)`, each with an `EffectiveFrom` date, kept as history, so a raise in March never rewrites February. A change inside a period does not need the period split by hand: `PayCalculator` cuts the period at every change and pays **each day at the terms in force that day** — a daily rate per day worked in its segment, a monthly salary prorated by the days its segment covered. Someone on 6000 a month until the 12th and 120 a day from the 13th gets 6000 × 12/30 plus 120 × the days worked after. The payslip carries the terms at the period's end and `TermsChangedOn`, and the pages say "pay changed on …" instead of pretending one rate describes the month.

### D5 — Attendance is marked by the manager, per day

A grid per branch and month; a tap cycles a day through Present → Half day → Day off → Absent → unmarked. "Mark everyone present today" is one button. Daily pay is days present × rate (a half day is half). Monthly staff are paid the salary, prorated only when the period starts or ends mid-way through their employment, less absence (D8). Cashier days are pre-filled from shift events (D7). No clock-in with PINs in v1. Overtime is D10.

### D8 — Paid days off for everyone; absence costs a monthly employee a thirtieth a day *(built 2026-09-13)*

Every employee has `PaidDaysOff` a month (default 4 — one a week — editable per person). The grid has four marks: **Present**, **Half day**, **Day off** (agreed rest, ☂) and **Absent** (a no-show, ✕).

- **Daily workers** are marked when they work. An agreed day off within the allowance is **paid like a worked day** — the owner's rule: they get their rest too, they are just paid per day. A day off beyond the allowance, and any absence, is simply unpaid.
- **Monthly staff** are marked **by exception**: an unmarked day is a working day. Days off and absences both draw on the allowance; every day away beyond it deducts **salary ÷ 30**, whatever the month's length, shown on the payslip as its own "absence" line. The ledger's Earned line is the net.

One allowance serves the whole period, used up in date order, at the rate of the segment each day fell in (D4). **Days off not taken carry to the next month, once**: a month's allowance is its own days plus what the previous month's payslip left unused; carried-in days are spent first, and only the month's own unused days move on, so the balance never exceeds two months' worth. Nothing else is automatic: a late arrival, a covered shift, a forgiven sick day are the manager's call as a manual Bonus or Deduction.


### D6 — Money leaves at the till; Payroll only records it *(built 2026-09-13)*

Everything staff are handed comes out of the drawer (Q1): a daily worker takes lunch money at noon and the rest of the day's wage in the evening; a monthly employee takes a سلفة mid-month and the salary at month end. `Shift.ExpectedCash` already subtracts pay-outs, so the drawer count stays right. The POS pay-out names what it was for — **Supplier / Wage / Advance / Other** (`CashMovementKind`) — and, for the two staff kinds, whom (Payroll's `EmployeeId`, picked from `GET /api/payroll/till/employees`, the one Payroll endpoint under the Pos policy). Sales raises `CashPaidOutIntegrationEvent` through the outbox; Payroll posts a **Payment** for a wage and an **Advance** for an advance, dated to the shift's business day, idempotent on `shift:{id}:movement:{id}` — the same reference-index guard Inventory uses. Payments made outside the drawer are entered on the payroll page as `Manual`.

Two consequences shaped the payslip:

- A payslip breaks out **Payments** (wages paid in the period) beside advances, so a daily worker paid every evening ends the month at zero rather than with a puzzling negative "carried over".
- **Paying a payslip settles what is owed *now***, not the figure frozen at generation: money the till handed over since then is already on the ledger and must not be paid twice. The pay dialog shows both; zero is a valid payment when the till paid it all.

### D7 — The cashier's day comes from the drawer *(built 2026-09-13)*

Sales now records the opener's subject id on the shift and sends it on `ShiftOpened`; Payroll marks the linked employee **Present** for the shift's business day, unless the manager already marked that day — the till never overrides a person. The business day is Cairo local time with a 06:00 cutoff (`BusinessDay`); the branch's own day window stays in Branch.API until it travels on an event.

### D9 — The current month's draft is kept alive *(built 2026-09-13)*

An account that showed only what a person was *given* until someone pressed "generate" read as "he owes us 500" for most of the month — true in accounting terms, wrong to the eye. So the month's draft payslip is now created and refreshed by every event that changes what the month is worth: a hire, a change of pay, a marked day, a pay-out from the till, a line keyed in by hand (`IPayslipGenerator.RefreshCurrentAsync`). A monthly employee's account shows the month's salary from the day they are hired, less what they have been given; a daily worker's earnings line grows as days are marked, so an evening's pay-out brings them back to zero. "Generate" on the payslips page remains for anyone nothing has happened to; a paid month is never touched. A negative balance is shown as **عليه** (he owes), not a minus sign.

### D10 — Overtime is hours on a worked day, paid at the hourly rate and a half *(built 2026-09-13)*

`AttendanceDay.OvertimeHours` (0–16, half hours allowed) is set from the grid with the "overtime" toggle on: tapping a worked day then asks for the hours instead of cycling it. A status tap never wipes the hours; a day marked away has none. An hour pays the day's hourly rate × 1.5, where a day is 8 hours and a monthly salary is 30 days (`PayCalculator.OvertimeHourRate`, the two constants beside it). The payslip carries `OvertimeHours` and `OvertimePay` on top of `Earned`; the Earned line's note shows "+ 3h". No night or holiday multipliers: one rate, the owner's call to change.

## 3. Model (schema `payroll`)

| Entity | What it is |
|---|---|
| `Employee` | `Name`, `JobTitle?`, `Phone?`, `BranchId`, `UserId?` (unique), `StartedOn`, `EndedOn?`, `IsActive` = no end date, `PaidDaysOff` (default 4). `PayTerms` history (owned rows): `EffectiveFrom`, `Scheme` (Daily / Monthly), `Rate`. `TermsOn(date)`. |
| `AttendanceDay` PK (EmployeeId, Date) | `BranchId`, `Status` (Present / HalfDay / Absent / DayOff), `Note?`, who, when. Upserted; clearing deletes. `DaysWorked` = 1 / 0.5 / 0 / 0; `DaysAbsent` the complement. |
| `LedgerEntry` (append-only) | `EmployeeId`, `Type` (Earned / Bonus / Deduction / Advance / Payment), positive `Amount`, `Signed` derived from the type, `Date` (the day it belongs to), `Note?`, `Reference?` (`payslip:{id}`, `payslip:{id}:payment`, `shift:{id}:movement:{id}`), `Source` (Manual / Payslip / TillPayOut), who, when. Unique filtered index on `Reference`. |
| `Payslip` | `EmployeeId`, `BranchId`, `PeriodStart`, `PeriodEnd`, `Scheme` + `Rate` at the period's end and `TermsChangedOn?`, `DaysWorked`, `PaidOffDays` (daily workers), `Earned`, `AbsentDays` + `AbsenceDeduction` (monthly staff), period sums of `Bonuses` / `Deductions` / `Advances` / `Payments`, `CarriedOver` (owed before the period), `AmountDue` (= carried over + earned − absence + bonuses − deductions − advances − payments), `Status` (Draft / Paid), `PaidAmount?`, `PaidAt?`, `PaidBy?`, `Note?`. One per employee per period start. A Draft can be regenerated (its Earned line is replaced) or deleted; Paid is frozen. The view adds `Remaining`: the balance right now, what paying it hands over. |
| Sales: `CashMovement` | gains `Kind` (Other / Supplier / Wage / Advance), `EmployeeId?`, `EmployeeName?`; `Shift` gains `OpenedByUserId?`. |

## 4. Flows

- **Employee** — `POST /employees`, `PUT /employees/{id}`, `PUT /employees/{id}/pay-terms` (appends dated terms; same date replaces), `POST /employees/{id}/leave`, `POST /employees/{id}/rehire`. `GET /employees` lists with current terms and balance.
- **Attendance** — `GET /attendance?from&to` for the branch (`X-Branch-Id`); `PUT /attendance/{date}` with `[{employeeId, status | null}]` upserts a day for many people at once (the grid sends one cell; "everyone present" sends them all).
- **Ledger** — `GET /employees/{id}/ledger?from&to` with the balance; `POST /employees/{id}/ledger` posts a Manual Bonus / Deduction / Advance / Payment.
- **Payslips** — `POST /payslips {employeeId?, periodStart, periodEnd}` generates for one employee or every active employee of the branch: reads attendance and terms, posts (or replaces) the `payslip:{id}` Earned line, freezes the sums. `POST /payslips/{id}/pay {amount?, note?}` posts a Payment (default the amount due) and marks it Paid. `DELETE /payslips/{id}` drops a draft and its Earned line.
- **Everything** goes through `PayrollTransaction` (the mirror of `InventoryTransaction`): one transaction per command, the outbox published after the commit, `x-requestid` idempotency on every POST.

## 5. Admin UI (`admin_web`)

A `navPayroll` group with three pages, all branch-scoped by the sidebar switcher:

- **الموظفين** `/payroll/employees` — the register: name, job, pay terms, balance owed, a "login" badge when linked. A sheet adds or edits an employee, sets dated pay terms, links a Keycloak account (picked from the staff accounts list, or **created right there** — owner only — with the name and branch filled in, a cashier by default, and linked the moment it exists), and shows the ledger with an "add entry" form; lines the till posted say so. The `/staff` page stays as **حسابات الدخول** under Administration for what is not payroll's business: roles, branches, accounts that belong to no employee (the owners).
- **POS** — the pay-out dialog gains the four kind buttons and, for Wage / Advance, the employee list; the reason writes itself ("يومية أحمد") and stays editable.
- **الحضور** `/payroll/attendance` — the month grid.
- **المرتبات** `/payroll/payslips` — a month picker, "generate for everyone", one row per employee with days, earned, adjustments, due and status, "pay" per row, a detail sheet with the breakdown, and **export** (the month as CSV, UTF-8 with a byte-order mark so Excel reads the Arabic).

## 6. Phases

1. **Register, attendance, ledger, payslips — all manual.** *(built 2026-09-13)* No other service touched.
2. **Till link.** *(built 2026-09-13)* Typed pay-out kinds on the POS with an employee picker, `CashPaidOutIntegrationEvent` from Sales, the idempotent handler in Payroll, `Payments` on the payslip, settle-what-is-owed-now. Cashier attendance pre-filled from `ShiftOpened`.
3. **Rules and reporting.** *(built 2026-09-13)* Absence (D8), labour beside net sales on the dashboard and the P&L (Finance), owner-only pay changes, overtime (D10), payslip export, "create login" from the employee sheet. PIN clock-in was dropped on purpose: attendance stays the manager's mark.

## 7. Questions

- **Q1** *(answered 2026-09-13)* Daily workers are paid from the drawer, in the evening, and may take some at noon for food. → D6: the cashier picks **Wage** or **Advance**; both land on the ledger.
- **Q3** *(answered by Q1)* Wage and Advance are two of the four kind buttons inside the existing pay-out dialog, with the employee list under them.
- **Q2** *(decided 2026-09-13 on the recommendation)* What an absent day costs a monthly employee → D8: an allowance of paid days off (default 4), then salary ÷ 30 per day away beyond it, marked by exception on the grid. The owner added that daily workers get paid days off too — an agreed day off within the same allowance is paid like a worked day (D8).
