using System.Text.Json.Serialization;
using Ninja.EventBus.Events;

namespace Ninja.Notification.API.IntegrationEvents.Events;

public record OrderStatusChangedToSubmittedIntegrationEvent : IntegrationEvent
{
    public int OrderId { get; }
    public OrderStatus OrderStatus { get; }
    public string BuyerName { get; }
    public string BuyerIdentityGuid { get; }
    public int BranchId { get; }

    /// <summary>Set instead of BuyerIdentityGuid when a guest placed the order.</summary>
    public string? GuestId { get; }

    /// <summary>Where the order came from (Customer, Guest, Pos, Talabat); absent from an older Ordering.</summary>
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

/// <summary>
/// Order status (copy from Ordering.Domain for integration event deserialization)
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<OrderStatus>))]
public enum OrderStatus
{
    AwaitingValidation = 1,
    Submitted = 2,
    Confirmed = 3,
    Cancelled = 4
}
