using Chillax.E2E.Fixtures;
using Chillax.E2E.Harness;
using Chillax.E2E.Support;

namespace Chillax.E2E.Scenarios;

/// <summary>
/// Every kind of money in and out of the drawer during a shift ("draws"):
/// untyped pay-ins/outs that stay in the drawer, wages and advances that
/// travel to Payroll and on to Finance as labour, supplier payments,
/// expenses and partner drawings/contributions that travel to Finance —
/// plus the movements the till rejects and the ones it records but nobody
/// downstream accounts for. The drawer expectation is checked after each.
/// </summary>
public sealed class CashMovementsScenario(ChillaxApp app, DaySetup day) : ScenarioBase(app, day)
{
    protected override decimal OpeningFloat => 500m;

    private static string Reference(int shiftId, int movementId) => $"shift:{shiftId}:movement:{movementId}";

    [Fact]
    public async Task Every_kind_of_pay_in_and_pay_out()
    {
        var employee = Day.CashierEmployeeId;
        var supplier = Day.SupplierId;
        var partner = Day.PartnerId;
        var category = Day.ElectricityCategoryId;

        var supplierBefore = (await Owner.SupplierLedgerAsync(supplier, Ct)).Balance;
        var partnerBefore = (await Owner.PartnerLedgerAsync(partner, Ct)).Balance;

        async Task DrawerIs(decimal expected)
            => Assert.Equal(expected, (await CurrentShiftAsync()).ExpectedInDrawer);

        // The till picker's balance for a daily worker is the ledger balance: what an evening pay-out hands over.
        async Task TillPickerAgreesWithLedger()
        {
            var ledger = await Owner.LedgerAsync(employee, Ct);
            Assert.Equal(ledger.Entries.Sum(x => x.Signed), ledger.Balance);
            Assert.Equal(ledger.Balance, (await Cashier.TillEmployeesAsync(Ct)).Single(e => e.Id == employee).Balance);
        }

        // 1-2. Untyped: drawer only.
        var untyped = Step("Pay in 100 (Other) and pay out 40 (Other)");
        Assert.Equal(HttpStatusCode.OK, (await Cashier.PayInAsync(ShiftId, 100m, "Float top-up", Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Cashier.PayOutAsync(ShiftId, 40m, "Taxi", Ct)).StatusCode);
        await DrawerIs(560m);
        await ExpectNoEventAsync(untyped, "CashMoved");
        await ExpectNoEventAsync(untyped, "CashPaidOut");

        // 3. Wage: Payroll posts a Payment and refreshes the payslip, which Finance hears as labour.
        var wage = Step("Pay out 150 wage to the cashier");
        Assert.Equal(HttpStatusCode.OK, (await Cashier.PayOutAsync(ShiftId, 150m, "Evening wage", Ct,
            kind: Codes.MovementKind.Wage, employeeId: employee, employeeName: Day.CashierEmployeeName)).StatusCode);
        var wageEvent = await ExpectEventAsync(wage, "CashPaidOut", e => e.Int("ShiftId") == ShiftId && e.Dec("Amount") == 150m);
        Assert.Equal("Wage", wageEvent.Str("Kind"));
        Assert.Equal(employee, wageEvent.Int("EmployeeId"));
        await ExpectEventAsync(wage, "EmployeeEarningsChanged", e => e.Int("EmployeeId") == employee);
        var wageRef = Reference(ShiftId, wageEvent.Int("MovementId"));
        await ExpectAsync("Payroll put the wage on the cashier's ledger", async () =>
        {
            var ledger = await Owner.LedgerAsync(employee, Ct);
            var entry = Assert.Single(ledger.Entries, x => x.Reference == wageRef);
            Assert.Equal(Codes.LedgerEntry.Payment, entry.Type);
            Assert.Equal(150m, entry.Amount);
            Assert.Equal(Codes.LedgerSource.TillPayOut, entry.Source);
            Assert.Equal(BusinessDay, entry.Date);
        });
        await ExpectAsync("the till picker shows what is owed now", TillPickerAgreesWithLedger);
        await DrawerIs(410m);

        // 4. Advance.
        var advance = Step("Pay out 50 advance to the cashier");
        Assert.Equal(HttpStatusCode.OK, (await Cashier.PayOutAsync(ShiftId, 50m, "Advance", Ct,
            kind: Codes.MovementKind.Advance, employeeId: employee, employeeName: Day.CashierEmployeeName)).StatusCode);
        var advanceEvent = await ExpectEventAsync(advance, "CashPaidOut", e => e.Int("ShiftId") == ShiftId && e.Dec("Amount") == 50m);
        Assert.Equal("Advance", advanceEvent.Str("Kind"));
        await ExpectAsync("Payroll put the advance on the ledger", async () =>
        {
            var entry = Assert.Single((await Owner.LedgerAsync(employee, Ct)).Entries, x => x.Reference == Reference(ShiftId, advanceEvent.Int("MovementId")));
            Assert.Equal(Codes.LedgerEntry.Advance, entry.Type);
            Assert.Equal(50m, entry.Amount);
        });
        await ExpectAsync("the till picker follows the advance", TillPickerAgreesWithLedger);
        await DrawerIs(360m);

        // 5. Supplier: Finance posts a Payment on their account.
        var supplierPay = Step("Pay out 200 to the supplier");
        Assert.Equal(HttpStatusCode.OK, (await Cashier.PayOutAsync(ShiftId, 200m, "Beans invoice", Ct,
            kind: Codes.MovementKind.Supplier, supplierId: supplier, supplierName: Day.SupplierName)).StatusCode);
        var supplierEvent = await ExpectEventAsync(supplierPay, "CashMoved", e => e.Int("ShiftId") == ShiftId && e.Dec("Amount") == 200m);
        Assert.Equal("Supplier", supplierEvent.Str("Kind"));
        Assert.Equal("PayOut", supplierEvent.Str("Type"));
        Assert.Equal(supplier, supplierEvent.Int("SupplierId"));
        await ExpectAsync("Finance posted the supplier payment", async () =>
        {
            var ledger = await Owner.SupplierLedgerAsync(supplier, Ct);
            var entry = Assert.Single(ledger.Entries, x => x.Reference == Reference(ShiftId, supplierEvent.Int("MovementId")));
            Assert.Equal(Codes.SupplierEntry.Payment, entry.Type);
            Assert.Equal(200m, entry.Amount);
            Assert.Equal(Codes.FinanceSource.Till, entry.Source);
            Assert.Equal(BusinessDay, entry.Date);
            Assert.Equal(supplierBefore - 200m, ledger.Balance);
        });
        await DrawerIs(160m);

        // 6. Supplier kind without a supplier: the drawer records it, nobody else hears of it.
        var anonymousSupplier = Step("Pay out 30 as Supplier with no supplier picked");
        Assert.Equal(HttpStatusCode.OK, (await Cashier.PayOutAsync(ShiftId, 30m, "Cash and carry", Ct, kind: Codes.MovementKind.Supplier)).StatusCode);
        await ExpectNoEventAsync(anonymousSupplier, "CashMoved");
        Assert.Contains((await CurrentShiftAsync()).Movements, m => m.Amount == 30m && m.Kind == "Supplier" && m.SupplierId is null);
        await DrawerIs(130m);

        // 7. Expense: Finance records it from the drawer, source Till.
        var expense = Step("Pay out 60 electricity");
        Assert.Equal(HttpStatusCode.OK, (await Cashier.PayOutAsync(ShiftId, 60m, "Electricity bill", Ct,
            kind: Codes.MovementKind.Expense, categoryId: category)).StatusCode);
        var expenseEvent = await ExpectEventAsync(expense, "CashMoved", e => e.Int("ShiftId") == ShiftId && e.Dec("Amount") == 60m);
        Assert.Equal("Expense", expenseEvent.Str("Kind"));
        Assert.Equal(category, expenseEvent.Int("CategoryId"));
        await ExpectAsync("Finance recorded the expense", async () =>
        {
            var expenses = await Owner.ExpensesAsync(BusinessDay, BusinessDay, Ct);
            var entry = Assert.Single(expenses.Expenses, x => x.Reference == Reference(ShiftId, expenseEvent.Int("MovementId")));
            Assert.Equal(60m, entry.Amount);
            Assert.Equal(category, entry.CategoryId);
            Assert.Equal(Codes.PaidFrom.Drawer, entry.PaidFrom);
            Assert.Equal(Codes.FinanceSource.Till, entry.Source);
        });
        await DrawerIs(70m);

        // 8-9. Partner: a drawing out, a contribution in.
        var drawing = Step("Pay out 20 to the partner");
        Assert.Equal(HttpStatusCode.OK, (await Cashier.PayOutAsync(ShiftId, 20m, "Partner drawing", Ct,
            kind: Codes.MovementKind.Partner, partnerId: partner, partnerName: Day.PartnerName)).StatusCode);
        var drawingEvent = await ExpectEventAsync(drawing, "CashMoved", e => e.Int("ShiftId") == ShiftId && e.Dec("Amount") == 20m);
        Assert.Equal("Partner", drawingEvent.Str("Kind"));
        Assert.Equal("PayOut", drawingEvent.Str("Type"));
        await DrawerIs(50m);

        var contribution = Step("Pay in 300 from the partner");
        Assert.Equal(HttpStatusCode.OK, (await Cashier.PayInAsync(ShiftId, 300m, "Partner contribution", Ct,
            kind: Codes.MovementKind.Partner, partnerId: partner, partnerName: Day.PartnerName)).StatusCode);
        var contributionEvent = await ExpectEventAsync(contribution, "CashMoved", e => e.Int("ShiftId") == ShiftId && e.Dec("Amount") == 300m);
        Assert.Equal("PayIn", contributionEvent.Str("Type"));
        await ExpectAsync("Finance posted the drawing and the contribution", async () =>
        {
            var ledger = await Owner.PartnerLedgerAsync(partner, Ct);
            var draw = Assert.Single(ledger.Entries, x => x.Reference == Reference(ShiftId, drawingEvent.Int("MovementId")));
            Assert.Equal(Codes.PartnerEntry.Drawing, draw.Type);
            Assert.Equal(20m, draw.Amount);
            var contrib = Assert.Single(ledger.Entries, x => x.Reference == Reference(ShiftId, contributionEvent.Int("MovementId")));
            Assert.Equal(Codes.PartnerEntry.Contribution, contrib.Type);
            Assert.Equal(300m, contrib.Amount);
            Assert.Equal(partnerBefore - 20m + 300m, ledger.Balance);
        });
        await DrawerIs(350m);

        // 10. Supplier pay-in: published, but Finance has nothing to book for it.
        var supplierIn = Step("Pay in 10 from the supplier (a refund of sorts)");
        Assert.Equal(HttpStatusCode.OK, (await Cashier.PayInAsync(ShiftId, 10m, "Supplier refund", Ct,
            kind: Codes.MovementKind.Supplier, supplierId: supplier, supplierName: Day.SupplierName)).StatusCode);
        var supplierInEvent = await ExpectEventAsync(supplierIn, "CashMoved", e => e.Int("ShiftId") == ShiftId && e.Dec("Amount") == 10m);
        Assert.Equal("PayIn", supplierInEvent.Str("Type"));
        await Task.Delay(TimeSpan.FromSeconds(2), Ct);
        Assert.DoesNotContain((await Owner.SupplierLedgerAsync(supplier, Ct)).Entries, x => x.Reference == Reference(ShiftId, supplierInEvent.Int("MovementId")));
        await DrawerIs(360m);

        // 11-12. The till refuses what makes no sense.
        var refused = Step("Try a wage pay-in and an expense without a category");
        var movementsBefore = (await CurrentShiftAsync()).Movements.Count;
        Assert.Equal(HttpStatusCode.BadRequest, (await Cashier.PayInAsync(ShiftId, 100m, "Wage back?", Ct,
            kind: Codes.MovementKind.Wage, employeeId: employee)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Cashier.PayOutAsync(ShiftId, 10m, "Something", Ct,
            kind: Codes.MovementKind.Expense)).StatusCode);
        Assert.Equal(movementsBefore, (await CurrentShiftAsync()).Movements.Count);
        await ExpectNoEventAsync(refused, "CashMoved");
        await ExpectNoEventAsync(refused, "CashPaidOut");
        await DrawerIs(360m);

        // 13. An employee Payroll does not know: the event is published, Payroll warns and skips, nothing throws.
        var unknown = Step("Pay out 15 wage to employee 999999");
        Assert.Equal(HttpStatusCode.OK, (await Cashier.PayOutAsync(ShiftId, 15m, "Casual", Ct,
            kind: Codes.MovementKind.Wage, employeeId: 999999, employeeName: "Nobody")).StatusCode);
        await ExpectEventAsync(unknown, "CashPaidOut", e => e.Int("EmployeeId") == 999999);
        await DrawerIs(345m);

        // 14. Close: 500 + (100 + 300 + 10) - (40 + 150 + 50 + 200 + 30 + 60 + 20 + 15) = 345.
        var close = Step("Close counting 340");
        var z = await Cashier.CloseShiftAsync(ShiftId, 340m, Ct);
        Assert.Equal(345m, z.ExpectedCash);
        Assert.Equal(-5m, z.OverShort);
        await ExpectEventAsync(close, "ShiftClosed", e => e.Int("ShiftId") == ShiftId);

        // Every published movement carried its own id.
        var moved = Events.Since(Checkpoint.Events, "CashMoved").Where(e => e.Int("ShiftId") == ShiftId).ToList();
        var paidOut = Events.Since(Checkpoint.Events, "CashPaidOut").Where(e => e.Int("ShiftId") == ShiftId).ToList();
        Assert.Equal(5, moved.Count);
        Assert.Equal(3, paidOut.Count);
        var ids = moved.Concat(paidOut).Select(e => e.Int("MovementId")).ToList();
        Assert.Equal(ids.Count, ids.Distinct().Count());

        App.Logs.AssertNoHandlerFailures(Checkpoint.Logs);
        AssertSameBusinessDay();
    }
}
