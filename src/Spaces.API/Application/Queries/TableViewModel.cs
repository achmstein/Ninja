using Chillax.Spaces.Domain.SeedWork;

namespace Chillax.Spaces.API.Application.Queries;

/// <summary>
/// A café table. Also the payload the QR-scan landing page reads.
/// </summary>
public record TableViewModel
{
    public int Id { get; init; }
    public LocalizedText Name { get; init; } = new();
    public int BranchId { get; init; }
    public bool IsActive { get; init; }
}
