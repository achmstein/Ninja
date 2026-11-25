using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Ninja.IntegrationEventLogEF;
using Ninja.Sales.API.Application.IntegrationEvents.EventHandling;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.Infrastructure;
using Ninja.Sales.Infrastructure.Projections;
using Ninja.Testing;
using TicketAggregate = Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

namespace Ninja.Sales.FunctionalTests;

/// <summary>
/// A delivery a courier company carried reaching the bills: its courier's collection settles the bill
/// to the company, never into the drawer, whichever of the bill and the collection comes first, and
/// never for money nobody collected; a delivery the courier could not hand over still owes the fee;
/// and what each company owes the business adds up on the Couriers page.
/// </summary>
[TestClass]
public sealed class CourierScenarios
{
    private const string Version = "api-version=1.0";
    private static int _nextOrder = 960_000;
    private static int _nextProvider = 9_000;

    private static Caller Owner => Suite.Sales.As(Persona.Owner(Suite.Branch), Suite.Branch);

    private static OrderStatusChangedToConfirmedIntegrationEvent Confirmed(int orderId)
        => new(
            orderId,
            BuyerName: "Mona Adel",
            BuyerIdentityGuid: $"user-courier-{orderId}",
            OrderTotal: 115m,
            PointsToRedeem: 0,
            GuestId: null,
            BranchId: Suite.Branch,
            SessionId: null,
            Source: "Customer",
            GuestPhone: null,
            LoyaltyDiscount: 0,
            Items: [new(12, new("Latte", "لاتيه"), 2, 47.50m, 0m, null)],
            CustomerName: "Mona Adel",
            DeliveryFee: 20m,
            IsDelivery: true);

    private static async Task ConfirmAsync(int orderId)
    {
        using var scope = Suite.Sales.Services.CreateScope();
        await ActivatorUtilities.CreateInstance<OrderStatusChangedToConfirmedIntegrationEventHandler>(scope.ServiceProvider).Handle(Confirmed(orderId));
    }

    private static async Task MovedAsync(int orderId, int providerId, string stage, bool collectedReported = false, decimal? collected = null, decimal fee = 30m)
    {
        using var scope = Suite.Sales.Services.CreateScope();
        await ActivatorUtilities.CreateInstance<OrderDeliveryChangedIntegrationEventHandler>(scope.ServiceProvider).Handle(
            new OrderDeliveryChangedIntegrationEvent(orderId, Suite.Branch, stage, null, null, CashHandedIn: false, Total: 115m, Version: 4,
                CourierProviderId: providerId, CourierProvider: "Fast Couriers", CourierFee: fee,
                CourierCollectedReported: collectedReported, CourierCollected: collected));
    }

    private static Task DeliveredAsync(int orderId, int providerId, decimal collected) =>
        MovedAsync(orderId, providerId, "Delivered", collectedReported: true, collected: collected);

    private static async Task<TicketAggregate.Ticket> TicketOfAsync(int orderId)
    {
        using var scope = Suite.Sales.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<SalesContext>().Tickets
            .Include(t => t.Lines)
            .Include(t => t.Payments)
            .AsNoTracking()
            .SingleAsync(t => t.Lines.Any(l => l.OrderId == orderId));
    }

    private static async Task<CourierJob?> JobOfAsync(int orderId)
    {
        using var scope = Suite.Sales.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<SalesContext>().CourierJobs.AsNoTracking().SingleOrDefaultAsync(j => j.OrderId == orderId);
    }

    private static async Task<int> FeesToldAsync(int orderId)
    {
        using var scope = Suite.Sales.Services.CreateScope();
        var entries = await scope.ServiceProvider.GetRequiredService<SalesContext>().Set<IntegrationEventLogEntry>().AsNoTracking()
            .Where(e => e.EventTypeName.EndsWith(nameof(CourierFeeChargedIntegrationEvent)))
            .ToListAsync();
        // Stored indented: "OrderId": 980001,
        var pattern = "\"[Oo]rderId\":\\s*" + orderId + ",";
        return entries.Count(e => System.Text.RegularExpressions.Regex.IsMatch(e.Content, pattern));
    }

    [TestMethod]
    public async Task The_couriers_collection_settles_the_bill_to_the_company_once_and_never_into_the_drawer()
    {
        var orderId = Interlocked.Increment(ref _nextOrder);
        var provider = Interlocked.Increment(ref _nextProvider);
        await ConfirmAsync(orderId);

        await DeliveredAsync(orderId, provider, collected: 115m);
        await DeliveredAsync(orderId, provider, collected: 115m);

        var ticket = await TicketOfAsync(orderId);
        Assert.AreEqual(TicketAggregate.TicketStatus.Settled, ticket.Status);
        var payment = ticket.Payments.Single();
        Assert.AreEqual(TicketAggregate.PaymentTender.Courier, payment.Tender, "owed by the company, not in the drawer");
        Assert.AreEqual(ticket.Total, payment.Amount);
        var job = (await JobOfAsync(orderId))!;
        Assert.AreEqual(CourierJobOutcome.Settled, job.Outcome);
        Assert.AreEqual(30m, job.Fee);
        Assert.AreEqual(1, await FeesToldAsync(orderId), "Finance hears of the fee once");
    }

