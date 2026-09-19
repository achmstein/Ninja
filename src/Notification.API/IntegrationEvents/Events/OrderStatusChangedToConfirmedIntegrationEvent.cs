using Ninja.EventBus.Events;

namespace Ninja.Notification.API.IntegrationEvents.Events;

public record OrderStatusChangedToConfirmedIntegrationEvent : IntegrationEvent
{
    public int OrderId { get; }
    public OrderStatus OrderStatus { get; }
    public string BuyerName { get; }
    public string BuyerIdentityGuid { get; }
    public decimal OrderTotal { get; }
    public int PointsToRedeem { get; }

    /// <summary>Set instead of BuyerIdentityGuid when a guest placed the order.</summary>
    public string? GuestId { get; }

    /// <summary>The branch the order belongs to, so a kitchen or till screen can tell whose it is. Null from an older producer.</summary>
    public int? BranchId { get; }

    public OrderStatusChangedToConfirmedIntegrationEvent(
        int orderId, OrderStatus orderStatus, string buyerName, string buyerIdentityGuid, decimal orderTotal, int pointsToRedeem = 0, string? guestId = null, int? branchId = null)
    {
        OrderId = orderId;
        OrderStatus = orderStatus;
        BuyerName = buyerName;
        BuyerIdentityGuid = buyerIdentityGuid;
        OrderTotal = orderTotal;
        PointsToRedeem = pointsToRedeem;
        GuestId = guestId;
        BranchId = branchId;
    }
}
