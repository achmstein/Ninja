#nullable enable
using Chillax.EventBus.Events;

namespace Chillax.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Ordering publishes when an order is confirmed.
/// Carries the full line breakdown and destination, so the ticket is assembled
/// without ever calling Ordering back.
/// </summary>
public record OrderStatusChangedToConfirmedIntegrationEvent(
    int OrderId,
    string BuyerName,
    string BuyerIdentityGuid,
    LocalizedText? RoomName,
    decimal OrderTotal,
    int PointsToRedeem,
    string? GuestId,
    int BranchId,
    int? SessionId,
    int? RoomId,
    int? TableId,
    LocalizedText? TableName,
    string Source,
    string? GuestPhone,
    double LoyaltyDiscount,
    List<OrderConfirmedItem> Items) : IntegrationEvent;

public record OrderConfirmedItem(
    int ProductId,
    LocalizedText ProductName,
    int Units,
    decimal UnitPrice,
    decimal Discount,
    LocalizedText? CustomizationsDescription);
