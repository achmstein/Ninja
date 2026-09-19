using Ninja.Branch.API.Services;
using Ninja.EventBus.Abstractions;

namespace Ninja.Branch.API.IntegrationEvents.EventHandling;

/// <summary>
/// The shift opening is the branch opening: both flags go on, and the
/// resulting <see cref="BranchSettingsChangedIntegrationEvent"/> tells the
/// consumers (and the till, over SignalR) about it.
/// </summary>
public class ShiftOpenedIntegrationEventHandler(
    BranchSettingsService settings,
    ILogger<ShiftOpenedIntegrationEventHandler> logger) : IIntegrationEventHandler<ShiftOpenedIntegrationEvent>
{
    public async Task Handle(ShiftOpenedIntegrationEvent @event)
    {
        logger.LogInformation("Handling integration event: {IntegrationEventId} - ({@IntegrationEvent})", @event.Id, @event);

        var branch = await settings.ApplyAsync(@event.BranchId, isOrderingEnabled: true, isReservationsEnabled: true);

        if (branch == null)
        {
            logger.LogWarning("Shift {ShiftId} opened for unknown branch {BranchId} - nothing to switch on", @event.ShiftId, @event.BranchId);
        }
    }
}
