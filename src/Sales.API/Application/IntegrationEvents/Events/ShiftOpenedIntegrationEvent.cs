using Chillax.EventBus.Events;

namespace Chillax.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// A drawer shift was opened at a branch. Branch.API takes this as "open for
/// business" and switches the branch's ordering and reservation flags on.
/// </summary>
public record ShiftOpenedIntegrationEvent(int ShiftId, int BranchId, string OpenedBy, DateTime OpenedAt) : IntegrationEvent;
