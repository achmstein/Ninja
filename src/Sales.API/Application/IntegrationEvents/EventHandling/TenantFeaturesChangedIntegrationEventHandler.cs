#nullable enable
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.EventBus.Abstractions;
using Ninja.Sales.Infrastructure;
using Ninja.Sales.Infrastructure.Projections;

namespace Ninja.Sales.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// Keeps Sales' projection of the café's switches: an upsert of the one
/// row, guarded against out-of-order delivery — an event older than what
/// the row already holds is dropped rather than letting a stale "on" undo
/// a newer "off".
/// </summary>
public class TenantFeaturesChangedIntegrationEventHandler(
    SalesContext context,
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
                OnlinePayments = @event.OnlinePayments,
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

            row.OnlinePayments = @event.OnlinePayments;
            row.UpdatedAt = @event.CreationDate;
        }

        await context.SaveChangesAsync();

        logger.LogInformation("Tenant features projection: online payments {OnlinePayments}", @event.OnlinePayments);
    }
}
