using Chillax.Branch.API.Services;
using Chillax.EventBus.Abstractions;

namespace Chillax.Branch.API.IntegrationEvents.EventHandling;

/// <summary>
/// The shift closing is the branch closing: both flags go off.
/// </summary>
public class ShiftClosedIntegrationEventHandler(
    BranchSettingsService settings,
    ILogger<ShiftClosedIntegrationEventHandler> logger) : IIntegrationEventHandler<ShiftClosedIntegrationEvent>
{
    public async Task Handle(ShiftClosedIntegrationEvent @event)
    {
        logger.LogInformation("Handling integration event: {IntegrationEventId} - ({@IntegrationEvent})", @event.Id, @event);

        var branch = await settings.ApplyAsync(@event.BranchId, isOrderingEnabled: false, isReservationsEnabled: false);

        if (branch == null)
        {
            logger.LogWarning("Shift {ShiftId} closed for unknown branch {BranchId} - nothing to switch off", @event.ShiftId, @event.BranchId);
        }
    }
}
