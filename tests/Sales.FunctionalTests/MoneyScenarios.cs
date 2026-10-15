using System.Net;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Ninja.Sales.API.Application.Commands;
using Ninja.Sales.API.Application.IntegrationEvents.EventHandling;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.Infrastructure;
using Ninja.Testing;
using TicketAggregate = Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

namespace Ninja.Sales.FunctionalTests;

/// <summary>The money the reports read off the wire; named here so a change in their shape fails a test.</summary>
public record MoneyTender(string Tender, decimal Amount, int Count, decimal Tendered);
public record MoneyRange(int TicketsSettled, decimal Net, decimal GrossSales, decimal Refunds, decimal NetSales, decimal NetSalesExVat, decimal Vat, decimal DeliveryFees,
    decimal ChangeGiven, decimal CashTendered, List<MoneyTender> TenderTotals, List<MoneyTender> TabPaymentTenderTotals);
public record MoneyDay(DateOnly Date, int Tickets, decimal GrossSales, decimal Refunds, decimal NetSales, int RefundCount);
public record MoneyDaily(string TimeZone, string DayStart, List<MoneyDay> Days);
public record MoneyItem(LocalizedView Description, decimal Qty, decimal Amount, int? CatalogItemId, decimal MenuAmount, decimal RefundedQty, decimal RefundedAmount, decimal NetQty, decimal NetAmount);
public record MoneyBreakdown(string? TimeZone, List<MoneyItem> ByItem);
public record MoneyShift(int Id, string Status, decimal SalesTotal, decimal GrossSales, decimal RefundsTotal, decimal CashRefunds, decimal NetSales, decimal CashTendered, decimal ChangeGiven,
    decimal CashTabPayments, decimal ExpectedInDrawer, decimal? ExpectedCash, decimal? OverShort, decimal LateCash, decimal? AdjustedOverShort, List<MoneyTender> TenderTotals,
    DateTime OpenedAt, DateTime? ClosedAt, int TicketsSettled);
public record MoneyTicket(int Id, int? ShiftId, decimal Total, decimal ChangeGiven, List<LineView> Lines, List<MoneyPayment> Payments);
public record MoneyPayment(string Tender, decimal Amount, DateTime RecordedAt);

/// <summary>
/// A day at one counter, every kind of money in it — a cash sale with change,
/// a partial refund, a tab payment, a delivery with its fee, a void and a sale
/// replayed from a till that was offline — read back through every report:
/// they agree on net sales, the tenders on cash, and the drawer on what is in
/// it. And the drawer's own rules: an offline sale lands in the shift it was
/// rung up in, and a close and a sale never pass each other.
/// </summary>
[TestClass]
public sealed class MoneyScenarios
{
    private const string Version = "api-version=1.0";

    // Each scenario runs its own counter, so one day's money is not another's
    private static int _nextBranch = 7000;
    private static int NewBranch() => Interlocked.Increment(ref _nextBranch);

    private static int _nextOrder = 990_000;

    private static Caller TillAt(int branch) => Suite.Sales.As(Persona.Cashier(branch), branch);
    private static Caller OwnerAt(int branch) => Suite.Sales.As(Persona.Owner(branch), branch);

    private static string Url(string path, string query = "") => $"{path}?{Version}{query}";

    private static string Utc(DateTime at) => at.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fffffff'Z'", System.Globalization.CultureInfo.InvariantCulture);

    private static async Task<int> OpenShiftAsync(Caller till, decimal openingFloat)
        => (await till.PostAsync<OpenedShiftView>(Url("/api/shifts/open"), new { openingFloat })).ShiftId;

