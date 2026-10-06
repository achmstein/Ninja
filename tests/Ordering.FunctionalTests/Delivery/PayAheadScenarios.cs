using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Ninja.IntegrationEventLogEF;
using Ninja.Ordering.API.Application.Commands;
using Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;
using Ninja.Ordering.API.Application.IntegrationEvents.Events;
using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;
using Ninja.Ordering.Infrastructure;
using Ninja.Ordering.Infrastructure.Projections;
using Ninja.Testing;

namespace Ninja.Ordering.FunctionalTests;

public record CreatedOrderView(int? OrderId);
public record PaidAheadOrderView(int OrderNumber, string Status, bool PaysOnline, DateTime? PaymentDueBy, DateTime? PaidOnlineAt, decimal Total);

/// <summary>
/// An order paid ahead online at the door of the API: the owner's switch
/// gates it, the customer gets the order's number to pay it by, it waits for
/// the payment unseen by the till, reaches the till once paid, and is
/// cancelled unpaid, by the customer or the clock.
/// </summary>
[TestClass]
public sealed class PayAheadScenarios
{
    private const string Orders = "/api/orders";
    private const string Version = "api-version=1.0";
    /// <summary>A branch of its own, so nothing here touches another scenario's</summary>
    private const int Branch = 12;

    private static Caller Customer(string userId) => Suite.Ordering.As(Persona.Customer(userId), Branch);

    private static async Task<T> InScopeAsync<T>(Func<IServiceProvider, Task<T>> work)
    {
        using var scope = Suite.Ordering.Services.CreateScope();
        return await work(scope.ServiceProvider);
    }

    private static Task PayAheadAsync(bool on) => InScopeAsync(async sp =>
    {
        var db = sp.GetRequiredService<OrderingContext>();
        var row = await db.TenantFeatures.FindAsync(TenantFeatures.SingletonId);
        if (row is null) db.TenantFeatures.Add(new TenantFeatures { PayAhead = on, UpdatedAt = DateTime.UtcNow });
        else row.PayAhead = on;
        return await db.SaveChangesAsync();
    });

