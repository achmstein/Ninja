#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Sales publishes when money goes back on a
/// settled ticket. Only the per-order reversals are read: each order keeps a
/// running refunded amount so the customer's list can say "Refunded".
/// </summary>
public record TicketRefundedIntegrationEvent(
    int RefundId,
    int Number,
    int TicketId,
    int BranchId,
    int ReceiptNumber,
    decimal Amount,
    IReadOnlyCollection<RefundOrderReversal>? OrderReversals = null) : IntegrationEvent;

public record RefundOrderReversal(int OrderId, decimal RefundedAmount, decimal OrderAmount);
