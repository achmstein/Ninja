using Microsoft.EntityFrameworkCore;
using Ninja.Sales.API.Application.Queries;
using Ninja.Sales.Domain.AggregatesModel.ShiftAggregate;
using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;
using Ninja.Sales.Infrastructure;

namespace Ninja.Sales.UnitTests.Application;

/// <summary>
/// The reports agree on the money. One day's sales — a cash sale with change
/// and a loyalty discount, a delivery with its fee, a table bill with a line
/// and a bill discount, a sale before the business day started, a partial
/// refund, a void — read the same through the range report, the daily
/// report, the breakdown's items and the shift: gross less refunds is net
/// sales everywhere, and the items and the delivery fees add up to gross.
/// </summary>
[TestClass]
public class SalesReportsTest
{
    private const int Branch = 7;

    // 14% VAT added on top, no service: every figure below is worked by hand
    private static readonly PricingRules Rules = new(0.14m, pricesIncludeVat: false, serviceChargeRate: 0m);

    private static readonly DateTime From = new(2026, 10, 19, 3, 0, 0, DateTimeKind.Utc); // 06:00 local, +3
    private static readonly DateTime To = new(2026, 10, 21, 3, 0, 0, DateTimeKind.Utc);
    private static readonly TimeOnly DayStart = new(6, 0);

    /// <summary>
    /// A zone like Cairo's, pinned so the tests never hang on the machine's
    /// time-zone data: +2, and +3 in summer until 30 October.
    /// </summary>
    private static readonly TimeZoneInfo Zone = TimeZoneInfo.CreateCustomTimeZone(
        "Test/Cairo", TimeSpan.FromHours(2), "Test Cairo", "Test Cairo", "Test Cairo Summer",
        [
            TimeZoneInfo.AdjustmentRule.CreateAdjustmentRule(
                new DateTime(2020, 1, 1), new DateTime(2030, 12, 31), TimeSpan.FromHours(1),
                TimeZoneInfo.TransitionTime.CreateFixedDateRule(new DateTime(1, 1, 1, 0, 0, 0), 4, 24),
                TimeZoneInfo.TransitionTime.CreateFixedDateRule(new DateTime(1, 1, 1, 0, 0, 0), 10, 30)),
        ]);

    private static SalesContext NewContext() =>
        new(new DbContextOptionsBuilder<SalesContext>().UseInMemoryDatabase($"sales-{Guid.NewGuid()}").Options);

    private static TicketLine Item(int catalogItemId, string name, decimal qty, decimal price, decimal discount = 0)
        => new(TicketLineSource.Order, new LocalizedText(name, null), qty, price, discount, catalogItemId: catalogItemId);

    private static TicketLine Fee(decimal fee)
        => new(TicketLineSource.DeliveryFee, new LocalizedText("Delivery fee", "رسوم التوصيل"), 1, fee);

    private static void SettledAt(SalesContext context, Ticket ticket, DateTime at)
        => context.Entry(ticket).Property(t => t.SettledAt).CurrentValue = at;

    private sealed record Day(SalesContext Context, Ticket Cash, Ticket Delivery, Ticket Table, Ticket Early, Refund Refund, Shift Shift);

