using Ninja.Spaces.Domain.SeedWork;

namespace Ninja.Spaces.API.Application.Queries;

/// <summary>
/// LEGACY(places): TableViewModel, the old /api/tables table shape — remove when every till and customer app is on /api/places and /api/stays.
/// A café table. Also the payload the QR-scan landing page reads.
/// </summary>
public record TableViewModel
{
    /// <summary>
    /// LEGACY(places): the id a printed table sticker carries, in place of the place id — remove when the printed room/table stickers are reprinted with /p/{id}.
    /// The id a printed table sticker carries (/table/{id}); the place id for a table created after the Places remodel.
    /// </summary>
    public int Id { get; init; }
    /// <summary>The Spaces place behind this table: what newer clients send on orders and requests.</summary>
    public int PlaceId { get; init; }
    public LocalizedText Name { get; init; } = new();
    public int BranchId { get; init; }
    public bool IsActive { get; init; }
}
