#nullable enable
namespace Ninja.Payroll.Domain.AggregatesModel.LedgerAggregate;

/// <summary>
/// One line of what the café owes an employee or has given them. Append
/// only; the balance is the sum. An advance is money already handed over,
/// so it lowers what is due without anyone doing arithmetic.
/// </summary>
public class LedgerEntry : Entity, IAggregateRoot
{
    public int EmployeeId { get; private set; }

    public LedgerEntryType Type { get; private set; }

    /// <summary>Always positive; the type says which way it goes.</summary>
    public decimal Amount { get; private set; }

    /// <summary>The day the line belongs to: the advance was handed over, the period ended.</summary>
    public DateOnly Date { get; private set; }

    public string? Note { get; private set; }

    /// <summary>What produced it (payslip:{id}, shift:{id}:movement:{id}); unique, so nothing posts twice.</summary>
    public string? Reference { get; private set; }

    public LedgerSource Source { get; private set; }

    public string RecordedBy { get; private set; } = string.Empty;

    public DateTime RecordedAt { get; private set; }

    protected LedgerEntry() { }

    public LedgerEntry(int employeeId, LedgerEntryType type, decimal amount, DateOnly date, string? note, string recordedBy,
        LedgerSource source = LedgerSource.Manual, string? reference = null)
    {
        if (employeeId <= 0)
            throw new PayrollDomainException("A ledger line needs the employee it is for.");

        if (amount <= 0)
            throw new PayrollDomainException("A ledger line needs a positive amount.");

        EmployeeId = employeeId;
        Type = type;
        Amount = amount;
        Date = date;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        Reference = reference;
        Source = source;
        RecordedBy = recordedBy;
        RecordedAt = DateTime.UtcNow;
    }

    public static bool Credits(LedgerEntryType type) => type is LedgerEntryType.Earned or LedgerEntryType.Bonus;

    /// <summary>The line's effect on the balance: what the café owes goes up or down.</summary>
    public decimal Signed => Credits(Type) ? Amount : -Amount;
}
