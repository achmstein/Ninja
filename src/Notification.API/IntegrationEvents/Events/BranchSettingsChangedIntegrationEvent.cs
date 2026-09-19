using Ninja.EventBus.Events;

namespace Ninja.Notification.API.IntegrationEvents.Events;

public record BranchSettingsChangedIntegrationEvent(
    int BranchId,
    bool IsOrderingEnabled,
    bool IsReservationsEnabled) : IntegrationEvent;
