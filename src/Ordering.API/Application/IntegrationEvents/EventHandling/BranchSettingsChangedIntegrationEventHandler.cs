using Ninja.Ordering.Infrastructure.Projections;

namespace Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// Keeps Ordering's projection of the branch flags: an upsert keyed by branch,
/// guarded against out-of-order delivery — an event older than what the row
/// already holds is dropped rather than letting a stale "off" undo a newer "on".
/// </summary>
public class BranchSettingsChangedIntegrationEventHandler(
    OrderingContext context,
    ILogger<BranchSettingsChangedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<BranchSettingsChangedIntegrationEvent>
{
    public async Task Handle(BranchSettingsChangedIntegrationEvent @event)
    {
        logger.LogInformation("Handling integration event: {IntegrationEventId} - ({@IntegrationEvent})", @event.Id, @event);

        var row = await context.BranchSettings.FindAsync(@event.BranchId);

        if (row is null)
        {
            context.BranchSettings.Add(new BranchSettings
            {
                BranchId = @event.BranchId,
                IsOrderingEnabled = @event.IsOrderingEnabled,
                IsReservationsEnabled = @event.IsReservationsEnabled,
                RequireSignInForTableOrders = @event.RequireSignInForTableOrders,
                UpdatedAt = @event.CreationDate,
            });
        }
        else
        {
            if (@event.CreationDate <= row.UpdatedAt)
            {
                logger.LogInformation(
                    "Branch {BranchId} settings event from {EventAt} is not newer than the projection ({RowAt}) - skipped",
                    @event.BranchId, @event.CreationDate, row.UpdatedAt);
                return;
            }

            row.IsOrderingEnabled = @event.IsOrderingEnabled;
            row.IsReservationsEnabled = @event.IsReservationsEnabled;
            row.RequireSignInForTableOrders = @event.RequireSignInForTableOrders;
            row.UpdatedAt = @event.CreationDate;
        }

        await context.SaveChangesAsync();

        logger.LogInformation(
            "Branch {BranchId} projection: ordering {Ordering}, reservations {Reservations}",
            @event.BranchId, @event.IsOrderingEnabled, @event.IsReservationsEnabled);
    }
}
