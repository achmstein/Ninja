#nullable enable
namespace Ninja.Ordering.Infrastructure.Projections;

/// <summary>
/// Ordering's own copy of a Spaces place, kept up to date from
/// PlaceUpdatedIntegrationEvent — Ordering never calls Spaces. What an order
/// needs to know: the place exists, what it is called, and whether it takes
/// customers. No row means the place has never been heard of and the order
/// goes through (fail-open), so a fresh deployment never refuses an order
/// for want of an event.
/// </summary>
public class Place
{
    public int PlaceId { get; set; }

    /// <summary>"Room", "Table" or "Station".</summary>
    public string Kind { get; set; } = "Room";

    public LocalizedText Name { get; set; } = new();

    public int BranchId { get; set; }

    public bool IsTimed { get; set; }

    public bool HasOptions { get; set; }

    public bool IsActive { get; set; }

    /// <summary>
    /// LEGACY(places): resolves an old room id to its place — remove when the printed room/table stickers are reprinted with /p/{id}.
    /// The id a printed room sticker (/room/{id}) carries.
    /// </summary>
    public int? LegacyRoomId { get; set; }

    /// <summary>
    /// LEGACY(places): resolves an old table id to its place — remove when the printed room/table stickers are reprinted with /p/{id}.
    /// The id a printed table sticker (/table/{id}) carries.
    /// </summary>
    public int? LegacyTableId { get; set; }

    /// <summary>CreationDate of the last event applied — the out-of-order guard.</summary>
    public DateTime UpdatedAt { get; set; }
}
