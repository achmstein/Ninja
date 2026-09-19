#nullable enable
namespace Ninja.Inventory.Domain.AggregatesModel.LedgerAggregate;

/// <summary>
/// The last thing Catalog was told about a menu item at a branch: in stock
/// or not. Kept so a restock of one ingredient does not announce "back in
/// stock" while another is still out, and so every movement does not
/// re-announce the same state. Absent means in stock, which is what Catalog
/// assumes too.
/// </summary>
public class MenuItemStockStatus
{
    public int BranchId { get; private set; }

    public int CatalogItemId { get; private set; }

    public bool InStock { get; private set; } = true;

    public DateTime ChangedAt { get; private set; }

    protected MenuItemStockStatus() { }

    public MenuItemStockStatus(int branchId, int catalogItemId)
    {
        BranchId = branchId;
        CatalogItemId = catalogItemId;
        ChangedAt = DateTime.UtcNow;
    }
}
