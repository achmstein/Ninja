using Ninja.EventBus.Events;

namespace Ninja.Spaces.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Branch.API publishes whenever a branch's
/// operational flags change (the shift opening or closing, or a pause from
/// the till or the admin app). Same type name and properties as the source —
/// the routing key is the type name.
/// </summary>
public record BranchSettingsChangedIntegrationEvent(
    int BranchId,
    bool IsOrderingEnabled,
    bool IsReservationsEnabled) : IntegrationEvent;
