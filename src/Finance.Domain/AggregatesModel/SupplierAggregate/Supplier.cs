#nullable enable
namespace Ninja.Finance.Domain.AggregatesModel.SupplierAggregate;

/// <summary>
/// Someone the café buys from. Inventory keeps only the id on a receipt;
/// the account of what is owed to them lives here, per branch.
/// </summary>
public class Supplier : Entity, IAggregateRoot
{
    public string Name { get; private set; } = string.Empty;

    public string? Phone { get; private set; }

    public string? Notes { get; private set; }

    public bool IsActive { get; private set; } = true;

    protected Supplier() { }

    public Supplier(string name, string? phone, string? notes)
    {
        Update(name, phone, notes, true);
    }

    public void Update(string name, string? phone, string? notes, bool isActive)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new FinanceDomainException("A supplier needs a name.");

        Name = name.Trim();
        Phone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        IsActive = isActive;
    }
}

/// <summary>
/// A line on a supplier's account. An invoice is a delivery received (from
/// Inventory's receipt, or keyed in); a payment is money handed to them;
/// a credit is a return or a discount. Balance = what the café owes.
/// </summary>
public enum SupplierEntryType
{
    Invoice = 0,
    Payment = 1,
    Credit = 2,
}

public class SupplierEntry : Entity, IAggregateRoot
{
    public int SupplierId { get; private set; }

    public int BranchId { get; private set; }

    public SupplierEntryType Type { get; private set; }

    /// <summary>Always positive; the type says which way it goes.</summary>
    public decimal Amount { get; private set; }

    public DateOnly Date { get; private set; }

    public string? Note { get; private set; }

    /// <summary>What produced it (purchase:{id}, shift:{id}:movement:{id}); unique, so nothing posts twice.</summary>
    public string? Reference { get; private set; }

    public ExpenseAggregate.FinanceSource Source { get; private set; }

    public string RecordedBy { get; private set; } = string.Empty;

    public DateTime RecordedAt { get; private set; }

    protected SupplierEntry() { }

    public SupplierEntry(int supplierId, int branchId, SupplierEntryType type, decimal amount, DateOnly date, string? note, string recordedBy,
        ExpenseAggregate.FinanceSource source = ExpenseAggregate.FinanceSource.Manual, string? reference = null)
    {
        if (supplierId <= 0)
            throw new FinanceDomainException("A supplier line needs the supplier.");

        if (branchId <= 0)
            throw new FinanceDomainException("A supplier line needs the branch.");

        if (amount <= 0)
            throw new FinanceDomainException("A supplier line needs a positive amount.");

        SupplierId = supplierId;
        BranchId = branchId;
        Type = type;
        Amount = amount;
        Date = date;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        Reference = reference;
        Source = source;
        RecordedBy = recordedBy;
        RecordedAt = DateTime.UtcNow;
    }

    /// <summary>The line's effect on what the café owes: an invoice raises it, the rest lower it.</summary>
    public decimal Signed => Type == SupplierEntryType.Invoice ? Amount : -Amount;
}

public interface ISupplierRepository : IRepository<Supplier>
{
    Supplier Add(Supplier supplier);

    Task<Supplier?> GetAsync(int id);

    Task<List<Supplier>> GetAllAsync();

    SupplierEntry AddEntry(SupplierEntry entry);

    Task<SupplierEntry?> FindEntryByReferenceAsync(string reference);
}
