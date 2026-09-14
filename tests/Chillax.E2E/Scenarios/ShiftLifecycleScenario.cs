using Chillax.E2E.Actors;
using Chillax.E2E.Fixtures;
using Chillax.E2E.Harness;
using Chillax.E2E.Support;

namespace Chillax.E2E.Scenarios;

/// <summary>
/// A cashier's custody of the drawer from open to close: the branch opens
/// for business with the shift (Branch.API), the cashier is marked present
/// (Payroll), the drawer arithmetic follows every cash movement, and the
/// Z report freezes the verdict when the branch closes again.
/// </summary>
public sealed class ShiftLifecycleScenario(ChillaxApp app, DaySetup day) : ScenarioBase(app, day)
{
    protected override decimal OpeningFloat => 500m;

    [Fact]
    public async Task Open_sell_move_cash_refund_close()
    {
        var cashierSubject = Day.CashierIdentity.Subject;

        // 1. Opening the shift opened the branch and clocked the cashier in.
        var opened = await ExpectEventAsync(BeforeShift, "ShiftOpened", e => e.Int("ShiftId") == ShiftId);
        Assert.Equal(1, opened.Int("BranchId"));
        Assert.Equal(cashierSubject, opened.Str("OpenedByUserId"));
        var flagsOn = await ExpectEventAsync(BeforeShift, "BranchSettingsChanged", e => e.Int("BranchId") == 1);
        Assert.True(flagsOn.Bool("IsOrderingEnabled"));
        Assert.True(flagsOn.Bool("IsReservationsEnabled"));

        var shift = await CurrentShiftAsync();
        Assert.Equal("Open", shift.Status);
        Assert.Equal(500m, shift.OpeningFloat);
        Assert.Equal(500m, shift.ExpectedInDrawer);
        Assert.Empty(shift.Movements);

        await ExpectAsync("Branch.API turned the trading flags on", async () =>
        {
            var branch = (await Cashier.BranchesAsync(Ct)).Single(b => b.Id == 1);
            Assert.True(branch.IsOrderingEnabled);
            Assert.True(branch.IsReservationsEnabled);
        });
        // Payroll clocks the cashier in on the first shift of the business day only;
        // a later shift the same day finds the mark already there and leaves it.
        await ExpectAsync("Payroll marked the cashier present for the business day", async () =>
        {
            var marks = await Owner.AttendanceAsync(BusinessDay, BusinessDay, Ct);
            var mine = Assert.Single(marks, m => m.EmployeeId == Day.CashierEmployeeId);
            Assert.Equal(Codes.Attendance.Present, mine.Status);
            Assert.Equal("till", mine.MarkedBy);
            Assert.StartsWith("shift:", mine.Note, StringComparison.Ordinal);
        });
        await ExpectHubAsync(BeforeShift, "BranchSettingsChanged", m => m.Int("branchId") == 1 && m.Bool("isOrderingEnabled"));

        // 2. One drawer per branch.
        var again = Step("Try to open a second shift");
        using (var r = await Cashier.TryOpenShiftAsync(100m, Ct))
        {
            Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
            Assert.Contains("already", await r.Content.ReadAsStringAsync(Ct), StringComparison.OrdinalIgnoreCase);
        }
        await ExpectNoEventAsync(again, "ShiftOpened");

        // 3. A cash sale: 25.00 + 14 % VAT = 28.50, paid with 30.
        var coffee = Menu.Item(MenuLookup.TurkishCoffee);
        var bill = Money.Bill(coffee.EffectivePrice, served: 0m, DaySetup.VatRate, DaySetup.ServiceRate);
        Assert.Equal(28.50m, bill.Total);

        var sale = Step("Ring up one Turkish Coffee and settle it with 30 cash");
        var rung = await Cashier.RingUpAsync(Menu, Lines((MenuLookup.TurkishCoffee, 1)), Ct);
        var settle = await Cashier.SettleAsync(rung.TicketId, Ct, Tender.Cash(30m));
        Assert.Equal(1.50m, settle.Change);
        Assert.True(settle.ReceiptNumber > 0);
        await ExpectEventAsync(sale, "TicketSettled", e => e.Int("TicketId") == rung.TicketId && e.Dec("Total") == bill.Total);

        shift = await CurrentShiftAsync();
        Assert.Equal(1, shift.TicketsSettled);
        Assert.Equal(28.50m, shift.SalesTotal);
        Assert.Equal(1.50m, shift.ChangeGiven);
        var cash = Assert.Single(shift.TenderTotals, t => t.Tender == "Cash");
        Assert.Equal(30m, cash.Amount);
        Assert.Equal(528.50m, shift.ExpectedInDrawer);

        // 4/5. Untyped pay-in / pay-out: drawer only, no event for anyone.
        var movements = Step("Pay in 100 (change from the safe) and pay out 40 (taxi)");
        using (var r = await Cashier.PayInAsync(ShiftId, 100m, "Change from the safe", Ct))
            Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        using (var r = await Cashier.PayOutAsync(ShiftId, 40m, "Taxi", Ct))
            Assert.Equal(HttpStatusCode.OK, r.StatusCode);

        shift = await CurrentShiftAsync();
        Assert.Equal(100m, shift.PayInsTotal);
        Assert.Equal(40m, shift.PayOutsTotal);
        Assert.Equal(588.50m, shift.ExpectedInDrawer);
        Assert.Equal(2, shift.Movements.Count);
        Assert.Contains(shift.Movements, m => m.Type == "PayIn" && m.Kind == "Other" && m.Amount == 100m);
        Assert.Contains(shift.Movements, m => m.Type == "PayOut" && m.Kind == "Other" && m.Amount == 40m);
        await ExpectNoEventAsync(movements, "CashMoved");
        await ExpectNoEventAsync(movements, "CashPaidOut");

        // 6. The owner refunds the coffee in cash: everything left on the receipt comes back.
        var refund = Step("Owner refunds the coffee in cash");
        var ticket = await TicketAsync(rung.TicketId);
        var line = Assert.Single(ticket.Lines);
        var refunded = await Owner.RefundAsync(rung.TicketId, [(line.Id, 1m)], "cold", Ct);
        Assert.Equal(28.50m, refunded.Amount);
        var refundEvent = await ExpectEventAsync(refund, "TicketRefunded", e => e.Int("TicketId") == rung.TicketId);
        Assert.Equal(28.50m, refundEvent.Dec("Amount"));
        Assert.Equal("Cash", refundEvent.Str("Tender"));

        shift = await CurrentShiftAsync();
        Assert.Equal(28.50m, shift.RefundsTotal);
        Assert.Equal(28.50m, shift.CashRefunds);
        Assert.Equal(560.00m, shift.ExpectedInDrawer);

        // 7. Count the drawer 5 short. ExpectedCash = 500 + 30 - 1.50 - 28.50 + 100 - 40 (Shift.Close).
        var close = Step("Close the shift counting 555");
        var z = await Cashier.CloseShiftAsync(ShiftId, 555m, Ct);
        Assert.Equal("Closed", z.Status);
        Assert.Equal(560.00m, z.ExpectedCash);
        Assert.Equal(555m, z.ClosingCount);
        Assert.Equal(-5.00m, z.OverShort);
        Assert.Equal(z.ExpectedCash, z.ExpectedInDrawer);

        var closed = await ExpectEventAsync(close, "ShiftClosed", e => e.Int("ShiftId") == ShiftId);
        Assert.Equal(1, closed.Int("BranchId"));
        var flagsOff = await ExpectEventAsync(close, "BranchSettingsChanged", e => e.Int("BranchId") == 1);
        Assert.False(flagsOff.Bool("IsOrderingEnabled"));
        Assert.False(flagsOff.Bool("IsReservationsEnabled"));

        Assert.Null(await Cashier.CurrentShiftAsync(Ct));
        var stored = await Cashier.ShiftAsync(ShiftId, Ct);
        Assert.Equal(z.ExpectedCash, stored.ExpectedCash);
        Assert.Equal(z.OverShort, stored.OverShort);

        await ExpectAsync("Branch.API turned the trading flags off", async () =>
        {
            var branch = (await Cashier.BranchesAsync(Ct)).Single(b => b.Id == 1);
            Assert.False(branch.IsOrderingEnabled);
            Assert.False(branch.IsReservationsEnabled);
        });
        await ExpectHubAsync(close, "BranchSettingsChanged", m => m.Int("branchId") == 1 && !m.Bool("isOrderingEnabled"));

        // 8. With the branch closed, Ordering turns customers away (its projection of the flag).
        await ExpectAsync("Ordering refuses customer orders while the branch is closed", async () =>
        {
            using var r = await Customer.TryPlaceOrderAsync(Menu, Lines((MenuLookup.Tea, 1)), Ct, tableId: 1, tableNameEn: "Table 1");
            Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
            Assert.Contains("not taking orders", await r.Content.ReadAsStringAsync(Ct), StringComparison.OrdinalIgnoreCase);
        });

        App.Logs.AssertNoHandlerFailures(Checkpoint.Logs);
        AssertSameBusinessDay();
    }

    /// <summary>
    /// docs/payroll-plan.md D9: the month's draft payslip is refreshed by
    /// "every event that changes what the month is worth ... a marked day".
    /// A day the till marks through ShiftOpened is such a day, so the
    /// cashier's Earned line, the till picker's balance and Finance's labour
    /// figure should follow it without waiting for a pay-out or a manual mark.
    /// Observed on the run's first shift (see DaySetup).
    /// </summary>
    [Fact]
    public void Till_marked_attendance_refreshes_the_payslip_and_reaches_finance()
    {
        Assert.True(Day.TillAttendanceRefreshedEarnings,
            "ShiftOpened marked the cashier present, but no EmployeeEarningsChanged followed: " +
            "Payroll's ShiftOpenedIntegrationEventHandler adds the AttendanceDay without IPayslipGenerator.RefreshCurrentAsync, " +
            "so the Earned line, the till picker balance and Finance labour lag until something else refreshes the month.");
    }
}
