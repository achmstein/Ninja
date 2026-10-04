using System.Text.Json.Serialization;

namespace Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>
/// What becomes of the stock a confirmed order took, once it will never be
/// sold: written off when the food was made, back on the shelf when it was not.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum StockDisposition
{
    /// <summary>The food was made: its ingredients are waste, not a sale.</summary>
    Waste = 1,

    /// <summary>Nothing was made: its ingredients go back on the shelf.</summary>
    Restock = 2,
}

/// <summary>Why a confirmed order's stock was let go.</summary>
public enum StockReleaseReason
{
    /// <summary>The till cancelled it (a delivery that could not be handed over, or came back).</summary>
    Cancelled = 1,

    /// <summary>Its open bill was voided.</summary>
    Voided = 2,

    /// <summary>The delivery platform cancelled it after the business had accepted it.</summary>
    PlatformCancelled = 3,
}
