using Ninja.EventBus.Abstractions;
using Ninja.Spaces.API.Application.DomainEventHandlers;
using SpacesContext = Ninja.Spaces.Infrastructure.SpacesContext;

namespace Ninja.Spaces.API.Application.BackgroundServices;

/// <summary>
/// Says every place again after each start, and from time to time after that. A place is otherwise
/// only announced when it is made or changed, so a service that began keeping its copy later never
/// heard of the older ones, and clients were left to say what a place is called. With every copy
/// complete, a place is named by its id alone and Spaces is the one that says what it is called.
/// Said once it would be heard only by the services already listening at that moment: one that
/// starts a little later than Spaces (every upgrade, every fresh stack) would miss it for good. So
/// it is said several times while the stack comes up, then hourly, which also mends a copy that
/// lost a message. A few dozen places, and hearing one twice is the same row written again.
/// </summary>
public sealed class PlacesAnnouncer(IServiceScopeFactory scopes, ILogger<PlacesAnnouncer> logger) : BackgroundService
{
    /// <summary>How long after the start each telling waits for the one before; the last is kept to from then on.</summary>
    public static readonly TimeSpan[] Waits =
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
                var said = await AnnounceAsync(
                    scope.ServiceProvider.GetRequiredService<SpacesContext>(),
                    scope.ServiceProvider.GetRequiredService<IEventBus>(),
                    stoppingToken);
                if (said > 0 && telling == 0) logger.LogInformation("Places said again to the services that keep a copy: {Count}", said);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
            }
            catch (Exception ex)
            {
                // Not worth a failed service: the next telling tries again
                logger.LogWarning(ex, "The places were not said again");
            }
        }
    }

    public static async Task<int> AnnounceAsync(SpacesContext context, IEventBus bus, CancellationToken ct = default)
    {
        var places = await context.Places.AsNoTracking().ToListAsync(ct);
        foreach (var place in places)
        {
            await bus.PublishAsync(place.ToUpdatedEvent());
        }
        return places.Count;
    }
}
