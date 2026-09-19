namespace Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;

/// <summary>
/// What a place is, for icons and words. What it *does* comes from its
/// tariff, not its kind: a table with a tariff runs a timer like a room, a
/// station is a room without a console. Adding a kind is one enum member.
/// </summary>
public enum PlaceKind
{
    /// <summary>A PlayStation room: timed, with a rate option per player mode.</summary>
    Room = 1,

    /// <summary>A café table: takes orders; timed only when it carries a tariff.</summary>
    Table = 2,

    /// <summary>A game station (pool, ping pong): timed, usually one rate.</summary>
    Station = 3,
}
