#nullable enable
namespace Ninja.Inventory.Domain.AggregatesModel.TransferAggregate;

/// <summary>
/// Stock moved from one branch to another, in one go: each line leaves the
/// source at its average cost and arrives at the destination at that same
/// cost, so value travels with the goods. Never edited; a mistake is
/// reversed with a transfer back.
/// </summary>
public class Transfer : Entity, IAggregateRoot
{
    public int FromBranchId { get; private set; }

    public int ToBranchId { get; private set; }

    public string? Note { get; private set; }

    public string SentBy { get; private set; } = string.Empty;

    public DateTime SentAt { get; private set; }

    private readonly List<TransferLine> _lines = new();
    public IReadOnlyCollection<TransferLine> Lines => _lines.AsReadOnly();

    protected Transfer() { }

    public static Transfer Send(int fromBranchId, int toBranchId, string? note, IEnumerable<TransferLine> lines, string sentBy)
    {
        if (fromBranchId == toBranchId)
            throw new InventoryDomainException("A transfer goes to a different branch.");

        var list = lines.ToList();

        if (list.Count == 0)
            throw new InventoryDomainException("A transfer needs at least one line.");

        if (list.GroupBy(l => l.StockItemId).Any(g => g.Count() > 1))
            throw new InventoryDomainException("A transfer lists each stock item once.");

        if (string.IsNullOrWhiteSpace(sentBy))
            throw new InventoryDomainException("A transfer needs whoever sent it.");

        var transfer = new Transfer
        {
            FromBranchId = fromBranchId,
            ToBranchId = toBranchId,
            Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
            SentBy = sentBy,
            SentAt = DateTime.UtcNow,
        };
        transfer._lines.AddRange(list);
        return transfer;
    }
}

public class TransferLine : Entity
{
    public int StockItemId { get; private set; }

    /// <summary>Quantity moved, in the stock item's base unit.</summary>
    public decimal Quantity { get; private set; }

    protected TransferLine() { }

    public TransferLine(int stockItemId, decimal quantity)
    {
        if (stockItemId <= 0)
            throw new InventoryDomainException("A transfer line needs a stock item.");

        if (quantity <= 0)
            throw new InventoryDomainException("A transfer line needs a positive quantity.");

        StockItemId = stockItemId;
        Quantity = quantity;
    }
}

public interface ITransferRepository : IRepository<Transfer>
{
    Transfer Add(Transfer transfer);

    Task<Transfer?> GetAsync(int id);
}
