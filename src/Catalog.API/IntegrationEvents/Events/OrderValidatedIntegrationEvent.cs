namespace Ninja.Catalog.API.IntegrationEvents.Events;

/// <summary>
/// Every line of the order can be sold, at the menu's prices. When the order
/// carried a promo code, this also says what it was worth on those prices:
/// the code as redeemed and its discount, or the code and why it gave
/// nothing. An invalid code never fails an order.
/// </summary>
public record OrderValidatedIntegrationEvent(
    int OrderId,
    string? PromoCode = null,
    decimal PromoDiscount = 0,
    string? PromoReason = null) : IntegrationEvent
{
    /// <summary>
    /// Each product's menu category, by product id: what sends a line to its
    /// kitchen station. Catalog's word, so a client cannot route a line.
    /// </summary>
    public Dictionary<int, int>? Categories { get; init; }

    /// <summary>
    /// Each line's unit price with its options, by line id: Catalog's word,
    /// so a client cannot price a line. Null when the price was not the
    /// menu's to judge, or the question named products only.
    /// </summary>
    public Dictionary<int, decimal>? Prices { get; init; }
}

/// <summary>Lines of the order that cannot be sold as ordered, and why.</summary>
public record OrderValidationFailedIntegrationEvent(int OrderId, List<OrderValidationFailure> Lines) : IntegrationEvent;

/// <summary>A line turned down (<see cref="OrderValidationReasons"/>); line id 0 when the question named products only.</summary>
public record OrderValidationFailure(int LineId, int ProductId, string Reason);

/// <summary>Why a line was turned down.</summary>
public static class OrderValidationReasons
{
    /// <summary>No such item on the menu.</summary>
    public const string UnknownItem = "UnknownItem";

    /// <summary>The item is off, everywhere or at this branch.</summary>
    public const string Unavailable = "Unavailable";

    /// <summary>An option that is not one of this item's.</summary>
    public const string UnknownOption = "UnknownOption";

    /// <summary>An option this branch ran out of.</summary>
    public const string OptionUnavailable = "OptionUnavailable";

    /// <summary>The menu asks more than the app showed: an offer ended or a price went up.</summary>
    public const string PriceChanged = "PriceChanged";
}
