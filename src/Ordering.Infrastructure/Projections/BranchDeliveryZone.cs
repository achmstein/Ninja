#nullable enable
namespace Ninja.Ordering.Infrastructure.Projections;

/// <summary>
/// Ordering's own copy of one of a branch's named delivery areas ("Maadi Degla, 25"), kept from
/// Tenant.API's BranchDeliveryZonesChangedIntegrationEvent, which carries a branch's whole list:
/// its rows are replaced together. Beside <see cref="BranchSettings"/>, which holds the branch's
/// own reach and fee: an area only says what is different there.
/// </summary>
public class BranchDeliveryZone
{
    /// <summary>Tenant.API's id: an order placed there points at it.</summary>
    public int Id { get; set; }

    public int BranchId { get; set; }

    public string? NameEn { get; set; }

    public string? NameAr { get; set; }

    public decimal Fee { get; set; }

    /// <summary>Null for the branch's own minimum.</summary>
    public decimal? MinimumOrder { get; set; }

    public int? EtaMinutes { get; set; }

    public bool IsOn { get; set; } = true;

    /// <summary>The area on the map, [lat, lng] points round it; null when it is only a name.</summary>
    public double[][]? Shape { get; set; }

    /// <summary>Its place in the owner's list: where two shapes overlap, the earlier one is the area.</summary>
    public int SortOrder { get; set; }

    /// <summary>The list's version (ticks, UTC) this row came with: an older list never replaces a newer one.</summary>
    public long Version { get; set; }
}
