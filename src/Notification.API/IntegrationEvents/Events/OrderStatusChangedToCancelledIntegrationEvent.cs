using Ninja.EventBus.Events;

namespace Ninja.Notification.API.IntegrationEvents.Events;

public record OrderStatusChangedToCancelledIntegrationEvent : IntegrationEvent
{
    public int OrderId { get; }
    public OrderStatus OrderStatus { get; }
    public string BuyerName { get; }
    public string BuyerIdentityGuid { get; }

    /// <summary>Set instead of BuyerIdentityGuid when a guest placed the order.</summary>
    public string? GuestId { get; }

    public OrderStatusChangedToCancelledIntegrationEvent(
        int orderId, OrderStatus orderStatus, string buyerName, string buyerIdentityGuid, string? guestId = null)
    {
        OrderId = orderId;
        OrderStatus = orderStatus;
        BuyerName = buyerName;
        BuyerIdentityGuid = buyerIdentityGuid;
        GuestId = guestId;
    }
}
