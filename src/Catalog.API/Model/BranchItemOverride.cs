namespace Ninja.Catalog.API.Model;

/// <summary>
/// Per-branch override for a catalog item's availability and pricing.
/// If no override row exists for a branch+item combination, the global values apply.
/// </summary>
public class BranchItemOverride
{
    public int Id { get; set; }
    public int BranchId { get; set; }
    public int CatalogItemId { get; set; }
    public CatalogItem CatalogItem { get; set; } = null!;

    /// <summary>
    /// Whether this item is available at this branch
    /// </summary>
    public bool IsAvailable { get; set; } = true;

    /// <summary>
    /// Set by Inventory when a stock item this menu item needs ran out at this
    /// branch, cleared when it is back. Separate from the manual
    /// <see cref="IsAvailable"/> switch so the two never fight: staff can still
    /// mark an item sold out by hand, and marking it available by hand clears
    /// this flag ("we found a box in the back").
    /// </summary>
    public bool IsOutOfStock { get; set; }

    /// <summary>
    /// Branch-specific price override (null = use global price)
    /// </summary>
    public decimal? PriceOverride { get; set; }

    /// <summary>
    /// Branch-specific offer price override (null = use global offer price)
    /// </summary>
    public decimal? OfferPriceOverride { get; set; }

    /// <summary>
    /// Branch-specific offer status override (null = use global)
    /// </summary>
    public bool? IsOnOfferOverride { get; set; }
}
