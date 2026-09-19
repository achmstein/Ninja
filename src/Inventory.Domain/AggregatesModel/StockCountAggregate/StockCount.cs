#nullable enable
namespace Ninja.Inventory.Domain.AggregatesModel.StockCountAggregate;

/// <summary>
/// A physical count at a branch. Each line freezes what the ledger expected
/// beside what was found, so the document is the variance report; the
/// ledger is then corrected by the difference. Counts are how paper drift,
/// waste nobody recorded or a lost bus message, gets fixed.
/// </summary>
public class StockCount : Entity, IAggregateRoot
{
    public int BranchId { get; private set; }

    public string? Note { get; private set; }

    public string CountedBy { get; private set; } = string.Empty;

    public DateTime CountedAt { get; private set; }

    private readonly List<StockCountLine> _lines = new();
    public IReadOnlyCollection<StockCountLine> Lines => _lines.AsReadOnly();

    protected StockCount() { }

    public static StockCount Post(int branchId, string? note, IEnumerable<StockCountLine> lines, string countedBy)
    {
        var list = lines.ToList();

        if (list.Count == 0)
            throw new InventoryDomainException("A count needs at least one line.");

        if (list.GroupBy(l => l.StockItemId).Any(g => g.Count() > 1))
            throw new InventoryDomainException("A count lists each stock item once.");

        if (string.IsNullOrWhiteSpace(countedBy))
            throw new InventoryDomainException("A count needs whoever counted.");

        var count = new StockCount
        {
            BranchId = branchId,
            Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
            CountedBy = countedBy,
            CountedAt = DateTime.UtcNow,
        };
        count._lines.AddRange(list);
        return count;
    }

    /// <summary>The lines whose count differed from the ledger: the ones that post a movement.</summary>
    public IEnumerable<StockCountLine> Differences => _lines.Where(l => l.Variance != 0);
}
