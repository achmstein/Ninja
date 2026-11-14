#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

public record OrderStatusChangedToSubmittedIntegrationEvent : IntegrationEvent
{
    public int OrderId { get; }
    public OrderStatus OrderStatus { get; }
    public string BuyerName { get; }
    public string BuyerIdentityGuid { get; }
    public int BranchId { get; }

    /// <summary>
    /// Set instead of <see cref="BuyerIdentityGuid"/> when a guest placed the
    /// order — it is what the notification hub targets them by.
    /// </summary>
    public string? GuestId { get; }

    /// <summary>
    /// Where the order came from (Customer, Guest, Pos, Talabat), so a till can tell an order a
    /// guest sent, which waits for a tap, from one a cashier rang up, which is only news to the other tills.
    /// </summary>
    public string? Source { get; }

    /// <summary>The cashier who rang it up, for an order made at a till.</summary>
    public string? TakenByName { get; }

    public OrderStatusChangedToSubmittedIntegrationEvent(
        int orderId, OrderStatus orderStatus, string buyerName, string buyerIdentityGuid, int branchId = 1, string? guestId = null,
        string? source = null, string? takenByName = null)
    {
        Source = source;
        TakenByName = takenByName;
        OrderId = orderId;
        OrderStatus = orderStatus;
        BuyerName = buyerName;
        BuyerIdentityGuid = buyerIdentityGuid;
        BranchId = branchId;
        GuestId = guestId;
    }
}
