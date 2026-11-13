using Ninja.EventBus.Abstractions;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.Infrastructure;

namespace Ninja.Sales.API.Application;

/// <summary>
/// Says again, once at every start, which place each open bill is the bill of. A bill opened before
/// Ordering kept that (or while the bus was down longer than the outbox waits) would otherwise send
/// its orders to the kitchen with no place on them for as long as it stays open. A handful of bills,
/// and hearing one twice changes nothing.
/// </summary>
public sealed class OpenTicketsAnnouncer(IServiceScopeFactory scopes, ILogger<OpenTicketsAnnouncer> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // After the service is up: the migration has run and the bus is connected
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            using var scope = scopes.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<SalesContext>();
            var bus = scope.ServiceProvider.GetRequiredService<IEventBus>();

            var open = await context.Tickets.AsNoTracking()
                .Where(t => t.Status == TicketStatus.Open && t.PlaceId != null)
                .ToListAsync(stoppingToken);
            foreach (var ticket in open)
            {
                await bus.PublishAsync(new TicketOpenedIntegrationEvent(
                    ticket.Id, ticket.BranchId, ticket.PlaceId!.Value, ticket.PlaceKind, ticket.LocationName));
            }
            if (open.Count > 0) logger.LogInformation("Open bills said again to Ordering: {Count}", open.Count);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            // Not worth a failed start: the bills opened from now on say it themselves
            logger.LogWarning(ex, "The open bills were not said again to Ordering");
        }
    }
}
