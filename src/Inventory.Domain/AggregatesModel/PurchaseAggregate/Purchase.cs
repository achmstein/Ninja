#nullable enable
namespace Chillax.Inventory.Domain.AggregatesModel.PurchaseAggregate;

/// <summary>
/// Stock received into a branch: who it came from, what it cost, line by
/// line. Posted in one go and never edited; a mistake is fixed with an
/// adjustment, the way every Chillax document works. Its id is its number.
/// </summary>
public class Purchase : Entity, IAggregateRoot
{
    public int BranchId { get; private set; }

    public string? Supplier { get; private set; }

    public string? InvoiceRef { get; private set; }

    public string ReceivedBy { get; private set; } = string.Empty;

    public DateTime ReceivedAt { get; private set; }

    private readonly List<PurchaseLine> _lines = new();
    public IReadOnlyCollection<PurchaseLine> Lines => _lines.AsReadOnly();

    public decimal Total => _lines.Sum(l => l.Total);

    protected Purchase() { }

    public static Purchase Receive(int branchId, string? supplier, string? invoiceRef, IEnumerable<PurchaseLine> lines, string receivedBy)
    {
        var list = lines.ToList();

        if (list.Count == 0)
            throw new InventoryDomainException("A receipt needs at least one line.");

        if (list.GroupBy(l => l.StockItemId).Any(g => g.Count() > 1))
            throw new InventoryDomainException("A receipt lists each stock item once.");

        if (string.IsNullOrWhiteSpace(receivedBy))
            throw new InventoryDomainException("A receipt needs whoever received it.");

        var purchase = new Purchase
        {
            BranchId = branchId,
            Supplier = string.IsNullOrWhiteSpace(supplier) ? null : supplier.Trim(),
            InvoiceRef = string.IsNullOrWhiteSpace(invoiceRef) ? null : invoiceRef.Trim(),
            ReceivedBy = receivedBy,
            ReceivedAt = DateTime.UtcNow,
        };
        purchase._lines.AddRange(list);
        return purchase;
    }
}
