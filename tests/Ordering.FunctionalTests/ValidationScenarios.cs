using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Ninja.IntegrationEventLogEF;
using Ninja.IntegrationEventLogEF.Services;
using Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;
using Ninja.Ordering.API.Application.IntegrationEvents.Events;
using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;
using Ninja.Ordering.Infrastructure;
using Ninja.Testing;

namespace Ninja.Ordering.FunctionalTests;

/// <summary>
/// The menu prices an order, not the app: the question to Catalog carries
/// each line as the app priced it, and Catalog's answer is what the order
/// costs. What the outbox kept but never sent goes out on the relay.
/// </summary>
[TestClass]
public sealed class ValidationScenarios
{
    private const string Version = "api-version=1.0";
    private static Caller Till => Suite.Ordering.As(Persona.Cashier(Suite.Branch), Suite.Branch);

    private static async Task<int> TamperedSaleAsync()
    {
        // A 50 latte with a +10 large, sent at 1
        var request = new HttpRequestMessage(HttpMethod.Post, $"/api/orders/pos?{Version}")
        {
            Content = JsonContent.Create(new
            {
                items = new[]
                {
                    new
                    {
                        id = Guid.NewGuid().ToString(),
                        productId = 7,
                        productName = new { en = "Latte", ar = "لاتيه" },
                        unitPrice = 1m,
                        quantity = 2,
                        selectedCustomizations = new[]
                        {
                            new { customizationId = 3, customizationName = new { en = "Size", ar = "الحجم" }, optionId = 9, optionName = new { en = "Large", ar = "كبير" }, priceAdjustment = 0m },
                        },
                    },
                },
            }, options: Caller.Json),
        };
        request.Headers.Add("x-requestid", Guid.NewGuid().ToString());
        using var response = await Till.Http.SendAsync(request);
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<PosOrderView>(Caller.Json))!.OrderId;
    }

    private static async Task<T> InScopeAsync<T>(Func<IServiceProvider, Task<T>> work)
    {
        using var scope = Suite.Ordering.Services.CreateScope();
        return await work(scope.ServiceProvider);
    }

    [TestMethod]
    public async Task The_menus_price_stands_over_what_the_app_sent()
    {
        var orderId = await TamperedSaleAsync();

        // The question carries the order's own lines, as the app priced them
        var asked = await InScopeAsync(async sp =>
        {
            var log = await sp.GetRequiredService<OrderingContext>().Set<IntegrationEventLogEntry>()
                .Where(e => e.EventTypeName.EndsWith(nameof(OrderStatusChangedToAwaitingValidationIntegrationEvent)))
                .ToListAsync();
            return log
                .Select(e => JsonSerializer.Deserialize<OrderStatusChangedToAwaitingValidationIntegrationEvent>(e.Content)!)
                .Single(e => e.OrderId == orderId);
        });
        var line = asked.Lines!.Single();
        Assert.AreEqual(7, line.ProductId);
        Assert.AreEqual(2, line.Units);
        Assert.AreEqual(1m, line.UnitPrice);
        CollectionAssert.AreEqual(new[] { 9 }, line.OptionIds);
        Assert.IsTrue(asked.PriceCheck);
        Assert.IsNotNull(asked.PlacedAt);

        // Catalog answers with the menu's 60
        await InScopeAsync(async sp =>
        {
            await ActivatorUtilities.CreateInstance<OrderValidatedIntegrationEventHandler>(sp)
                .Handle(new OrderValidatedIntegrationEvent(orderId) { Prices = new() { [line.LineId] = 60m } });
            return 0;
        });

        var order = await InScopeAsync(sp => sp.GetRequiredService<OrderingContext>().Orders
            .Include(o => o.OrderItems).AsNoTracking().SingleAsync(o => o.Id == orderId));
        Assert.AreEqual(OrderStatus.Confirmed, order.OrderStatus, "a till sale confirms itself once the menu says yes");
        Assert.AreEqual(60m, order.OrderItems.Single().UnitPrice);
        Assert.AreEqual(120m, order.GetTotal());
    }

    [TestMethod]
    public async Task What_the_outbox_kept_but_never_sent_goes_out_on_the_relay()
    {
        var stuck = new OrderReminderIntegrationEvent(1, "Mona", Suite.Branch, 1, 3) { CreationDate = DateTime.UtcNow.AddMinutes(-5) };

        await InScopeAsync(async sp =>
        {
            // Saved the way a command saves it, then never published
            var context = sp.GetRequiredService<OrderingContext>();
            await context.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
                await using var transaction = await context.Database.BeginTransactionAsync();
                await sp.GetRequiredService<IIntegrationEventLogService>().SaveEventAsync(stuck, transaction);
                await transaction.CommitAsync();
            });
            return 0;
        });

        var relayed = await Suite.Ordering.Services.GetRequiredService<OutboxRelay>().RelayOnceAsync(DateTime.UtcNow);

        Assert.IsGreaterThanOrEqualTo(1, relayed);
        var entry = await InScopeAsync(sp => sp.GetRequiredService<OrderingContext>().Set<IntegrationEventLogEntry>()
            .AsNoTracking().SingleAsync(e => e.EventId == stuck.Id));
        Assert.AreEqual(EventStateEnum.Published, entry.State);
        Assert.AreEqual(1, entry.TimesSent);

        // Sent is sent: the next pass leaves it alone
        await Suite.Ordering.Services.GetRequiredService<OutboxRelay>().RelayOnceAsync(DateTime.UtcNow);
        var again = await InScopeAsync(sp => sp.GetRequiredService<OrderingContext>().Set<IntegrationEventLogEntry>()
            .AsNoTracking().SingleAsync(e => e.EventId == stuck.Id));
        Assert.AreEqual(1, again.TimesSent);
    }
}