    [TestMethod]
    public async Task A_collection_said_before_its_bill_waits_and_settles_it_when_it_lands()
    {
        var orderId = Interlocked.Increment(ref _nextOrder);
        var provider = Interlocked.Increment(ref _nextProvider);

        await DeliveredAsync(orderId, provider, collected: 115m);
        Assert.AreEqual(CourierJobOutcome.Pending, (await JobOfAsync(orderId))!.Outcome, "kept, not dropped");

        await ConfirmAsync(orderId);

        Assert.AreEqual(TicketAggregate.TicketStatus.Settled, (await TicketOfAsync(orderId)).Status);
        Assert.AreEqual(CourierJobOutcome.Settled, (await JobOfAsync(orderId))!.Outcome);
    }

    [TestMethod]
    public async Task A_courier_short_of_the_bill_leaves_it_open_for_the_till()
    {
        var orderId = Interlocked.Increment(ref _nextOrder);
        var provider = Interlocked.Increment(ref _nextProvider);
        await ConfirmAsync(orderId);

        await DeliveredAsync(orderId, provider, collected: 100m);

        Assert.AreEqual(TicketAggregate.TicketStatus.Open, (await TicketOfAsync(orderId)).Status);
        var job = (await JobOfAsync(orderId))!;
        Assert.AreEqual(CourierJobOutcome.Short, job.Outcome);
        Assert.AreEqual(100m, job.Collected);
    }

    [TestMethod]
    public async Task A_delivery_the_courier_could_not_hand_over_owes_the_fee_and_settles_nothing()
    {
        var orderId = Interlocked.Increment(ref _nextOrder);
        var provider = Interlocked.Increment(ref _nextProvider);
        await ConfirmAsync(orderId);

        await MovedAsync(orderId, provider, "Failed");

        Assert.AreEqual(TicketAggregate.TicketStatus.Open, (await TicketOfAsync(orderId)).Status, "the till decides what becomes of it");
        var job = (await JobOfAsync(orderId))!;
        Assert.AreEqual(CourierJobOutcome.Failed, job.Outcome);
        Assert.AreEqual(0m, job.Collected);
        Assert.AreEqual(1, await FeesToldAsync(orderId));
    }

    [TestMethod]
    public async Task A_courier_given_and_on_its_way_changes_no_bill()
    {
        var orderId = Interlocked.Increment(ref _nextOrder);
        var provider = Interlocked.Increment(ref _nextProvider);
        await ConfirmAsync(orderId);

        await MovedAsync(orderId, provider, "Assigned");
        await MovedAsync(orderId, provider, "OnTheWay");

        Assert.AreEqual(TicketAggregate.TicketStatus.Open, (await TicketOfAsync(orderId)).Status);
        Assert.IsNull(await JobOfAsync(orderId));
    }

    [TestMethod]
    public async Task What_a_company_owes_is_what_it_collected_less_its_fees_less_what_it_paid()
    {
        var provider = Interlocked.Increment(ref _nextProvider);
        var delivered = Interlocked.Increment(ref _nextOrder);
        var failed = Interlocked.Increment(ref _nextOrder);
        await ConfirmAsync(delivered);
        await ConfirmAsync(failed);
        await DeliveredAsync(delivered, provider, collected: 115m);
        await MovedAsync(failed, provider, "Failed");

        await Owner.PostAsync<CourierPayoutDto>($"/api/sales/couriers/{provider}/payouts?{Version}", new { amount = 40m, provider = "Fast Couriers", note = "Sunday's cash" });

        var balance = (await Owner.GetAsync<List<CourierBalanceDto>>($"/api/sales/couriers/balances?{Version}")).Single(b => b.ProviderId == provider);
        Assert.AreEqual(2, balance.Deliveries);
        Assert.AreEqual(115m, balance.Collected);
        Assert.AreEqual(60m, balance.Fees, "the failed one's fee too");
        Assert.AreEqual(40m, balance.Settled);
        Assert.AreEqual(15m, balance.Balance, "115 collected - 60 fees - 40 paid");

        var jobs = await Owner.GetAsync<CourierJobsDto>($"/api/sales/couriers/{provider}/jobs?{Version}");
        Assert.AreEqual(2, jobs.Total);
    }

    [TestMethod]
    public async Task A_cashier_cannot_see_or_record_what_couriers_owe()
    {
        var till = Suite.Sales.As(Persona.Cashier(Suite.Branch), Suite.Branch);
        var (status, _) = await till.RefusedAsync(HttpMethod.Get, $"/api/sales/couriers/balances?{Version}");
        Assert.AreEqual(System.Net.HttpStatusCode.Forbidden, status);
    }

    private sealed record CourierBalanceDto(int ProviderId, string Provider, int Deliveries, decimal Collected, decimal Fees, decimal Settled, decimal Balance, int ShortDeliveries);
    private sealed record CourierJobsDto(int Total);
    private sealed record CourierPayoutDto(int Id, decimal Amount);
}
