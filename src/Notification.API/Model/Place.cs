namespace Ninja.Notification.API.Model;

/// <summary>
/// Notification's own copy of a Spaces place, kept up to date from
/// PlaceUpdatedIntegrationEvent — Notification never calls Spaces. What a
/// service request needs to know: what the place is, and so which requests
/// it can take (a controller for a room, a rate change where the tariff has
/// options). No row means the place has never been heard of and the old
/// rule applies (fail-open).
/// </summary>
public class Place
{
    public int PlaceId { get; set; }

    /// <summary>"Room", "Table" or "Station".</summary>
    public string Kind { get; set; } = "Room";

    public LocalizedText Name { get; set; } = new(string.Empty);

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

    public bool TakesControllerRequests => Kind == "Room";
}
