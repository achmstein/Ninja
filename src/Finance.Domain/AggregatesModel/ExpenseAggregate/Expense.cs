#nullable enable
namespace Ninja.Finance.Domain.AggregatesModel.ExpenseAggregate;

/// <summary>
/// Money spent on something that is neither stock nor staff: rent, a
/// bill, a repair, an ad. Append only; a mistake is voided with a reason
/// and entered again, so the month's total is always explainable. Money a
/// partner paid from their own pocket is an expense here and a
/// contribution on their account.
/// </summary>
public class Expense : Entity, IAggregateRoot
{
    public int BranchId { get; private set; }

    /// <summary>The business day it belongs to.</summary>
    public DateOnly Date { get; private set; }

    public int CategoryId { get; private set; }

    public decimal Amount { get; private set; }

    public PaidFrom PaidFrom { get; private set; }

    /// <summary>The partner whose own money paid it, when <see cref="PaidFrom"/> is Partner.</summary>
    public int? PartnerId { get; private set; }

    public string? Vendor { get; private set; }

    public string? Note { get; private set; }

    /// <summary>What produced it (shift:{id}:movement:{id}); unique, so nothing posts twice.</summary>
    public string? Reference { get; private set; }

    public FinanceSource Source { get; private set; }

    public string RecordedBy { get; private set; } = string.Empty;

    public DateTime RecordedAt { get; private set; }

    public DateTime? VoidedAt { get; private set; }

    public string? VoidedBy { get; private set; }

    public string? VoidReason { get; private set; }

    public bool IsVoided => VoidedAt is not null;

    protected Expense() { }

    public Expense(int branchId, DateOnly date, int categoryId, decimal amount, PaidFrom paidFrom, int? partnerId,
        string? vendor, string? note, string recordedBy, FinanceSource source = FinanceSource.Manual, string? reference = null)
    {
        if (branchId <= 0)
            throw new FinanceDomainException("An expense needs the branch it was for.");

        if (categoryId <= 0)
            throw new FinanceDomainException("An expense needs a category.");

        if (amount <= 0)
            throw new FinanceDomainException("An expense needs a positive amount.");

        if (paidFrom == PaidFrom.Partner && (partnerId is null or <= 0))
            throw new FinanceDomainException("Money from a partner's pocket needs the partner.");

        BranchId = branchId;
        Date = date;
        CategoryId = categoryId;
        Amount = amount;
        PaidFrom = paidFrom;
        PartnerId = paidFrom == PaidFrom.Partner ? partnerId : null;
        Vendor = string.IsNullOrWhiteSpace(vendor) ? null : vendor.Trim();
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        Reference = reference;
        Source = source;
        RecordedBy = recordedBy;
        RecordedAt = DateTime.UtcNow;
    }

    public void Void(string reason, string by)
    {
        if (IsVoided)
            throw new FinanceDomainException("This expense is already voided.");

        if (string.IsNullOrWhiteSpace(reason))
            throw new FinanceDomainException("Voiding an expense needs a reason.");

        VoidedAt = DateTime.UtcNow;
        VoidedBy = by;
        VoidReason = reason.Trim();
    }
}
