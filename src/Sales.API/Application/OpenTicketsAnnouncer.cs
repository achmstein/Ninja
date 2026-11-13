using Ninja.EventBus.Abstractions;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.Infrastructure;

namespace Ninja.Sales.API.Application;

/// <summary>
/// Says again, after every start and from time to time after that, which place each open bill is the
/// bill of. A bill opened before Ordering kept that (or while the bus was down longer than the outbox
/// waits) would otherwise send its orders to the kitchen with no place on them for as long as it
/// stays open. Said once it would be heard only if Ordering was already listening at that moment,
/// so it is said several times while the stack comes up, then hourly. A handful of bills, and
/// hearing one twice changes nothing.
/// </summary>
public sealed class OpenTicketsAnnouncer(IServiceScopeFactory scopes, ILogger<OpenTicketsAnnouncer> logger) : BackgroundService
{
    /// <summary>How long each telling waits for the one before; the last is kept to from then on.</summary>
    private static readonly TimeSpan[] Waits =
    [
        TimeSpan.FromSeconds(10), TimeSpan.FromSeconds(10), TimeSpan.FromSeconds(20), TimeSpan.FromSeconds(40),
        TimeSpan.FromSeconds(80), TimeSpan.FromMinutes(5), TimeSpan.FromHours(1),
    ];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        for (var telling = 0; !stoppingToken.IsCancellationRequested; telling++)
        {
            try
            {
                await Task.Delay(Waits[Math.Min(telling, Waits.Length - 1)], stoppingToken);
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
                if (open.Count > 0 && telling == 0) logger.LogInformation("Open bills said again to Ordering: {Count}", open.Count);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
            }
            catch (Exception ex)
            {
                // Not worth a failed service: the next telling tries again
                logger.LogWarning(ex, "The open bills were not said again to Ordering");
            }
        }
    }
}
