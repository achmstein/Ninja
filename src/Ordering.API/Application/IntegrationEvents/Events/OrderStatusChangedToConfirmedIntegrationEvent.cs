#nullable enable
using Chillax.Ordering.Domain.Seedwork;

namespace Chillax.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// Integration event sent when an order is confirmed by admin.
/// This event notifies other services (e.g., POS) that the order is ready.
/// </summary>
public record OrderStatusChangedToConfirmedIntegrationEvent : IntegrationEvent
{
    public int OrderId { get; }
    public OrderStatus OrderStatus { get; }
    public string BuyerName { get; }
    public string BuyerIdentityGuid { get; }
    public LocalizedText? RoomName { get; }
    public decimal OrderTotal { get; }
    public int PointsToRedeem { get; }

    /// <summary>
    /// Set instead of <see cref="BuyerIdentityGuid"/> when a guest placed the
    /// order — it is what the notification hub targets them by.
    /// </summary>
    public string? GuestId { get; }

    public OrderStatusChangedToConfirmedIntegrationEvent(
        int orderId, OrderStatus orderStatus, string buyerName, string buyerIdentityGuid, LocalizedText? roomName, decimal orderTotal, int pointsToRedeem = 0, string? guestId = null)
    {
        OrderId = orderId;
        OrderStatus = orderStatus;
        BuyerName = buyerName;
        BuyerIdentityGuid = buyerIdentityGuid;
        RoomName = roomName;
        OrderTotal = orderTotal;
        PointsToRedeem = pointsToRedeem;
        GuestId = guestId;
    }
}
