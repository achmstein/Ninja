#nullable enable
namespace Chillax.Ordering.API.Application.Commands;

using Chillax.Ordering.API.Application.Models;
using Chillax.Ordering.API.Extensions;
using Chillax.Ordering.Domain.Seedwork;

/// <summary>
/// Command to create a new cafe order.
/// Simplified for cafe - no address or payment details.
/// </summary>
[DataContract]
public class CreateOrderCommand : IRequest<bool>
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
    /// Special instructions from customer (optional)
    /// </summary>
    [DataMember]
    public string? CustomerNote { get; private set; }

    /// <summary>
    /// Loyalty points to redeem for this order
    /// </summary>
    [DataMember]
    public int PointsToRedeem { get; private set; }

    /// <summary>
    /// Loyalty discount in currency, computed by the Loyalty API
    /// </summary>
    [DataMember]
    public double LoyaltyDiscount { get; private set; }

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
    /// True when nobody signed in to place this order.
    /// </summary>
    public bool IsGuestOrder => string.IsNullOrWhiteSpace(UserId);

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
        double loyaltyDiscount = 0,
        int? tableId = null,
        LocalizedText? tableName = null,
        string? guestId = null,
        string? guestName = null,
        string? guestPhone = null)
    {
        _orderItems = basketItems.ToOrderItemsDTO().ToList();
        UserId = userId;
        UserName = userName;
        BranchId = branchId;
        RoomName = roomName;
        TableId = tableId;
        TableName = tableName;
        CustomerNote = customerNote;
        PointsToRedeem = pointsToRedeem;
        LoyaltyDiscount = loyaltyDiscount;
        GuestId = guestId;
        GuestName = guestName;
        GuestPhone = guestPhone;
    }
}
