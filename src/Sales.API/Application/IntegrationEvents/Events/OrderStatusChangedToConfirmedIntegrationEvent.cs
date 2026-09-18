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
    // LEGACY(places): the old RoomName, superseded by PlaceName — remove when every till and customer app is on /api/places and /api/stays.
    LocalizedText? RoomName,
    decimal OrderTotal,
    int PointsToRedeem,
    string? GuestId,
    int BranchId,
    int? SessionId,
    // LEGACY(places): the old RoomId/TableId/TableName, superseded by PlaceId/PlaceName — remove when every till and customer app is on /api/places and /api/stays.
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
    string? CustomerName = null,
    /// <summary>
    /// The Spaces place the order is for, as newer Ordering builds send it
    /// alongside the older RoomId/TableId. Null from older publishers.
    /// </summary>
    int? PlaceId = null,
    string? PlaceKind = null,
    LocalizedText? PlaceName = null,
    /// <summary>The promo code the customer redeemed in the app, and what it took off; null and zero when none.</summary>
    string? PromoCode = null,
    decimal PromoDiscount = 0) : IntegrationEvent;

public record OrderConfirmedItem(
    int ProductId,
    LocalizedText ProductName,
    int Units,
    decimal UnitPrice,
    decimal Discount,
    LocalizedText? CustomizationsDescription);
