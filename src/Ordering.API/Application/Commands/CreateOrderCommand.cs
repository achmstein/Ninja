#nullable enable
namespace Ninja.Ordering.API.Application.Commands;

using Ninja.Ordering.API.Application.Models;
using Ninja.Ordering.API.Extensions;
using Ninja.Ordering.Domain.Seedwork;

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

    /// <summary>The Spaces place the order goes to, when the client named one.</summary>
    [DataMember]
    public int? PlaceId { get; private set; }

    [DataMember]
    public string? PlaceKind { get; private set; }

    [DataMember]
    public LocalizedText? PlaceName { get; private set; }

    /// <summary>
    /// The Spaces stay this order belongs to, when ordered from a timed place with its clock running
    /// </summary>
    [DataMember]
    public int? SessionId { get; private set; }

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
    /// <summary>A promo code typed at checkout in the customer app; the till never sends one.</summary>
    [DataMember]
    public string? PromoCode { get; private set; }

    /// <summary>
    /// True when nobody signed in to place this order and it isn't a counter
    /// sale keyed in by staff.
    /// </summary>
    public bool IsGuestOrder => Source == OrderSource.Guest;

    /// <summary>
    /// Whether the order says where it goes. Mirrors Order.HasDestination —
    /// the aggregate is the one that enforces it.
    /// </summary>
    public bool HasDestination => PlaceId.HasValue;

    public CreateOrderCommand()
    {
        _orderItems = new List<OrderItemDTO>();
    }

    public CreateOrderCommand(
        List<BasketItem> basketItems,
        string userId,
        string userName,
        int branchId,
        string? customerNote = null,
        int pointsToRedeem = 0,
        string? guestId = null,
        string? guestName = null,
        string? guestPhone = null,
        OrderSource? source = null,
        int? sessionId = null,
        int? ticketId = null,
        DateTime? placedAt = null,
        bool replay = false,
        int? placeId = null,
        string? placeKind = null,
        LocalizedText? placeName = null,
        string? promoCode = null)
    {
        _orderItems = basketItems.ToOrderItemsDTO().ToList();
        PromoCode = string.IsNullOrWhiteSpace(promoCode) ? null : promoCode.Trim();
        PlaceId = placeId;
        PlaceKind = placeKind;
        PlaceName = placeName;
        PlacedAt = placedAt;
        Replay = replay;
        UserId = userId;
        UserName = userName;
        BranchId = branchId;
        SessionId = sessionId;
        TicketId = ticketId;
        CustomerNote = customerNote;
        PointsToRedeem = pointsToRedeem;
        GuestId = guestId;
        GuestName = guestName;
        GuestPhone = guestPhone;
        Source = source ?? (string.IsNullOrWhiteSpace(userId) ? OrderSource.Guest : OrderSource.Customer);
    }
}
