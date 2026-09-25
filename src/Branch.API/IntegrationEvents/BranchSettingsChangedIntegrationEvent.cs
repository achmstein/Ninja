using Ninja.EventBus.Events;

namespace Ninja.Branch.API.IntegrationEvents;

public record BranchSettingsChangedIntegrationEvent(
    int BranchId,
    bool IsOrderingEnabled,
    bool IsReservationsEnabled,
    bool RequireSignInForTableOrders = false,
    bool GuestOrdersAnywhere = false) : IntegrationEvent;
