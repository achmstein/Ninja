#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// Catalog's answer: every line can be sold, at these prices. When the order
/// carried a promo code, also what it was worth (zero with a reason when it
/// did not apply), judged on Catalog's prices.
/// </summary>
public record OrderValidatedIntegrationEvent(
    int OrderId,
    string? PromoCode = null,
    decimal PromoDiscount = 0,
    string? PromoReason = null) : IntegrationEvent
{
    /// <summary>Each product's menu category, by product id — what routes a line to its kitchen station.</summary>
    public Dictionary<int, int>? Categories { get; init; }

    /// <summary>
    /// Each line's unit price with its options, by line id: the menu's word,
    /// not the app's. Null when the price was not Catalog's to judge (a
    /// Talabat order) or the question came without lines.
    /// </summary>
    public Dictionary<int, decimal>? Prices { get; init; }
}

/// <summary>Catalog's answer: these lines cannot be sold as ordered, and why.</summary>
public record OrderValidationFailedIntegrationEvent(int OrderId, List<OrderValidationFailure> Lines) : IntegrationEvent;

/// <summary>A line Catalog turned down (<see cref="OrderValidationReasons"/>); line id 0 when the question named products only.</summary>
public record OrderValidationFailure(int LineId, int ProductId, string Reason);

/// <summary>Why Catalog turned a line down.</summary>
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
