using Ninja.EventBus.Events;

namespace Ninja.Tenant.API.IntegrationEvents;

public record BranchSettingsChangedIntegrationEvent(
    int BranchId,
    bool IsOrderingEnabled,
    bool IsReservationsEnabled,
    bool RequireSignInForTableOrders = false) : IntegrationEvent;
