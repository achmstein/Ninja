using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// A credit note was issued against a settled ticket. Accounts credits the
/// named tab when the tender is Account; Loyalty claws back, in proportion,
/// the points each refunded order had earned.
/// </summary>
/// <param name="OrderReversals">
/// Per order on the ticket that was touched: how much of its menu value came
/// back, against how much it was worth on the ticket. Empty when only room
/// time or manual lines were refunded — those earned no points.
/// </param>
public record TicketRefundedIntegrationEvent(
    int RefundId,
    int Number,
    int TicketId,
    int BranchId,
    int ReceiptNumber,
    decimal Amount,
    string Tender,
    string? CustomerId,
    string? CustomerName,
    string Reason,
    string RefundedBy,
    IReadOnlyCollection<RefundOrderReversal> OrderReversals) : IntegrationEvent;

public record RefundOrderReversal(int OrderId, decimal RefundedAmount, decimal OrderAmount);
