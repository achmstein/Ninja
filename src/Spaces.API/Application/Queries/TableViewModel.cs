using Chillax.Spaces.Domain.SeedWork;

namespace Chillax.Spaces.API.Application.Queries;

/// <summary>
/// A café table. Also the payload the QR-scan landing page reads.
/// </summary>
public record TableViewModel
{
    /// <summary>The id a printed table sticker carries (/table/{id}); the place id for a table created after the Places remodel.</summary>
    public int Id { get; init; }
    /// <summary>The Spaces place behind this table: what newer clients send on orders and requests.</summary>
    public int PlaceId { get; init; }
    public LocalizedText Name { get; init; } = new();
    public int BranchId { get; init; }
    public bool IsActive { get; init; }
}
