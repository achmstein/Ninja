using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// A drawer shift was opened at a branch. Branch.API takes this as "open for
/// business" and switches the branch's ordering and reservation flags on.
/// </summary>
/// <remarks>
/// <paramref name="OpenedByUserId"/> is the cashier's subject id, for Payroll
/// to mark their attendance; null on shifts opened before it was recorded.
/// </remarks>
public record ShiftOpenedIntegrationEvent(int ShiftId, int BranchId, string OpenedBy, DateTime OpenedAt, string? OpenedByUserId = null) : IntegrationEvent;
