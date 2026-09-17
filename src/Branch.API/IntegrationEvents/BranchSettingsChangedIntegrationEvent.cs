using Chillax.EventBus.Events;

namespace Chillax.Branch.API.IntegrationEvents;

public record BranchSettingsChangedIntegrationEvent(
    int BranchId,
    bool IsOrderingEnabled,
    bool IsReservationsEnabled,
    bool RequireSignInForTableOrders = false) : IntegrationEvent;
