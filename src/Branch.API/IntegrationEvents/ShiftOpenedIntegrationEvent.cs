using Ninja.EventBus.Events;

namespace Ninja.Branch.API.IntegrationEvents;

/// <summary>
/// Consumer copy of the event Sales publishes when a drawer shift opens.
/// Same type name and properties as the source — the routing key is the
/// type name.
/// </summary>
public record ShiftOpenedIntegrationEvent(int ShiftId, int BranchId, string OpenedBy, DateTime OpenedAt) : IntegrationEvent;
