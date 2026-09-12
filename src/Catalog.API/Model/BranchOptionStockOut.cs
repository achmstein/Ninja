namespace Chillax.Catalog.API.Model;

/// <summary>
/// A customization option Inventory has marked out of stock at a branch (its
/// ingredient ran out). A row present = sold out there; the row is removed
/// when the ingredient is back. Nothing to do with the option's global shape,
/// so it lives beside <see cref="BranchItemOverride"/> rather than on the option.
/// </summary>
public class BranchOptionStockOut
{
    public int Id { get; set; }
    public int BranchId { get; set; }
    public int CustomizationOptionId { get; set; }
    public CustomizationOption CustomizationOption { get; set; } = null!;
}
