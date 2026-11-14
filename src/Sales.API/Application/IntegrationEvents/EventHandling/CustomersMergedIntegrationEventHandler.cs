#nullable enable
using Microsoft.EntityFrameworkCore;
using Ninja.EventBus.Abstractions;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.Infrastructure;

namespace Ninja.Sales.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// The merged-away account's lines, payments on account, credit notes and tab
/// payments are the kept customer's from here on, under their name: an open
/// bill settles onto the right tab, and a receipt looked up later names the
/// person it belongs to. No money moves and no total changes. Each statement
/// finds nothing to do the second time.
/// </summary>
public class CustomersMergedIntegrationEventHandler(
    SalesContext context,
    ILogger<CustomersMergedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<CustomersMergedIntegrationEvent>
{
    public async Task Handle(CustomersMergedIntegrationEvent @event)
    {
        var (from, into, name) = (@event.FromUserId, @event.IntoUserId, @event.IntoDisplayName);
        if (string.IsNullOrWhiteSpace(from) || string.IsNullOrWhiteSpace(into) || from == into)
            return;
        var named = !string.IsNullOrWhiteSpace(name);

        var lines = await context.TicketLines.IgnoreQueryFilters().Where(l => l.CustomerId == from)
            .ExecuteUpdateAsync(s => s.SetProperty(l => l.CustomerId, into).SetProperty(l => l.CustomerName, l => named ? name : l.CustomerName));
        var payments = await context.Payments.IgnoreQueryFilters().Where(p => p.CustomerId == from)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.CustomerId, into).SetProperty(p => p.CustomerName, p => named ? name : p.CustomerName));
        var refunds = await context.Refunds.IgnoreQueryFilters().Where(r => r.CustomerId == from)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.CustomerId, into).SetProperty(r => r.CustomerName, r => named ? name : r.CustomerName));
        var tabPayments = await context.TabPayments.IgnoreQueryFilters().Where(t => t.CustomerId == from)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.CustomerId, into).SetProperty(t => t.CustomerName, t => named ? name : t.CustomerName));

        logger.LogInformation("Merged user {From} into {Into}: {Lines} line(s), {Payments} payment(s), {Refunds} credit note(s), {TabPayments} tab payment(s)",
            from, into, lines, payments, refunds, tabPayments);
    }
}
