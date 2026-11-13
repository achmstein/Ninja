#nullable enable
namespace Ninja.Sales.Infrastructure.Projections;

/// <summary>
/// Sales' own copy of a Spaces place, kept up to date from PlaceUpdatedIntegrationEvent — Sales
/// never calls Spaces. What a bill needs to know: what the place is called. A till opening a
/// table's bill names the table by its id, and the name on the bill is read from here, so nobody
/// but Spaces says what a place is called. No row means the place has never been heard of, and the
/// bill is opened without a name rather than refused.
/// </summary>
public class Place
{
    public int PlaceId { get; set; }

    /// <summary>"Room", "Table" or "Station".</summary>
    public string Kind { get; set; } = "Table";

    public LocalizedText Name { get; set; } = new();

    public int BranchId { get; set; }

    /// <summary>CreationDate of the last event applied — the out-of-order guard.</summary>
    public DateTime UpdatedAt { get; set; }
}
