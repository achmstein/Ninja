#nullable enable
using Ninja.Ordering.Infrastructure.Projections;

namespace Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// Keeps Ordering's projection of the business's switches: an upsert of the
/// one row, guarded against out-of-order delivery. An event older than what
/// the row already holds is dropped rather than letting a stale "on" undo a
/// newer "off".
/// </summary>
public class TenantFeaturesChangedIntegrationEventHandler(
    OrderingContext context,
    ILogger<TenantFeaturesChangedIntegrationEventHandler> logger,
    Microsoft.Extensions.Caching.Memory.IMemoryCache? cache = null)
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
                Delivery = @event.Delivery,
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

            row.Delivery = @event.Delivery;
            row.UpdatedAt = @event.CreationDate;
        }

        await context.SaveChangesAsync();
        cache?.Remove(BranchSettingsQueries.DeliveryOnCacheKey);

        logger.LogInformation("Tenant features projection: delivery {Delivery}", @event.Delivery);
    }
}
