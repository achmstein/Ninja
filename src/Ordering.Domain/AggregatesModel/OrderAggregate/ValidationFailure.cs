namespace Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>
/// A product Catalog would not sell as ordered, and why: one of the reasons
/// below, as Catalog names them.
/// </summary>
public record ValidationFailure(int ProductId, string Reason)
{
    /// <summary>The menu asks more than the app showed: an offer ended or a price went up.</summary>
    public const string PriceChanged = "PriceChanged";

    /// <summary>What a failure from before Catalog gave reasons means: the item was out.</summary>
    public const string Unavailable = "Unavailable";
}
