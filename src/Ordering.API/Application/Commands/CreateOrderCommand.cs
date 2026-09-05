#nullable enable
namespace Chillax.Ordering.API.Application.Commands;

using Chillax.Ordering.API.Application.Models;
using Chillax.Ordering.API.Extensions;
using Chillax.Ordering.Domain.Seedwork;

/// <summary>
/// Command to create a new cafe order.
/// Simplified for cafe - no address or payment details.
/// Returns the new order's id, or 0 for a deduplicated retry (the original
/// id isn't recorded against the request id — callers treat 0 as "already
/// placed" and fall back to looking the order up).
/// </summary>
[DataContract]
public class CreateOrderCommand : IRequest<int>
{
    [DataMember]
    private readonly List<OrderItemDTO> _orderItems;

    [DataMember]
    public string UserId { get; private set; } = string.Empty;

    [DataMember]
    public string UserName { get; private set; } = string.Empty;

    /// <summary>
    /// Room name for the session (e.g., "VIP") - localized
    /// </summary>
    [DataMember]
    public LocalizedText? RoomName { get; private set; }

    /// <summary>
    /// The Spaces session this order belongs to, when ordered from a room
    /// </summary>
    [DataMember]
    public int? SessionId { get; private set; }

    /// <summary>
    /// The room behind <see cref="SessionId"/>
    /// </summary>
    [DataMember]
    public int? RoomId { get; private set; }

    /// <summary>
    /// Café table the order is delivered to, when the customer is not in a room
    /// </summary>
    [DataMember]
    public int? TableId { get; private set; }

    /// <summary>
    /// Table name (e.g., "Table 3") - localized
    /// </summary>
    [DataMember]
    public LocalizedText? TableName { get; private set; }

    /// <summary>
    /// The already-open Sales ticket this order belongs on, when a cashier
    /// added items to a bill instead of ringing up a fresh walk-in sale
    /// </summary>
    [DataMember]
    public int? TicketId { get; private set; }

    /// <summary>
    /// Special instructions from customer (optional)
    /// </summary>
    [DataMember]
    public string? CustomerNote { get; private set; }

    /// <summary>
    /// Loyalty points to redeem for this order. The discount they buy is
    /// computed server-side from the fixed redemption rate — never taken
    /// from the request.
    /// </summary>
    [DataMember]
    public int PointsToRedeem { get; private set; }

    /// <summary>
    /// The branch this order is placed at
    /// </summary>
    [DataMember]
    public int BranchId { get; private set; }

    /// <summary>
    /// Device id of a customer ordering without an account. Set only when
    /// <see cref="UserId"/> is empty.
    /// </summary>
    [DataMember]
    public string? GuestId { get; private set; }

    /// <summary>
    /// Name a guest left at checkout
    /// </summary>
    [DataMember]
    public string? GuestName { get; private set; }

    /// <summary>
    /// Phone number a guest left at checkout
    /// </summary>
    [DataMember]
    public string? GuestPhone { get; private set; }

    [DataMember]
    public IEnumerable<OrderItemDTO> OrderItems => _orderItems;

    /// <summary>
    /// When the sale actually happened, for a till replaying what it rang up
    /// while offline; null dates the order now
    /// </summary>
    [DataMember]
    public DateTime? PlacedAt { get; private set; }

    /// <summary>
    /// The customer already left with the items: confirm on creation, with
    /// no stock check and nothing for the kitchen to accept
    /// </summary>
    [DataMember]
    public bool Replay { get; private set; }

    /// <summary>
    /// Who is placing the order. Derived from the identity unless the caller
    /// (the POS path) says otherwise; never bound from a request body.
    /// </summary>
    [DataMember]
    public OrderSource Source { get; private set; }

    /// <summary>
    /// True when nobody signed in to place this order and it isn't a counter
    /// sale keyed in by staff.
    /// </summary>
    public bool IsGuestOrder => Source == OrderSource.Guest;

    /// <summary>
    /// Whether the order says where it goes. Mirrors Order.HasDestination —
    /// the aggregate is the one that enforces it.
    /// </summary>
    public bool HasDestination => RoomName is not null || TableId.HasValue;

    public CreateOrderCommand()
    {
        _orderItems = new List<OrderItemDTO>();
    }

    public CreateOrderCommand(
        List<BasketItem> basketItems,
        string userId,
        string userName,
        int branchId,
        LocalizedText? roomName = null,
        string? customerNote = null,
        int pointsToRedeem = 0,
        int? tableId = null,
        LocalizedText? tableName = null,
        string? guestId = null,
        string? guestName = null,
        string? guestPhone = null,
        OrderSource? source = null,
        int? sessionId = null,
        int? roomId = null,
        int? ticketId = null,
        DateTime? placedAt = null,
        bool replay = false)
    {
        _orderItems = basketItems.ToOrderItemsDTO().ToList();
        PlacedAt = placedAt;
        Replay = replay;
        UserId = userId;
        UserName = userName;
        BranchId = branchId;
        RoomName = roomName;
        SessionId = sessionId;
        RoomId = roomId;
        TableId = tableId;
        TableName = tableName;
        TicketId = ticketId;
        CustomerNote = customerNote;
        PointsToRedeem = pointsToRedeem;
        GuestId = guestId;
        GuestName = guestName;
        GuestPhone = guestPhone;
        Source = source ?? (string.IsNullOrWhiteSpace(userId) ? OrderSource.Guest : OrderSource.Customer);
    }
}
