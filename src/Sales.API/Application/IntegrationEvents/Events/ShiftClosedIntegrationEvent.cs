using Chillax.EventBus.Events;

namespace Chillax.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// The drawer shift was closed. Branch.API switches the branch's ordering and
/// reservation flags off — the counterpart of <see cref="ShiftOpenedIntegrationEvent"/>.
/// </summary>
public record ShiftClosedIntegrationEvent(int ShiftId, int BranchId, string ClosedBy, DateTime ClosedAt) : IntegrationEvent;