    /// <summary>The day the reports are read over; every ticket on one open shift.</summary>
    private static async Task<Day> ADayAsync()
    {
        var context = NewContext();
        var shift = new Shift(Branch, openingFloat: 200, openedBy: "Omar");
        context.Shifts.Add(shift);
        await context.SaveChangesAsync();

        // Two lattes, 20 off in points: 80 + 14% = 91.20, paid with 100
        var cash = Ticket.OpenForCounter(Branch);
        cash.AppendOrder(1, [Item(12, "Latte", 2, 50)], loyaltyDiscount: 20);
        cash.Settle([new Payment(PaymentTender.Cash, 100, "Omar")], "Omar", shift.Id, Rules);

        // A latte delivered for a 20 fee: 70 + 14% = 79.80, the fee 22.80 of it
        var delivery = Ticket.OpenForDelivery(Branch, "#2");
        delivery.AppendOrder(2, [Item(12, "Latte", 1, 50), Fee(20)], loyaltyDiscount: 0);
        delivery.Settle([new Payment(PaymentTender.Card, 79.80m, "Omar")], "Omar", shift.Id, Rules);

        // A cake with 10 off the line and 10% off the bill: 81 + 14% = 92.34
        var table = Ticket.OpenForTable(5, new LocalizedText("Table 5", null), Branch);
        table.AppendOrder(3, [Item(13, "Cake", 1, 100, discount: 10)], loyaltyDiscount: 0);
        table.ApplyDiscount(0.10m, null, "Regular", "Omar", null);
        table.Settle([new Payment(PaymentTender.InstaPay, 92.34m, "Omar")], "Omar", shift.Id, Rules);

        // A latte at 05:00 local: the business day before
        var early = Ticket.OpenForCounter(Branch);
        early.AppendOrder(4, [Item(12, "Latte", 1, 50)], loyaltyDiscount: 0);
        early.Settle([new Payment(PaymentTender.Cash, 57, "Omar")], "Omar", shift.Id, Rules);

        // Voided: never a sale
        var voided = Ticket.OpenForCounter(Branch);
        voided.AppendOrder(5, [Item(12, "Latte", 3, 50)], loyaltyDiscount: 0);
        voided.Void("Walked out", "owner", rules: Rules);

        context.Tickets.AddRange(cash, delivery, table, early, voided);
        SettledAt(context, cash, new DateTime(2026, 10, 20, 10, 0, 0, DateTimeKind.Utc));
        SettledAt(context, delivery, new DateTime(2026, 10, 20, 11, 0, 0, DateTimeKind.Utc));
        SettledAt(context, table, new DateTime(2026, 10, 20, 12, 0, 0, DateTimeKind.Utc));
        SettledAt(context, early, new DateTime(2026, 10, 20, 2, 0, 0, DateTimeKind.Utc));
        context.Entry(voided).Property(t => t.VoidedAt).CurrentValue = new DateTime(2026, 10, 20, 12, 30, 0, DateTimeKind.Utc);
        await context.SaveChangesAsync();

        // One of the two lattes back: 50 at 0.912 a pound = 45.60, 5.60 of it VAT
        var latte = cash.Lines.Single(l => l.Total > 0);
        var refund = Refund.Issue(1, cash, 1, [], [new RefundRequestLine(latte.Id, 1)], "Cold", PaymentTender.Online, null, null, "Sara", shift.Id);
        context.Refunds.Add(refund);
        context.Entry(refund).Property(r => r.RefundedAt).CurrentValue = new DateTime(2026, 10, 20, 13, 0, 0, DateTimeKind.Utc);
        await context.SaveChangesAsync();

        return new Day(context, cash, delivery, table, early, refund, shift);
    }

    [TestMethod]
    public async Task The_range_report_takes_refunds_off_gross_to_make_net_sales()
    {
        var day = await ADayAsync();
        await using var _ = day.Context;

        var report = await new TicketQueries(day.Context).GetRangeReportAsync(Branch, From, To);

        Assert.AreEqual(4, report.TicketsSettled, "the void is not a sale");
        Assert.AreEqual(320.34m, report.GrossSales);
        Assert.AreEqual(report.GrossSales, report.Net, "Net stays gross for the screens that read it");
        Assert.AreEqual(45.60m, report.Refunds);
        Assert.AreEqual(274.74m, report.NetSales);
        Assert.AreEqual(39.34m, report.Vat);
        Assert.AreEqual(39.34m, report.VatAdded);
        Assert.AreEqual(5.60m, report.RefundVat);
        Assert.AreEqual(241.00m, report.NetSalesExVat, "net sales less the VAT kept: 274.74 - (39.34 - 5.60)");
        Assert.AreEqual(9m, report.BillDiscounts);
        Assert.AreEqual(10m, report.LineDiscounts);
        Assert.AreEqual(20m, report.LoyaltyAndPromo);
        Assert.AreEqual(39m, report.Discounts);
        Assert.AreEqual(22.80m, report.DeliveryFees, "the fee with its VAT");
    }

    [TestMethod]
    public async Task Cash_is_reported_net_of_change_and_the_tenders_add_up_to_gross()
    {
        var day = await ADayAsync();
        await using var _ = day.Context;

        var report = await new TicketQueries(day.Context).GetRangeReportAsync(Branch, From, To);

        var cash = report.TenderTotals.Single(t => t.Tender == "Cash");
        Assert.AreEqual(148.20m, cash.Amount, "91.20 kept of the 100 handed over, and 57 exact");
        Assert.AreEqual(157m, cash.Tendered);
        Assert.AreEqual(157m, report.CashTendered);
        Assert.AreEqual(8.80m, report.ChangeGiven);
        Assert.AreEqual(79.80m, report.TenderTotals.Single(t => t.Tender == "Card").Tendered);
        Assert.AreEqual(report.GrossSales, report.TenderTotals.Sum(t => t.Amount));
    }

