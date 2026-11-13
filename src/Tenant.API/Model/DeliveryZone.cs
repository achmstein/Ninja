namespace Ninja.Tenant.API.Model;

/// <summary>
/// A named area a branch delivers to, as people here say where they live ("Maadi Degla"): what a
/// call-centre agent picks when a caller says it, with its own fee. The branch's own reach (a radius
/// or the one shape drawn for it) and its own fee stay the default: an area only says what is
/// different there. When its shape is drawn on the map, a customer's pin inside it gets these terms
/// too; without one it is picked by name, by staff.
/// </summary>
/// <remarks>Called a zone in code: "area" already names the branch's one drawn reach (Branch.DeliveryArea).</remarks>
public class DeliveryZone
{
    public int Id { get; set; }

    public int BranchId { get; set; }

    /// <summary>What it is called, in the business's languages.</summary>
    public LocalizedText Name { get; set; } = new();

    /// <summary>The delivery fee there, in place of the branch's.</summary>
    public decimal Fee { get; set; }

    /// <summary>The least an order there must come to; null for the branch's own minimum.</summary>
    public decimal? MinimumOrder { get; set; }

    /// <summary>About how many minutes a delivery there takes, said to the caller and the customer; null for unsaid.</summary>
    public int? EtaMinutes { get; set; }

    /// <summary>Off for a while (rain, no riders) without losing it: customers there are told, the till is asked twice.</summary>
    public bool IsOn { get; set; } = true;

    /// <summary>
    /// The area on the map: a ring of [lat, lng] points, held to the same rules as the branch's own
    /// (DeliveryAreaRules), one JSON document; null when it is only a name.
    /// </summary>
    public double[][]? Shape { get; set; }

    /// <summary>Its place in the owner's list: where two shapes overlap, the earlier one is the area.</summary>
    public int SortOrder { get; set; }
}
