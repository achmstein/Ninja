using Ninja.EventBus.Abstractions;
using Ninja.Spaces.API.Application.DomainEventHandlers;
using SpacesContext = Ninja.Spaces.Infrastructure.SpacesContext;

namespace Ninja.Spaces.API.Application.BackgroundServices;

/// <summary>
/// Says every place again, once at each start. A place is otherwise only announced when it is made
/// or changed, so a service that began keeping its copy later never heard of the older ones, and
/// clients were left to say what a place is called. With every copy complete, a place is named by
/// its id alone and Spaces is the one that says what it is called. A few dozen places, and hearing
/// one twice is the same row written again.
/// </summary>
public sealed class PlacesAnnouncer(IServiceScopeFactory scopes, ILogger<PlacesAnnouncer> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // After the service is up: the migration has run and the bus is connected
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            using var scope = scopes.CreateScope();
            var said = await AnnounceAsync(
                scope.ServiceProvider.GetRequiredService<SpacesContext>(),
                scope.ServiceProvider.GetRequiredService<IEventBus>(),
                stoppingToken);
            if (said > 0) logger.LogInformation("Places said again to the services that keep a copy: {Count}", said);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            // Not worth a failed start: a place says itself again the next time it changes
            logger.LogWarning(ex, "The places were not said again");
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
