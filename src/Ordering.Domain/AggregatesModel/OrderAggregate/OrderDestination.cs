#nullable enable
namespace Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>
/// Where an order goes: the Spaces place (room, table, station) and, when a
/// clock is running there, the stay whose bill it joins. All null for an
/// order-ahead or a counter sale.
/// </summary>
public record OrderDestination(int? PlaceId, string? PlaceKind, LocalizedText? PlaceName, int? SessionId)
{
    public bool IsSet => PlaceId is not null;
}
