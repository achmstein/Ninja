using System.Text.Json.Serialization;

namespace Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

/// <summary>
/// Whether an order line was added because the business suggested it ("goes
/// well with"), and where, as Ordering recorded it: what the owner reads to
/// see what suggestions sell. Every manual and session line is <see cref="None"/>.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<SuggestionSource>))]
public enum SuggestionSource
{
    None = 0,

    /// <summary>An item's "goes well with" row in the customer app.</summary>
    Pairing = 1,

    /// <summary>The suggestion the customer app's cart shows.</summary>
    CartNudge = 2,

    /// <summary>The suggestions the till shows after an item.</summary>
    Till = 3,
}
