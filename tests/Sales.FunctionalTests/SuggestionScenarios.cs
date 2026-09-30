using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Ninja.Sales.API.Extensions;
using Ninja.Sales.API.Application.IntegrationEvents.EventHandling;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.API.Application.Queries;
using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;
using Ninja.Sales.Infrastructure;
using Ninja.Testing;

namespace Ninja.Sales.FunctionalTests;

/// <summary>
/// What the business's suggestions ("goes well with") sold: a line Ordering
/// says was added from a suggestion keeps saying so on the bill, and the
/// report over a settled window adds those lines up.
/// </summary>
[TestClass]
public sealed class SuggestionScenarios
{
    private static int _nextOrder = 950_000;

    private static Caller Till => Suite.Sales.As(Persona.Cashier(Suite.Branch), Suite.Branch);

    /// <summary>A platform order the platform pays for, so its bill settles the moment it lands.</summary>
    private static OrderStatusChangedToConfirmedIntegrationEvent SettledOrder(int orderId, params OrderConfirmedItem[] items)
        => new(
            orderId,
            BuyerName: "Mona Adel",
            BuyerIdentityGuid: string.Empty,
            OrderTotal: items.Sum(i => i.Units * i.UnitPrice - i.Discount),
            PointsToRedeem: 0,
            GuestId: null,
            BranchId: Suite.Branch,
            SessionId: null,
            Source: "Talabat",
            GuestPhone: null,
            LoyaltyDiscount: 0,
            Items: [.. items],
            CustomerName: "Mona Adel",
            Platform: "Talabat",
            PlatformCode: $"S{orderId}",
            PlatformSettles: true);

    private static async Task<Ticket> SettleAsync(OrderStatusChangedToConfirmedIntegrationEvent @event)
    {
        using var scope = Suite.Sales.Services.CreateScope();
        var handler = ActivatorUtilities.CreateInstance<OrderStatusChangedToConfirmedIntegrationEventHandler>(scope.ServiceProvider);
        await handler.Handle(@event);

        var db = scope.ServiceProvider.GetRequiredService<SalesContext>();
        return await db.Tickets.Include(t => t.Lines).AsNoTracking().SingleAsync(t => t.Lines.Any(l => l.OrderId == @event.OrderId));
    }

    [TestMethod]
    public async Task A_suggested_line_keeps_saying_so_and_the_report_adds_it_up()
    {
        var orderId = Interlocked.Increment(ref _nextOrder);
        var ticket = await SettleAsync(SettledOrder(orderId,
            new(1, new("Cappuccino", "كابتشينو"), 2, 50m, 0m, null),
            new(2, new("Waffle", "وافل"), 1, 70m, 10m, null, SuggestionSource.Pairing),
            new(3, new("Ice Cream", "آيس كريم"), 2, 40m, 0m, null, SuggestionSource.CartNudge)));

        Assert.AreEqual(TicketStatus.Settled, ticket.Status);
        Assert.AreEqual(SuggestionSource.None, ticket.Lines.Single(l => l.CatalogItemId == 1).Suggestion);
        Assert.AreEqual(SuggestionSource.Pairing, ticket.Lines.Single(l => l.CatalogItemId == 2).Suggestion);
        Assert.AreEqual(SuggestionSource.CartNudge, ticket.Lines.Single(l => l.CatalogItemId == 3).Suggestion);

        // A window around this bill alone, so other scenarios' bills stay out of it
        var at = ticket.SettledAt!.Value;
        var from = Uri.EscapeDataString(at.ToString("O"));
        var to = Uri.EscapeDataString(at.AddTicks(10).ToString("O"));
        var report = await Till.GetAsync<RangeReport>($"/api/tickets/reports/range?api-version=1.0&from={from}&to={to}");

        Assert.AreEqual(1, report.TicketsSettled);
        Assert.AreEqual(2, report.SuggestedLines);
        Assert.AreEqual(60m + 80m, report.SuggestedSales, "the waffle after its discount and both ice creams; the coffee was picked by hand");
    }

    [TestMethod]
    public async Task A_bill_nothing_was_suggested_on_sells_nothing_from_suggestions()
    {
        var orderId = Interlocked.Increment(ref _nextOrder);
        var ticket = await SettleAsync(SettledOrder(orderId, new OrderConfirmedItem(1, new("Tea", "شاي"), 1, 20m, 0m, null)));

        var at = ticket.SettledAt!.Value;
        var report = await Till.GetAsync<RangeReport>(
            $"/api/tickets/reports/range?api-version=1.0&from={Uri.EscapeDataString(at.ToString("O"))}&to={Uri.EscapeDataString(at.AddTicks(10).ToString("O"))}");

        Assert.AreEqual(1, report.TicketsSettled);
        Assert.AreEqual(0, report.SuggestedLines);
        Assert.AreEqual(0m, report.SuggestedSales);
    }

    /// <summary>Ordering writes the source as its name; the copy Sales reads it into agrees, and an older Ordering that sends none means none.</summary>
    [TestMethod]
    public void The_confirmation_reads_the_suggestion_Ordering_wrote()
    {
        const string line = """{"ProductId":2,"ProductName":{"En":"Waffle","Ar":null},"Units":1,"UnitPrice":70,"Discount":0,"CustomizationsDescription":null""";

        var suggested = JsonSerializer.Deserialize(line + ""","OptionIds":null,"Suggestion":"Pairing"}""", SalesIntegrationEventContext.Default.OrderConfirmedItem);
        var older = JsonSerializer.Deserialize(line + "}", SalesIntegrationEventContext.Default.OrderConfirmedItem);

        Assert.AreEqual(SuggestionSource.Pairing, suggested!.Suggestion);
        Assert.AreEqual(SuggestionSource.None, older!.Suggestion);
    }
}
