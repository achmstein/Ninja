#nullable enable
using System.Text.RegularExpressions;
using Ninja.ServiceDefaults;
using Microsoft.AspNetCore.Http.HttpResults;
using Ninja;
using Ninja.Ordering.Domain.Seedwork;
using Order = Ninja.Ordering.API.Application.Queries.Order;

/// <summary>
/// Request model for creating a business order.
/// </summary>
/// <param name="UserId">
/// Ignored. The customer is identified by their access token, or as a guest by
/// the X-Guest-Id header. Kept so existing clients keep compiling.
/// </param>
/// <param name="LoyaltyDiscount">
/// Ignored. The discount is computed server-side from <paramref name="PointsToRedeem"/>
/// at the fixed redemption rate. Kept so existing clients keep compiling.
/// </param>
/// <param name="GuestName">Required when ordering without an account.</param>
/// <param name="GuestPhone">Required when ordering without an account, so staff can reach them.</param>
/// <param name="SessionId">The active stay the order belongs to, when ordering from a timed place.</param>
/// <param name="PlaceId">The Spaces place the order goes to; null for an order-ahead.</param>
public record CreateOrderRequest(
    string UserId,
    string UserName,
    string? CustomerNote,
    int PointsToRedeem,
    double LoyaltyDiscount,
    List<BasketItem> Items,
    string? GuestName = null,
    string? GuestPhone = null,
    int? SessionId = null,
    int? PlaceId = null,
    string? PlaceKind = null,
    LocalizedText? PlaceName = null,
    /// <summary>A promo code typed at checkout; quoted by Catalog beforehand, redeemed when the items check out.</summary>
    string? PromoCode = null,
    /// <summary>Deliver it with the branch's own rider, to this address; null to eat in or collect.</summary>
    DeliveryRequest? Delivery = null);

/// <summary>
/// Where a delivery goes: the pin on the map and the words that find the door.
/// The fee and whether the branch goes that far are the server's to say.
/// </summary>
/// <param name="Phone">The number the rider calls at the door; a guest's checkout phone when left out.</param>
public record DeliveryRequest(
    double Latitude,
    double Longitude,
    string Address,
    string? Building = null,
    string? Floor = null,
    string? Apartment = null,
    string? Directions = null,
    string? Phone = null);

/// <summary>
/// Request model for a counter sale keyed in at the POS. The cashier is the
/// authenticated caller; the customer is optional and only named so the sale
/// can accrue loyalty and appear in their history.
/// </summary>
/// <param name="CustomerUserId">Attach the sale to a customer account (optional).</param>
/// <param name="CustomerUserName">Display name for <paramref name="CustomerUserId"/>.</param>
public record PosOrderRequest(
    List<BasketItem> Items,
    string? CustomerNote = null,
    string? CustomerUserId = null,
    string? CustomerUserName = null,
    int PointsToRedeem = 0,
    int? TicketId = null,
    string? CustomerName = null,
    /// <summary>
    /// When the sale actually happened, for a till replaying what it rang
    /// up while offline. Dates the order then instead of now.
    /// </summary>
    DateTime? PlacedAt = null,
    /// <summary>The Spaces place the order goes to; null for a counter sale.</summary>
    int? PlaceId = null,
    string? PlaceKind = null,
    LocalizedText? PlaceName = null,
    /// <summary>
    /// The customer already left with the items: the order lands confirmed
    /// straight away, with no stock check and nothing for the kitchen to
    /// accept. Takes <see cref="PlacedAt"/>.
    /// </summary>
    bool Replay = false,
    /// <summary>A delivery the till took over the phone; it lands on a bill of its own, settled when the rider's cash comes in.</summary>
    PosDeliveryRequest? Delivery = null);

/// <summary>
/// Where a delivery the till took over the phone goes: the address in the
/// customer's words, and a pin only when they sent one (a shared location).
/// Without one the rider finds the door by the words and the phone.
/// </summary>
/// <param name="Phone">The number the rider calls at the door.</param>
/// <param name="Latitude">With <paramref name="Longitude"/>, the pin; both or neither.</param>
public record PosDeliveryRequest(
    string Address,
    string Phone,
    double? Latitude = null,
    double? Longitude = null,
    string? Building = null,
    string? Floor = null,
    string? Apartment = null,
    string? Directions = null);

/// <summary>
/// The created order's id — what the POS uses to find the ticket the order
/// lands on. 0 when the request was a deduplicated retry.
/// </summary>
public record PosOrderResponse(int OrderId);

/// <summary>
/// Request model for putting a customer on an order after the fact.
/// </summary>
/// <param name="CustomerUserId">The customer's account, when they have one; null for a bare name.</param>
/// <param name="CustomerName">Who the order is for — shown on the bill line either way.</param>
public record AssignOrderCustomerRequest(
    string? CustomerUserId,
    string CustomerName);

/// <param name="GuestId">The X-Guest-Id the device ordered under before signing in.</param>
public record ClaimGuestOrdersRequest(string GuestId);

/// <param name="Claimed">How many orders became the account's on this call.</param>
public record ClaimGuestOrdersResponse(int Claimed);

/// <summary>
/// Request model for rating an order
/// </summary>
public record RateOrderRequest(
    int RatingValue,
    string? Comment);

/// <summary>
/// Request model for the kitchen display's one move.
/// </summary>
/// <param name="Ready">True when the order is done, false to bring a ready order back to the board.</param>
public record SetOrderReadyRequest(bool Ready);
