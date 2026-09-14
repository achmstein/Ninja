using Chillax.E2E.Actors;
using Chillax.E2E.Fixtures;
using Chillax.E2E.Harness;
using Chillax.E2E.Support;

namespace Chillax.E2E.Scenarios;

/// <summary>
/// Payroll feeding the P&amp;L: hiring, attendance and a wage paid from the
/// till each refresh the month's payslip and travel to Finance as labour,
/// the payslip is generated and paid, and then one of everything — a sale,
/// a refund, an expense, some waste — is put through so the month's profit
/// reconciles component by component against what the day did.
/// </summary>
public sealed class PayrollAndProfitScenario(ChillaxApp app, DaySetup day) : ScenarioBase(app, day)
{
    private const decimal BaristaDailyRate = 200m;

    [Fact]
    public async Task Hire_attend_pay_wages_generate_payslip_and_reconcile_profit()
    {
        var month = Money.Month(BusinessDay);

        // The shift that just opened may have clocked the cashier in for the first
        // time today, which itself changes labour; let that settle before baselining.
        await ExpectAsync("the cashier is marked present today", async () =>
            Assert.Contains(await Owner.AttendanceAsync(BusinessDay, BusinessDay, Ct), m => m.EmployeeId == Day.CashierEmployeeId && m.Status == Codes.Attendance.Present));
        await Task.Delay(TimeSpan.FromSeconds(3), Ct);
        var before = await Owner.ProfitAsync(month.Year, month.Month, Ct);

        // 1. Hire a barista: Payroll opens the month's draft for them, worth nothing yet.
        var hire = Step("Hire a barista at 200/day");
        var barista = await Owner.HireAsync($"E2E Barista {Day.RunId}", BusinessDay.AddDays(-1), BaristaDailyRate, Ct);
        var hired = await ExpectEventAsync(hire, "EmployeeEarningsChanged", e => e.Int("EmployeeId") == barista);
        Assert.Equal(0m, hired.Dec("NetEarned"));
        Assert.Equal(1, hired.Int("BranchId"));

        // 2. Mark them present today: a day's pay is earned, and Finance hears about it.
        var present = Step("Mark the barista present");
        await Owner.MarkPresentAsync(BusinessDay, barista, Ct);
        var earned = await ExpectEventAsync(present, "EmployeeEarningsChanged", e => e.Int("EmployeeId") == barista && e.Dec("NetEarned") == BaristaDailyRate);
        Assert.Equal(month.Start, DateOnly.Parse(earned.Str("PeriodStart")!, System.Globalization.CultureInfo.InvariantCulture));
        await ExpectAsync("Finance counted the day's pay as labour", async () =>
            Assert.Equal(BaristaDailyRate, (await Owner.ProfitAsync(month.Year, month.Month, Ct)).Since(before).Labour));

        // 3. The till pays 120 of it in cash: the ledger shows what was earned and what was paid.
        var wage = Step("Pay out 120 wage to the barista from the till");
        Assert.Equal(HttpStatusCode.OK, (await Cashier.PayOutAsync(ShiftId, 120m, "Evening wage", Ct,
            kind: Codes.MovementKind.Wage, employeeId: barista, employeeName: "Barista")).StatusCode);
        await ExpectEventAsync(wage, "CashPaidOut", e => e.Int("EmployeeId") == barista);
        await ExpectEventAsync(wage, "EmployeeEarningsChanged", e => e.Int("EmployeeId") == barista);
        await ExpectAsync("Payroll shows earned 200, paid 120, 80 owed", async () =>
        {
            var ledger = await Owner.LedgerAsync(barista, Ct);
            Assert.Contains(ledger.Entries, x => x.Type == Codes.LedgerEntry.Earned && x.Amount == BaristaDailyRate && x.Source == Codes.LedgerSource.Payslip);
            Assert.Contains(ledger.Entries, x => x.Type == Codes.LedgerEntry.Payment && x.Amount == 120m && x.Source == Codes.LedgerSource.TillPayOut);
            Assert.Equal(BaristaDailyRate - 120m, ledger.Balance);
        });
        await Task.Delay(TimeSpan.FromSeconds(2), Ct);
        Assert.Equal(BaristaDailyRate, (await Owner.ProfitAsync(month.Year, month.Month, Ct)).Since(before).Labour); // a payment is not more labour

        // 4. Generate the payslip for the month.
        var generate = Step("Generate the barista's payslip");
        var ids = await Owner.GeneratePayslipsAsync(barista, month.Start, month.End, Ct);
        var payslipId = Assert.Single(ids);
        var payslip = await Owner.PayslipAsync(payslipId, Ct);
        Assert.Equal(Codes.PayScheme.Daily, payslip.Scheme);
        Assert.Equal(BaristaDailyRate, payslip.Rate);
        Assert.Equal(1m, payslip.DaysWorked);
        Assert.Equal(BaristaDailyRate, payslip.Earned);
        Assert.Equal(120m, payslip.Payments);
        Assert.Equal(80m, payslip.AmountDue);
        Assert.Equal(80m, payslip.Remaining);
        Assert.Equal(Codes.Payslip.Draft, payslip.Status);
        await ExpectEventAsync(generate, "EmployeeEarningsChanged", e => e.Int("EmployeeId") == barista && e.Dec("NetEarned") == BaristaDailyRate);

        // 5. Pay the rest: the ledger closes to zero and Finance has nothing new to hear.
        var pay = Step("Pay the payslip");
        await Owner.PayPayslipAsync(payslipId, null, "month end", Ct);
        payslip = await Owner.PayslipAsync(payslipId, Ct);
        Assert.Equal(Codes.Payslip.Paid, payslip.Status);
        Assert.Equal(80m, payslip.PaidAmount);
        var closed = await Owner.LedgerAsync(barista, Ct);
        Assert.Equal(0m, closed.Balance);
        Assert.Contains(closed.Entries, x => x.Type == Codes.LedgerEntry.Payment && x.Amount == 80m && x.Reference!.EndsWith(":payment", StringComparison.Ordinal));
        await ExpectNoEventAsync(pay, "EmployeeEarningsChanged");

        // 6. One of everything else that lands on the P&L.
        var coffee = Menu.Item(MenuLookup.TurkishCoffee);
        var coffeeBill = Money.Bill(coffee.EffectivePrice, served: 0m, DaySetup.VatRate, DaySetup.ServiceRate); // 28.50, VAT 3.50
        var coffeeGoods = DaySetup.BeansPerCoffeeGrams * DaySetup.BeansUnitCost;                                 // 5.00
        var wasteGrams = 10m;
        var wasteCost = wasteGrams * DaySetup.BeansUnitCost;                                                    // 5.00
        var expenseAmount = 60m;

        var trade = Step("Sell a coffee for cash, pay an electricity bill from the till, waste 10 g of beans, refund the coffee");
        var sale = await Cashier.RingUpAsync(Menu, Lines((MenuLookup.TurkishCoffee, 1)), Ct);
        await ExpectEventAsync(trade, "StockConsumed", e => e.Str("Reference") == $"order:{sale.OrderId}" && e.Dec("Cost") == coffeeGoods);
        await Cashier.SettleAsync(sale.TicketId, Ct, Tender.Cash(coffeeBill.Total));
        await ExpectEventAsync(trade, "TicketSettled", e => e.Int("TicketId") == sale.TicketId);

        Assert.Equal(HttpStatusCode.OK, (await Cashier.PayOutAsync(ShiftId, expenseAmount, "Electricity", Ct,
            kind: Codes.MovementKind.Expense, categoryId: Day.ElectricityCategoryId)).StatusCode);
        await ExpectEventAsync(trade, "CashMoved", e => e.Str("Kind") == "Expense" && e.Dec("Amount") == expenseAmount);

        await Owner.PostWasteAsync(Day.BeansId, wasteGrams, "spilled", Ct);
        await ExpectEventAsync(trade, "StockConsumed", e => e.Str("Kind") == "Waste" && e.Dec("Cost") == wasteCost);

        var line = Assert.Single((await TicketAsync(sale.TicketId)).Lines);
        var refunded = await Owner.RefundAsync(sale.TicketId, [(line.Id, 1m)], "changed their mind", Ct);
        Assert.Equal(coffeeBill.Total, refunded.Amount);
        await ExpectEventAsync(trade, "TicketRefunded", e => e.Int("TicketId") == sale.TicketId);

        // 7. The month reconciles, component by component, against what the day did.
        Step("Reconcile the month's P&L");
        ProfitView after = before;
        await ExpectAsync("the month's P&L reflects every fact of the day", async () =>
        {
            after = await Owner.ProfitAsync(month.Year, month.Month, Ct);
            var d = after.Since(before);
            Assert.Equal(coffeeBill.Total, d.Sales);
            Assert.Equal(coffeeBill.Total, d.Refunds);
            Assert.Equal(0m, d.NetSales);
            Assert.Equal(coffeeBill.Vat, d.Vat);
            Assert.Equal(coffeeGoods, d.Goods);
            Assert.Equal(wasteCost, d.Waste);
            Assert.Equal(BaristaDailyRate, d.Labour);
            Assert.Equal(expenseAmount, d.Expenses);
            Assert.Equal(expenseAmount, d.Category(Day.ElectricityCategoryId));
            Assert.Equal(d.NetSales - d.Goods - d.Waste - d.Labour - d.Expenses, d.Profit);
        }, TimeSpan.FromSeconds(30));

        // The absolute figures obey the same arithmetic (FinanceQueries), and the partner's share follows.
        Assert.Equal(after.NetSales - after.Goods - after.Waste - after.Labour - after.Expenses, after.Profit);
        var share = Assert.Single(after.PartnerShares ?? [], s => s.PartnerId == Day.PartnerId);
        Assert.Equal(DaySetup.PartnerPercent, share.Percent);
        Assert.Equal(Math.Round(after.Profit * DaySetup.PartnerPercent / 100m, 2), share.Amount);

        App.Logs.AssertNoHandlerFailures(Checkpoint.Logs);
        AssertSameBusinessDay();
    }
}
