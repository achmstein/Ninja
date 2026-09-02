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
    List<OrderConfirmedItem> Items,
    /// <summary>
    /// The exact bill the cashier rang this order up against. Last and
    /// optional so events published before the POS could name a ticket still
    /// deserialize; when set it wins over the session/table routing, which has
    /// no way to name a counter tab.
    /// </summary>
    int? TicketId = null,
    /// <summary>
    /// Who the order is for — an account holder, or a name the till was given
    /// for a walk-in. Null when nobody was named.
    /// </summary>
    string? CustomerName = null) : IntegrationEvent;

public record OrderConfirmedItem(
    int ProductId,
    LocalizedText ProductName,
    int Units,
    decimal UnitPrice,
    decimal Discount,
    LocalizedText? CustomizationsDescription);
