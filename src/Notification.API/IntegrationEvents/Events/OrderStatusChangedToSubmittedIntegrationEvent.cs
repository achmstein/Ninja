using System.Text.Json.Serialization;
using Chillax.EventBus.Events;

namespace Chillax.Notification.API.IntegrationEvents.Events;

public record OrderStatusChangedToSubmittedIntegrationEvent : IntegrationEvent
{
    public int OrderId { get; }
    public OrderStatus OrderStatus { get; }
    public string BuyerName { get; }
    public string BuyerIdentityGuid { get; }
    public int BranchId { get; }

    /// <summary>Set instead of BuyerIdentityGuid when a guest placed the order.</summary>
    public string? GuestId { get; }

    public OrderStatusChangedToSubmittedIntegrationEvent(
        int orderId, OrderStatus orderStatus, string buyerName, string buyerIdentityGuid, int branchId = 1, string? guestId = null)
    {
        OrderId = orderId;
        OrderStatus = orderStatus;
        BuyerName = buyerName;
        BuyerIdentityGuid = buyerIdentityGuid;
        BranchId = branchId;
        GuestId = guestId;
    }
}

/// <summary>
/// Order status for cafe orders (copy from Ordering.Domain for integration event deserialization)
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<OrderStatus>))]
public enum OrderStatus
{
    AwaitingValidation = 1,
    Submitted = 2,
    Confirmed = 3,
    Cancelled = 4
}
