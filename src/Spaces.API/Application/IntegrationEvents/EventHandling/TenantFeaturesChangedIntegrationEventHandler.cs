using Ninja.EventBus.Abstractions;
using Ninja.Spaces.API.Application.IntegrationEvents.Events;
using Ninja.Spaces.Infrastructure.Projections;
using SpacesContext = Ninja.Spaces.Infrastructure.SpacesContext;

namespace Ninja.Spaces.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// Keeps Spaces' projection of the café's switches: an upsert of the one
/// row, guarded against out-of-order delivery — an event older than what
/// the row already holds is dropped rather than letting a stale "off" undo
/// a newer "on".
/// </summary>
public class TenantFeaturesChangedIntegrationEventHandler(
    SpacesContext context,
    ILogger<TenantFeaturesChangedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<TenantFeaturesChangedIntegrationEvent>
{
    public async Task Handle(TenantFeaturesChangedIntegrationEvent @event)
    {
        logger.LogInformation("Handling integration event: {IntegrationEventId} - ({@IntegrationEvent})", @event.Id, @event);

        var row = await context.TenantFeatures.FindAsync(TenantFeatures.SingletonId);

        if (row is null)
        {
            context.TenantFeatures.Add(new TenantFeatures
            {
                Reservations = @event.Reservations,
                TimeBilling = @event.TimeBilling,
                UpdatedAt = @event.CreationDate,
            });
        }
        else
        {
            if (@event.CreationDate <= row.UpdatedAt)
            {
                logger.LogInformation(
                    "Tenant features event from {EventAt} is not newer than the projection ({RowAt}) - skipped",
                    @event.CreationDate, row.UpdatedAt);
                return;
            }

            row.Reservations = @event.Reservations;
            row.TimeBilling = @event.TimeBilling;
            row.UpdatedAt = @event.CreationDate;
        }

        await context.SaveChangesAsync();

        logger.LogInformation(
            "Tenant features projection: reservations {Reservations}, time billing {TimeBilling}",
            @event.Reservations, @event.TimeBilling);
    }
}