    [TestMethod]
    public async Task Delivery_and_platform_bills_have_a_channel_of_their_own()
    {
        var day = await ADayAsync();
        await using var _ = day.Context;

        var report = await new TicketQueries(day.Context).GetRangeReportAsync(Branch, From, To);

        CollectionAssert.AreEqual(
            new[] { new ChannelTotal("Counter", 2, 148.20m), new ChannelTotal("Delivery", 1, 79.80m), new ChannelTotal("Table", 1, 92.34m) },
            report.ByChannel.ToArray());
        Assert.AreEqual(3, report.ByType.Single(t => t.Type == "Counter").Count, "by type a delivery is still a counter bill");
    }

    [TestMethod]
    public async Task Items_are_valued_at_what_was_paid_for_them_and_net_of_what_went_back()
    {
        var day = await ADayAsync();
        await using var _ = day.Context;

        var report = await new TicketQueries(day.Context).GetBreakdownAsync(Branch, From, To, 0, Zone);

        Assert.IsFalse(report.ByItem.Any(i => i.Description.En == "Delivery fee"), "the fee is not a thing sold");
        var latte = report.ByItem.Single(i => i.CatalogItemId == 12);
        Assert.AreEqual(4m, latte.Qty);
        Assert.AreEqual(205.20m, latte.Amount, "91.20 + 57 (its delivery's share less the fee) + 57");
        Assert.AreEqual(200m, latte.MenuAmount);
        Assert.AreEqual(1m, latte.RefundedQty);
        Assert.AreEqual(45.60m, latte.RefundedAmount);
        Assert.AreEqual(3m, latte.NetQty);
        Assert.AreEqual(159.60m, latte.NetAmount);
        var cake = report.ByItem.Single(i => i.CatalogItemId == 13);
        Assert.AreEqual(92.34m, cake.Amount);
        Assert.AreEqual(90m, cake.MenuAmount);

        var range = await new TicketQueries(day.Context).GetRangeReportAsync(Branch, From, To);
        Assert.AreEqual(range.GrossSales, report.ByItem.Sum(i => i.Amount) + range.DeliveryFees, "items and delivery make up the sales");
    }

    [TestMethod]
    public async Task The_daily_report_cuts_business_days_and_agrees_with_the_range()
    {
        var day = await ADayAsync();
        await using var _ = day.Context;
        var queries = new TicketQueries(day.Context);

        var daily = await queries.GetDailyReportAsync(Branch, From, To, Zone, DayStart);
        var range = await queries.GetRangeReportAsync(Branch, From, To);

        CollectionAssert.AreEqual(
            new[]
            {
                new DailySales(new DateOnly(2026, 10, 19), 1, 57m, 0m, 57m, 0),
                new DailySales(new DateOnly(2026, 10, 20), 3, 263.34m, 45.60m, 217.74m, 1),
            },
            daily.Days.ToArray(),
            "the 05:00 latte is the day before's");
        Assert.AreEqual(range.NetSales, daily.Days.Sum(d => d.NetSales));
        Assert.AreEqual("06:00", daily.DayStart);
    }

    [TestMethod]
    public async Task A_business_day_across_the_clock_change_is_read_at_each_moments_offset()
    {
        await using var context = NewContext();
        var ticket = Ticket.OpenForCounter(Branch);
        ticket.AddManualLine(new LocalizedText("Latte", null), 1, 50, 0, "Omar");
        ticket.Settle([new Payment(PaymentTender.Cash, 50, "Omar")], "Omar");
        context.Tickets.Add(ticket);
        // 03:30 UTC on 30 October is 05:30 after the clocks went back: still the 29th's business day
        SettledAt(context, ticket, new DateTime(2026, 10, 30, 3, 30, 0, DateTimeKind.Utc));
        await context.SaveChangesAsync();

        var daily = await new TicketQueries(context).GetDailyReportAsync(
            Branch, new DateTime(2026, 10, 29, 3, 0, 0, DateTimeKind.Utc), new DateTime(2026, 10, 31, 4, 0, 0, DateTimeKind.Utc), Zone, DayStart);

        Assert.HasCount(2, daily.Days);
        Assert.AreEqual(1, daily.Days.Single(d => d.Date == new DateOnly(2026, 10, 29)).Tickets);
    }