    /// <summary>An order to collect, paid ahead: two lattes at 50</summary>
    private static async Task<(HttpStatusCode Status, string Body)> PlaceAsync(Caller caller, bool payOnline = true)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"{Orders}?{Version}")
        {
            Content = System.Net.Http.Json.JsonContent.Create(new
            {
                userId = "",
                userName = "Mona",
                pointsToRedeem = 0,
                loyaltyDiscount = 0,
                items = new[] { new { id = "1", productId = 1, productName = new { en = "Latte" }, unitPrice = 50m, oldUnitPrice = 50m, quantity = 2 } },
                payOnline,
            }, options: Caller.Json),
        };
        request.Headers.Add("x-requestid", Guid.NewGuid().ToString());
        using var response = await caller.Http.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    private static async Task<int> PlacedAndPricedAsync(Caller caller)
    {
        var (status, body) = await PlaceAsync(caller);
        Assert.AreEqual(HttpStatusCode.OK, status, body);
        var orderId = JsonSerializer.Deserialize<CreatedOrderView>(body, Caller.Json)!.OrderId!.Value;
        // Catalog says yes
        await InScopeAsync(async sp =>
        {
            await ActivatorUtilities.CreateInstance<OrderValidatedIntegrationEventHandler>(sp).Handle(new OrderValidatedIntegrationEvent(orderId));
            return 0;
        });
        return orderId;
    }

    [TestMethod]
    public async Task The_owners_switch_decides_whether_an_order_is_paid_ahead()
    {
        await PayAheadAsync(on: false);
        var (status, body) = await PlaceAsync(Customer($"customer-{Guid.NewGuid():N}"));
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains(PaymentErrors.AheadOff, body);
    }

    [TestMethod]
    public async Task Paid_ahead_it_waits_unseen_for_its_payment_and_reaches_the_till_once_paid()
    {
        await PayAheadAsync(on: true);
        var mona = Customer($"customer-{Guid.NewGuid():N}");
        var orderId = await PlacedAndPricedAsync(mona);

        var waiting = await mona.GetAsync<PaidAheadOrderView>($"{Orders}/{orderId}?{Version}");
        Assert.AreEqual("AwaitingPayment", waiting.Status);
        Assert.IsTrue(waiting.PaysOnline);
        Assert.IsNotNull(waiting.PaymentDueBy);

        // Sales is told what to take
        var asked = await InScopeAsync(async sp =>
            (await sp.GetRequiredService<OrderingContext>().Set<IntegrationEventLogEntry>()
                .Where(e => e.EventTypeName.EndsWith(nameof(OrderAwaitingPaymentIntegrationEvent))).ToListAsync())
            .Select(e => JsonSerializer.Deserialize<OrderAwaitingPaymentIntegrationEvent>(e.Content)!)
            .Single(e => e.OrderId == orderId));
        Assert.AreEqual(100m, asked.Total);
        Assert.AreEqual(Branch, asked.BranchId);

        // Sales says it is paid
        await InScopeAsync(async sp =>
        {
            await ActivatorUtilities.CreateInstance<OrderPaidOnlineIntegrationEventHandler>(sp)
                .Handle(new OrderPaidOnlineIntegrationEvent(orderId, Guid.NewGuid(), 100m, DateTime.UtcNow));
            return 0;
        });
        var paid = await mona.GetAsync<PaidAheadOrderView>($"{Orders}/{orderId}?{Version}");
        Assert.AreEqual("Submitted", paid.Status, "on the till's list now");
        Assert.IsNotNull(paid.PaidOnlineAt);
    }

    [TestMethod]
    public async Task The_customer_cancels_their_own_unpaid_order_and_nobody_else_can()
    {
        await PayAheadAsync(on: true);
        var userId = $"customer-{Guid.NewGuid():N}";
        var orderId = await PlacedAndPricedAsync(Customer(userId));

        var (stranger, _) = await Customer("someone-else").RefusedAsync(HttpMethod.Put, $"{Orders}/{orderId}/cancel-unpaid?{Version}", null);
        Assert.AreEqual(HttpStatusCode.NotFound, stranger);

        var (status, body) = await Customer(userId).RefusedAsync(HttpMethod.Put, $"{Orders}/{orderId}/cancel-unpaid?{Version}", null);
        Assert.AreEqual(HttpStatusCode.OK, status, body);
        Assert.AreEqual("Cancelled", (await Customer(userId).GetAsync<PaidAheadOrderView>($"{Orders}/{orderId}?{Version}")).Status);

        var (again, againBody) = await Customer(userId).RefusedAsync(HttpMethod.Put, $"{Orders}/{orderId}/cancel-unpaid?{Version}", null);
        Assert.AreEqual(HttpStatusCode.Conflict, again);
        Assert.Contains("waiting for its payment", againBody, "it no longer waits");
    }

    [TestMethod]
    public async Task Not_paid_in_time_the_sweep_cancels_it()
    {
        await PayAheadAsync(on: true);
        var mona = Customer($"customer-{Guid.NewGuid():N}");
        var orderId = await PlacedAndPricedAsync(mona);

        var swept = await InScopeAsync(sp => sp.GetRequiredService<MediatR.IMediator>()
            .Send(new ExpirePaidAheadOrdersCommand(DateTime.UtcNow + Order.PayAheadWindow + TimeSpan.FromSeconds(1))));

        Assert.IsGreaterThanOrEqualTo(1, swept);
        Assert.AreEqual("Cancelled", (await mona.GetAsync<PaidAheadOrderView>($"{Orders}/{orderId}?{Version}")).Status);
    }

    [TestMethod]
    public async Task Paid_but_not_accepted_in_time_the_sweep_cancels_it_so_its_money_is_let_go()
    {
        await PayAheadAsync(on: true);
        var mona = Customer($"customer-{Guid.NewGuid():N}");
        var orderId = await PlacedAndPricedAsync(mona);
        var paidAt = DateTime.UtcNow;
        await InScopeAsync(async sp =>
        {
            await ActivatorUtilities.CreateInstance<OrderPaidOnlineIntegrationEventHandler>(sp)
                .Handle(new OrderPaidOnlineIntegrationEvent(orderId, Guid.NewGuid(), 100m, paidAt));
            return 0;
        });
        var window = new PayAheadOptions().AcceptWithin;

        await InScopeAsync(sp => sp.GetRequiredService<MediatR.IMediator>().Send(new ExpirePaidAheadOrdersCommand(paidAt + window - TimeSpan.FromMinutes(1))));
        Assert.AreEqual("Submitted", (await mona.GetAsync<PaidAheadOrderView>($"{Orders}/{orderId}?{Version}")).Status, "the till still has time");

        await InScopeAsync(sp => sp.GetRequiredService<MediatR.IMediator>().Send(new ExpirePaidAheadOrdersCommand(paidAt + window + TimeSpan.FromSeconds(1))));
        Assert.AreEqual("Cancelled", (await mona.GetAsync<PaidAheadOrderView>($"{Orders}/{orderId}?{Version}")).Status);

        // Sales hears of it, and lets the payment go
        var told = await InScopeAsync(async sp =>
            (await sp.GetRequiredService<OrderingContext>().Set<IntegrationEventLogEntry>()
                .Where(e => e.EventTypeName.EndsWith(nameof(OrderStatusChangedToCancelledIntegrationEvent))).ToListAsync())
            .Select(e => JsonSerializer.Deserialize<OrderStatusChangedToCancelledIntegrationEvent>(e.Content)!)
            .Count(e => e.OrderId == orderId));
        Assert.AreEqual(1, told);
    }
}
