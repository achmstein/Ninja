#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Sales publishes when an owner voids an open
/// ticket. Only the per-order reversals are read: each order on the bill is
/// stamped voided, so the customer's list stops saying "Unpaid" for a bill
/// that will never be paid.
/// </summary>
public record TicketVoidedIntegrationEvent(
    int TicketId,
    int BranchId,
    string? Reason = null,
    string? VoidedBy = null,
    IReadOnlyCollection<RefundOrderReversal>? OrderReversals = null) : IntegrationEvent;