    /// <summary>A counter sale with one manual line on it, not yet settled.</summary>
    private static async Task<int> ABillAsync(Caller till, decimal unitPrice, decimal qty = 1, string what = "Latte")
    {
        var opened = await till.PostAsync<OpenedTicketView>(Url("/api/tickets"), new { type = 2 });
        var (added, detail) = await till.RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{opened.TicketId}/lines"), new
        {
            description = new { en = what, ar = what },
            qty,
            unitPrice,
        });
        Assert.AreEqual(HttpStatusCode.OK, added, detail);
        return opened.TicketId;
    }

    private static Task<SettleResultView> SettleAsync(Caller till, int ticketId, int tender, decimal amount, DateTime? settledAt = null, int? shiftId = null, string? provisional = null)
        => till.PostAsync<SettleResultView>(Url($"/api/tickets/{ticketId}/settle"), new
        {
            payments = new[] { new { tender, amount } },
            settledAt = settledAt is { } at ? Utc(at) : null,
            shiftId,
            provisionalReceiptNumber = provisional,
        });

    private static Task<MoneyTicket> TicketAsync(Caller till, int id) => till.GetAsync<MoneyTicket>(Url($"/api/tickets/{id}"));

    private static Task<MoneyShift> ShiftAsync(Caller till, int id) => till.GetAsync<MoneyShift>(Url($"/api/shifts/{id}"));

    private static async Task SetVatAsync(int branch)
    {
        var (status, detail) = await OwnerAt(branch).RefusedAsync(HttpMethod.Put, Url($"/api/tickets/pricing/{branch}"), new
        {
            vatRate = 0.14m,
            pricesIncludeVat = false,
            serviceChargeRate = 0m,
        });
        Assert.AreEqual(HttpStatusCode.OK, status, detail);
    }

    private static async Task<int> DeliveredAsync(int branch, decimal fee)
    {
        var orderId = Interlocked.Increment(ref _nextOrder);
        using (var scope = Suite.Sales.Services.CreateScope())
        {
            var handler = ActivatorUtilities.CreateInstance<OrderStatusChangedToConfirmedIntegrationEventHandler>(scope.ServiceProvider);
            await handler.Handle(new OrderStatusChangedToConfirmedIntegrationEvent(
                orderId,
                BuyerName: "Mona Adel",
                BuyerIdentityGuid: "user-money",
                OrderTotal: 115m,
                PointsToRedeem: 0,
                GuestId: null,
                BranchId: branch,
                SessionId: null,
                Source: "Customer",
                GuestPhone: null,
                LoyaltyDiscount: 0,
                Items: [new(12, new("Latte", "لاتيه"), 2, 47.50m, 0m, null)],
                CustomerName: "Mona Adel",
                DeliveryFee: fee,
                IsDelivery: true));
        }

        return (await TillAt(branch).GetAsync<OpenedTicketView>(Url($"/api/tickets/by-order/{orderId}"))).TicketId;
    }

    [TestMethod]
    public async Task Every_report_agrees_on_net_sales_and_the_drawer_on_cash()
    {
        var branch = NewBranch();
        var till = TillAt(branch);
        var owner = OwnerAt(branch);
        await SetVatAsync(branch);
        var from = DateTime.UtcNow.AddHours(-1);
        var shiftId = await OpenShiftAsync(till, 100m);

        // A latte, 57 with VAT, paid with 60: 3 back
        var cashSale = await ABillAsync(till, 50m);
        Assert.AreEqual(3m, (await SettleAsync(till, cashSale, tender: 0, amount: 60m)).Change);

        // Two teas on card, 91.20; one comes back in cash, 45.60
        var cardSale = await ABillAsync(till, 40m, qty: 2, what: "Tea");
        await SettleAsync(till, cardSale, tender: 1, amount: 91.20m);
        var teaLine = (await TicketAsync(till, cardSale)).Lines.Single().Id;
        var refund = await owner.PostAsync<RefundResultView>(Url($"/api/tickets/{cardSale}/refunds"), new
        {
            lines = new[] { new { lineId = teaLine, qty = 1m } },
            reason = "Cold",
            tender = 0,
        });
        Assert.AreEqual(45.60m, refund.Amount);

        // 30 cash against a tab: money in, not a sale
        var (slip, slipDetail) = await till.RefusedAsync(HttpMethod.Post, Url("/api/tickets/tab-payments"), new
        {
            customerId = "user-tab",
            customerName = "Hany",
            tender = 0,
            amount = 30m,
        });
        Assert.AreEqual(HttpStatusCode.OK, slip, slipDetail);

        // A delivery: 95 of lattes and a 20 fee, 131.10 with VAT, the fee 22.80 of it
        var delivery = await DeliveredAsync(branch, fee: 20m);
        Assert.AreEqual(131.10m, (await TicketAsync(till, delivery)).Total);
        await SettleAsync(till, delivery, tender: 1, amount: 131.10m);

        // A void: never a sale
        var voided = await ABillAsync(till, 500m);
        var (voidStatus, voidDetail) = await owner.RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{voided}/void"), new { reason = "Rang up the wrong bill" });
        Assert.AreEqual(HttpStatusCode.OK, voidStatus, voidDetail);

        // A water sold while the till was offline, replayed a minute later into its shift
        var offline = await ABillAsync(till, 20m, what: "Water");
        var rungUp = DateTime.UtcNow.AddMinutes(-1);
        await SettleAsync(till, offline, tender: 0, amount: 22.80m, settledAt: rungUp, shiftId: shiftId, provisional: "P-0001");

        var to = DateTime.UtcNow.AddHours(1);
        var window = $"&from={Utc(from)}&to={Utc(to)}";
        var range = await till.GetAsync<MoneyRange>(Url("/api/tickets/reports/range", window));
        var daily = await till.GetAsync<MoneyDaily>(Url("/api/tickets/reports/daily", window + "&tz=Africa/Cairo&dayStart=06:00"));
        var breakdown = await till.GetAsync<MoneyBreakdown>(Url("/api/tickets/reports/breakdown", window + "&tz=Africa/Cairo"));
        var shift = await ShiftAsync(till, shiftId);

        Assert.AreEqual(4, range.TicketsSettled);
        Assert.AreEqual(302.10m, range.GrossSales, "57 + 91.20 + 131.10 + 22.80");
        Assert.AreEqual(range.GrossSales, range.Net);
        Assert.AreEqual(45.60m, range.Refunds);
        Assert.AreEqual(256.50m, range.NetSales);
        Assert.AreEqual(256.50m - (37.10m - 5.60m), range.NetSalesExVat);
        Assert.AreEqual(22.80m, range.DeliveryFees);

        Assert.AreEqual(range.NetSales, daily.Days.Sum(d => d.NetSales), "the days add up to the window");
        Assert.AreEqual(range.TicketsSettled, daily.Days.Sum(d => d.Tickets));
        Assert.AreEqual("Africa/Cairo", breakdown.TimeZone);
        Assert.AreEqual(range.NetSales, breakdown.ByItem.Sum(i => i.NetAmount) + range.DeliveryFees, "the items, net of what went back, and the delivery");
        Assert.IsFalse(breakdown.ByItem.Any(i => i.Description.En == "Delivery fee"));
        var tea = breakdown.ByItem.Single(i => i.Description.En == "Tea");
        Assert.AreEqual(1m, tea.NetQty);
        Assert.AreEqual(45.60m, tea.NetAmount);

        Assert.AreEqual(range.GrossSales, shift.GrossSales);
        Assert.AreEqual(range.NetSales, shift.NetSales, "the X report agrees, the offline sale on it");
        Assert.AreEqual(4, shift.TicketsSettled);

        // Cash: what the sales kept, beside what was handed over; tab cash apart
        var cash = range.TenderTotals.Single(t => t.Tender == "Cash");
        Assert.AreEqual(79.80m, cash.Amount, "57 kept of 60, and 22.80");
        Assert.AreEqual(82.80m, cash.Tendered);
        Assert.AreEqual(range.GrossSales, range.TenderTotals.Sum(t => t.Amount));
        Assert.AreEqual(30m, range.TabPaymentTenderTotals.Single(t => t.Tender == "Cash").Amount);
        Assert.AreEqual(cash.Amount, shift.TenderTotals.Single(t => t.Tender == "Cash").Amount);
        Assert.AreEqual(100m + 82.80m - 3m - 45.60m + 30m, shift.ExpectedInDrawer, "the drawer's formula is as it was");
    }

    [TestMethod]
    public async Task An_offline_sale_lands_in_the_shift_it_was_rung_up_in_even_after_that_closed()
    {
        var branch = NewBranch();
        var till = TillAt(branch);
        var first = await OpenShiftAsync(till, 100m);

        // The till went offline and sold a water for 20 cash; the drawer is
        // counted with it in, before the sale ever reached the server
        await Task.Delay(200);
        var z = await till.PostAsync<MoneyShift>(Url($"/api/shifts/{first}/close"), new { closingCount = 120m });
        Assert.AreEqual(20m, z.OverShort, "20 over: the drawer has a sale the server has not heard of");
        var second = await OpenShiftAsync(till, 50m);

        var rungUp = z.OpenedAt + (z.ClosedAt!.Value - z.OpenedAt) / 2;
        var offline = await ABillAsync(till, 20m, what: "Water");
        await SettleAsync(till, offline, tender: 0, amount: 20m, settledAt: rungUp, shiftId: first, provisional: "P-0002");

        var ticket = await TicketAsync(till, offline);
        Assert.AreEqual(first, ticket.ShiftId, "the shift it was rung up in, not the one open now");
        var paidAt = ticket.Payments.Single().RecordedAt.ToUniversalTime();
        Assert.IsLessThan(1, Math.Abs((paidAt - rungUp.ToUniversalTime()).TotalMilliseconds), "paid when it was rung up, not when it was replayed");

        var after = await ShiftAsync(till, first);
        Assert.AreEqual(100m, after.ExpectedCash, "the frozen verdict stays");
        Assert.AreEqual(20m, after.LateCash);
        Assert.AreEqual(0m, after.AdjustedOverShort, "and with the late cash in, the drawer was right");
        Assert.AreEqual(20m, after.SalesTotal);
        Assert.AreEqual(0, (await ShiftAsync(till, second)).TicketsSettled);

        // A replay that names a shift it was not rung up in goes to the open one
        var late = await ABillAsync(till, 10m, what: "Water");
        await SettleAsync(till, late, tender: 0, amount: 10m, settledAt: DateTime.UtcNow.AddSeconds(-5), shiftId: first);
        Assert.AreEqual(second, (await TicketAsync(till, late)).ShiftId);
    }

    [TestMethod]
    public async Task A_sale_arriving_during_a_close_waits_for_it_and_stays_off_the_closed_shift()
    {
        var branch = NewBranch();
        var till = TillAt(branch);
        var shiftId = await OpenShiftAsync(till, 100m);
        var bill = await ABillAsync(till, 50m);

        Task<SettleResultView> settle = null!;
        await InOneTransactionAsync(async services =>
        {
            // The close has summed the shift and holds it, not yet committed
            await services.GetRequiredService<IMediator>().Send(new CloseShiftCommand(shiftId, 100m, "Omar"));

            settle = SettleAsync(till, bill, tender: 0, amount: 50m);
            await Task.Delay(1500);
            Assert.IsFalse(settle.IsCompleted, "the sale waits for the close");
        });
        await settle;

        Assert.IsNull((await TicketAsync(till, bill)).ShiftId, "the shift closed under it: the sale goes unattributed, never onto a closed Z");
        var z = await ShiftAsync(till, shiftId);
        Assert.AreEqual(0, z.TicketsSettled);
        Assert.AreEqual(z.ExpectedCash, z.ExpectedInDrawer);
    }

    [TestMethod]
    public async Task A_close_arriving_during_a_sale_waits_for_it_and_counts_it()
    {
        var branch = NewBranch();
        var till = TillAt(branch);
        var shiftId = await OpenShiftAsync(till, 100m);
        var bill = await ABillAsync(till, 50m);

        Task<MoneyShift> close = null!;
        await InOneTransactionAsync(async services =>
        {
            // The sale has put itself on the shift, not yet committed
            await services.GetRequiredService<IMediator>().Send(
                new SettleTicketCommand(bill, [new PaymentDto(TicketAggregate.PaymentTender.Cash, 50m)], "Omar"));

            close = till.PostAsync<MoneyShift>(Url($"/api/shifts/{shiftId}/close"), new { closingCount = 150m });
            await Task.Delay(1500);
            Assert.IsFalse(close.IsCompleted, "the close waits for the sale");
        });

        var z = await close;
        Assert.AreEqual(1, z.TicketsSettled);
        Assert.AreEqual(150m, z.ExpectedCash, "the sale it waited for is in the expected cash");
        Assert.AreEqual(0m, z.OverShort);
    }

    /// <summary>
    /// Some work in one transaction of its own scope, committed only once the
    /// work is done: what the other side of a race sees while it is held.
    /// </summary>
    private static async Task InOneTransactionAsync(Func<IServiceProvider, Task> work)
    {
        using var scope = Suite.Sales.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SalesContext>();
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = (await db.BeginTransactionAsync())!;
            await work(scope.ServiceProvider);
            await db.CommitTransactionAsync(transaction);
        });
    }
}
