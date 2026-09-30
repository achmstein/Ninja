using System.Text.Json.Serialization;

namespace Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>
/// Whether a line was added because the business suggested it ("goes well
/// with"), and where: what lets the owner see what suggestions sell. Says
/// nothing about who ordered (that is the order's <see cref="OrderSource"/>).
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum SuggestionSource
{
    /// <summary>Picked from the menu like any other line.</summary>
    None = 0,

    /// <summary>Added from an item's "goes well with" row in the customer app.</summary>
    Pairing = 1,

    /// <summary>Added from the one suggestion the customer app's cart shows.</summary>
    CartNudge = 2,

    /// <summary>Rung up at the till from the suggestions shown after an item.</summary>
    Till = 3,
}
