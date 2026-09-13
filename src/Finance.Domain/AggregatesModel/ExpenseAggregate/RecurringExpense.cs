#nullable enable
namespace Chillax.Finance.Domain.AggregatesModel.ExpenseAggregate;

/// <summary>
/// A bill that comes every month on the same day — rent, internet, a
/// subscription. Finance posts the expense itself when the day comes,
/// once per month (the posted line carries <c>recurring:{id}:{yyyy-MM}</c>),
/// so nobody has to remember, and switching it off stops the next one
/// without touching the ones already posted.
/// </summary>
public class RecurringExpense : Entity, IAggregateRoot
{
    public int BranchId { get; private set; }

    public int CategoryId { get; private set; }

    public decimal Amount { get; private set; }

    /// <summary>1–28, so every month has the day.</summary>
    public int DayOfMonth { get; private set; }

    public PaidFrom PaidFrom { get; private set; }

    public int? PartnerId { get; private set; }

    public string? Vendor { get; private set; }

    public string? Note { get; private set; }

    public bool IsActive { get; private set; } = true;

    protected RecurringExpense() { }

    public RecurringExpense(int branchId, int categoryId, decimal amount, int dayOfMonth, PaidFrom paidFrom, int? partnerId, string? vendor, string? note)
    {
        if (branchId <= 0)
            throw new FinanceDomainException("A recurring bill needs the branch it is for.");

        BranchId = branchId;
        Update(categoryId, amount, dayOfMonth, paidFrom, partnerId, vendor, note, true);
    }

    public void Update(int categoryId, decimal amount, int dayOfMonth, PaidFrom paidFrom, int? partnerId, string? vendor, string? note, bool isActive)
    {
        if (categoryId <= 0)
            throw new FinanceDomainException("A recurring bill needs a category.");

        if (amount <= 0)
            throw new FinanceDomainException("A recurring bill needs a positive amount.");

        if (dayOfMonth is < 1 or > 28)
            throw new FinanceDomainException("A recurring bill's day must be between 1 and 28, so every month has it.");

        if (paidFrom == PaidFrom.Partner && (partnerId is null or <= 0))
            throw new FinanceDomainException("A bill paid from a partner's pocket needs the partner.");

        CategoryId = categoryId;
        Amount = amount;
        DayOfMonth = dayOfMonth;
        PaidFrom = paidFrom;
        PartnerId = paidFrom == PaidFrom.Partner ? partnerId : null;
        Vendor = string.IsNullOrWhiteSpace(vendor) ? null : vendor.Trim();
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        IsActive = isActive;
    }

    /// <summary>The reference the month's posted line carries.</summary>
    public string ReferenceFor(DateOnly month) => $"recurring:{Id}:{month:yyyy-MM}";

    /// <summary>Whether the bill is due on or before a day, in that day's month.</summary>
    public bool IsDueBy(DateOnly day) => IsActive && DayOfMonth <= day.Day;
}

public interface IRecurringExpenseRepository : IRepository<RecurringExpense>
{
    RecurringExpense Add(RecurringExpense bill);

    Task<RecurringExpense?> GetAsync(int id);

    Task<List<RecurringExpense>> GetAllAsync(int? branchId = null);
}
