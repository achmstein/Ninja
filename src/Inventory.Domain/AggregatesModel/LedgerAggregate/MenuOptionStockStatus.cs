#nullable enable
namespace Chillax.Inventory.Domain.AggregatesModel.LedgerAggregate;

/// <summary>
/// The last thing Catalog was told about a customization option at a
/// branch: the <see cref="MenuItemStockStatus"/> of option recipe lines.
/// A roast whose beans ran out is announced once, and announced back once.
/// </summary>
public class MenuOptionStockStatus
{
    public int BranchId { get; private set; }

    public int OptionId { get; private set; }

    public bool InStock { get; private set; } = true;

    public DateTime ChangedAt { get; private set; }

    protected MenuOptionStockStatus() { }

    public MenuOptionStockStatus(int branchId, int optionId)
    {
        BranchId = branchId;
        OptionId = optionId;
        ChangedAt = DateTime.UtcNow;
    }
}
