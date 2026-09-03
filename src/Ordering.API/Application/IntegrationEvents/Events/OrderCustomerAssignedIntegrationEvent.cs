#nullable enable
namespace Chillax.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// Integration event sent when a customer is put on an order after it was
/// placed. Sales re-tags the order's lines with the new snapshot; Loyalty
/// awards what confirmation skipped for want of anyone to credit, so the
/// event carries the same figures the confirmed event does — and, when the
/// order changed hands, the account it left, whose points move with it.
/// </summary>
public record OrderCustomerAssignedIntegrationEvent : IntegrationEvent
{
    public int OrderId { get; }
    public int BranchId { get; }

    /// <summary>The account now behind the order; null when only a name was given.</summary>
    public string? BuyerIdentityGuid { get; }

    /// <summary>Who the order is for, as it will read on the bill line.</summary>
    public string? CustomerName { get; }

    /// <summary>
    /// Confirmed, Submitted, … as a string. Loyalty awards only for a
    /// confirmed order; one still pending earns at its own confirmation,
    /// which by then carries the buyer.
    /// </summary>
    public string OrderStatus { get; }

    /// <summary>What the order came to, the base loyalty accrues on.</summary>
    public decimal OrderTotal { get; }

    /// <summary>
    /// The account the order was taken off, when it changed hands; null when
    /// it had only a name, or nobody, before. Last, and optional, so consumer
    /// copies without it keep deserializing.
    /// </summary>
    public string? PreviousBuyerIdentityGuid { get; }

    public OrderCustomerAssignedIntegrationEvent(
        int orderId,
        int branchId,
        string? buyerIdentityGuid,
        string? customerName,
        string orderStatus,
        decimal orderTotal,
        string? previousBuyerIdentityGuid = null)
    {
        OrderId = orderId;
        BranchId = branchId;
        BuyerIdentityGuid = buyerIdentityGuid;
        CustomerName = customerName;
        OrderStatus = orderStatus;
        OrderTotal = orderTotal;
        PreviousBuyerIdentityGuid = previousBuyerIdentityGuid;
    }
}
