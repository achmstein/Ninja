using Chillax.EventBus.Events;

namespace Chillax.Branch.API.IntegrationEvents;

/// <summary>
/// Consumer copy of the event Sales publishes when a drawer shift closes.
/// </summary>
public record ShiftClosedIntegrationEvent(int ShiftId, int BranchId, string ClosedBy, DateTime ClosedAt) : IntegrationEvent;
