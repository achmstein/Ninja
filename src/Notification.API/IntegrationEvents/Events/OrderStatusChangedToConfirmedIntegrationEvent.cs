using Chillax.EventBus.Events;
using Chillax.Notification.API.Model;

namespace Chillax.Notification.API.IntegrationEvents.Events;

public record OrderStatusChangedToConfirmedIntegrationEvent : IntegrationEvent
{
    public int OrderId { get; }
    public OrderStatus OrderStatus { get; }
    public string BuyerName { get; }
    public string BuyerIdentityGuid { get; }
    // LEGACY(places): old room name from Ordering's event; the copy does not read PlaceName — remove when every till and customer app is on /api/places and /api/stays.
    public LocalizedText? RoomName { get; }
    public decimal OrderTotal { get; }
    public int PointsToRedeem { get; }

    /// <summary>Set instead of BuyerIdentityGuid when a guest placed the order.</summary>
    public string? GuestId { get; }

    /// <summary>The branch the order belongs to, so a kitchen or till screen can tell whose it is. Null from an older producer.</summary>
    public int? BranchId { get; }

    public OrderStatusChangedToConfirmedIntegrationEvent(
        int orderId, OrderStatus orderStatus, string buyerName, string buyerIdentityGuid, LocalizedText? roomName, decimal orderTotal, int pointsToRedeem = 0, string? guestId = null, int? branchId = null)
    {
        OrderId = orderId;
        OrderStatus = orderStatus;
        BuyerName = buyerName;
        BuyerIdentityGuid = buyerIdentityGuid;
        RoomName = roomName;
        OrderTotal = orderTotal;
        PointsToRedeem = pointsToRedeem;
        GuestId = guestId;
        BranchId = branchId;
    }
}
