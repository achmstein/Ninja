using Ninja.Ordering.Infrastructure.Projections;

namespace Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// Keeps Ordering's projection of the café's own settings: an upsert of the
/// one row, guarded against out-of-order delivery — an event older than what
/// the row already holds is dropped rather than letting a stale "off" undo a
/// newer "on".
/// </summary>
public class TenantSettingsChangedIntegrationEventHandler(
    OrderingContext context,
    ILogger<TenantSettingsChangedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<TenantSettingsChangedIntegrationEvent>
{
    public async Task Handle(TenantSettingsChangedIntegrationEvent @event)
    {
        logger.LogInformation("Handling integration event: {IntegrationEventId} - ({@IntegrationEvent})", @event.Id, @event);

        var row = await context.TenantSettings.FindAsync(TenantSettings.SingletonId);

        if (row is null)
        {
            context.TenantSettings.Add(new TenantSettings
            {
                GuestOrdersAnywhere = @event.GuestOrdersAnywhere,
                UpdatedAt = @event.CreationDate,
            });
        }
        else
        {
            if (@event.CreationDate <= row.UpdatedAt)
            {
                logger.LogInformation(
                    "Tenant settings event from {EventAt} is not newer than the projection ({RowAt}) - skipped",
                    @event.CreationDate, row.UpdatedAt);
                return;
            }

            row.GuestOrdersAnywhere = @event.GuestOrdersAnywhere;
            row.UpdatedAt = @event.CreationDate;
        }

        await context.SaveChangesAsync();

        logger.LogInformation("Tenant settings projection: guest orders anywhere {GuestOrdersAnywhere}", @event.GuestOrdersAnywhere);
    }
}