    [TestMethod]
    public async Task Hours_are_read_in_the_zone_each_bill_at_its_own_offset()
    {
        await using var context = NewContext();
        foreach (var at in new[] { new DateTime(2026, 10, 20, 3, 30, 0, DateTimeKind.Utc), new DateTime(2026, 11, 3, 3, 30, 0, DateTimeKind.Utc) })
        {
            var ticket = Ticket.OpenForCounter(Branch);
            ticket.AddManualLine(new LocalizedText("Latte", null), 1, 50, 0, "Omar");
            ticket.Settle([new Payment(PaymentTender.Cash, 50, "Omar")], "Omar");
            context.Tickets.Add(ticket);
            SettledAt(context, ticket, at);
        }
        await context.SaveChangesAsync();
        var queries = new TicketQueries(context);
        var window = (From: new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc), To: new DateTime(2026, 11, 30, 0, 0, 0, DateTimeKind.Utc));

        var zoned = await queries.GetBreakdownAsync(Branch, window.From, window.To, 0, Zone);
        var fixedOffset = await queries.GetBreakdownAsync(Branch, window.From, window.To, 180);

        Assert.AreEqual(1, zoned.ByHour[6].Count, "06:30 in summer time");
        Assert.AreEqual(1, zoned.ByHour[5].Count, "05:30 once the clocks went back");
        Assert.AreEqual("Test/Cairo", zoned.TimeZone);
        Assert.AreEqual(2, fixedOffset.ByHour[6].Count, "one offset for the whole window puts both at 06:30");
    }

    [TestMethod]
    public async Task Cashiers_carry_their_net_sales_and_the_system_says_it_is_not_a_person()
    {
        var day = await ADayAsync();
        await using var _ = day.Context;
        var platform = Ticket.OpenForPlatform(Branch, "Talabat", "T-1");
        platform.AppendOrder(9, [Item(12, "Latte", 1, 50)], loyaltyDiscount: 0);
        platform.Settle([new Payment(PaymentTender.Talabat, 50, "talabat")], "talabat", rules: Rules);
        day.Context.Tickets.Add(platform);
        SettledAt(day.Context, platform, new DateTime(2026, 10, 20, 14, 0, 0, DateTimeKind.Utc));
        await day.Context.SaveChangesAsync();

        var report = await new TicketQueries(day.Context).GetBreakdownAsync(Branch, From, To, 0, Zone);

        var omar = report.ByCashier.Single(c => c.Name == "Omar");
        Assert.AreEqual(CashierKinds.Staff, omar.Kind);
        Assert.AreEqual(320.34m, omar.GrossSales);
        Assert.AreEqual(omar.GrossSales, omar.NetSales, "Sara gave the refund, not Omar");
        var sara = report.ByCashier.Single(c => c.Name == "Sara");
        Assert.AreEqual(-45.60m, sara.NetSales);
        Assert.AreEqual(CashierKinds.Platform, report.ByCashier.Single(c => c.Name == "talabat").Kind);
        Assert.AreEqual(CashierKinds.Staff, report.ByCashier.Single(c => c.Name == "owner").Kind, "an owner who voided is a person");
        Assert.AreEqual(CashierKinds.Automatic, CashierKinds.Of("ordering"), "a bill voided because its order was cancelled is not");
    }

    [TestMethod]
    public async Task The_shift_agrees_on_net_sales_and_keeps_the_drawer_on_cash()
    {
        var day = await ADayAsync();
        await using var _ = day.Context;

        var view = (await new ShiftQueries(day.Context).GetShiftAsync(day.Shift.Id))!;

        Assert.AreEqual(320.34m, view.GrossSales);
        Assert.AreEqual(view.GrossSales, view.SalesTotal);
        Assert.AreEqual(45.60m, view.RefundsTotal, "a refund given back online is the shift's too");
        Assert.AreEqual(0m, view.CashRefunds, "but not the drawer's");
        Assert.AreEqual(274.74m, view.NetSales);
        Assert.AreEqual(241.00m, view.NetSalesExVat);
        Assert.AreEqual(148.20m, view.TenderTotals.Single(t => t.Tender == "Cash").Amount);
        Assert.AreEqual(157m, view.CashTendered);
        Assert.AreEqual(200m + 157m - 8.80m, view.ExpectedInDrawer, "float, what was handed over, less the change");
        Assert.AreEqual(0m, view.LateCash);
        Assert.IsNull(view.AdjustedOverShort);
    }

    [TestMethod]
    public async Task A_sale_that_reaches_a_closed_shift_shows_as_late_cash_on_its_Z()
    {
        await using var context = NewContext();
        var shift = new Shift(Branch, openingFloat: 100, openedBy: "Omar");
        context.Shifts.Add(shift);
        await context.SaveChangesAsync();
        var sold = Ticket.OpenForCounter(Branch);
        sold.AddManualLine(new LocalizedText("Latte", null), 1, 50, 0, "Omar");
        sold.Settle([new Payment(PaymentTender.Cash, 50, "Omar")], "Omar", shift.Id);
        context.Tickets.Add(sold);
        await context.SaveChangesAsync();

        // The drawer holds the offline sale's 40 too, so it counts 190 against 150 expected
        shift.Close(190, cashPayments: 50, changeGiven: 0, closedBy: "Omar");
        await context.SaveChangesAsync();
        var replayed = Ticket.OpenForCounter(Branch);
        replayed.AddManualLine(new LocalizedText("Tea", null), 1, 40, 0, "Omar");
        replayed.Settle([new Payment(PaymentTender.Cash, 40, "Omar")], "Omar", shift.Id);
        context.Tickets.Add(replayed);
        await context.SaveChangesAsync();

        var z = (await new ShiftQueries(context).GetShiftAsync(shift.Id))!;

        Assert.AreEqual(150m, z.ExpectedCash, "the verdict frozen at the close stays");
        Assert.AreEqual(40m, z.OverShort);
        Assert.AreEqual(40m, z.LateCash);
        Assert.AreEqual(190m, z.ExpectedInDrawer);
        Assert.AreEqual(0m, z.AdjustedOverShort, "with the late cash in, the drawer was right");
        Assert.AreEqual(90m, z.SalesTotal);
    }

    [TestMethod]
    public async Task Closed_shifts_are_listed_by_the_window_they_opened_in_end_excluded()
    {
        await using var context = NewContext();
        var shift = new Shift(Branch, openingFloat: 100, openedBy: "Omar");
        shift.Close(100, 0, 0, "Omar");
        context.Shifts.Add(shift);
        var opened = new DateTime(2026, 10, 20, 3, 0, 0, DateTimeKind.Utc);
        context.Entry(shift).Property(s => s.OpenedAt).CurrentValue = opened;
        await context.SaveChangesAsync();
        var queries = new ShiftQueries(context);

        Assert.IsEmpty(await queries.GetClosedShiftsAsync(Branch, 0, 10, opened.AddDays(-1), opened), "the day before ends where this one opened");
        Assert.HasCount(1, await queries.GetClosedShiftsAsync(Branch, 0, 10, opened, opened.AddDays(1)));
    }

    [TestMethod]
    public async Task A_payment_row_says_what_it_kept_after_the_change()
    {
        await using var context = NewContext();
        var ticket = Ticket.OpenForCounter(Branch);
        ticket.AddManualLine(new LocalizedText("Latte", null), 1, 85, 0, "Omar");
        ticket.Settle([new Payment(PaymentTender.Card, 20, "Omar"), new Payment(PaymentTender.Cash, 50, "Omar"), new Payment(PaymentTender.Cash, 30, "Omar")], "Omar");
        context.Tickets.Add(ticket);
        await context.SaveChangesAsync();

        var page = await new TicketQueries(context).GetPaymentsAsync(Branch, DateTime.UtcNow.AddHours(-1), DateTime.UtcNow.AddHours(1), null, 0, 10);

        Assert.AreEqual(85m, page.Items.Sum(p => p.NetAmount), "the rows add up to the bill");
        Assert.AreEqual(100m, page.Items.Sum(p => p.Amount), "what was handed over");
        Assert.AreEqual(20m, page.Items.Single(p => p.Tender == "Card").NetAmount);
    }
}
