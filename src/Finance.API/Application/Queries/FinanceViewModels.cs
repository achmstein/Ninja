#nullable enable
namespace Chillax.Finance.API.Application.Queries;

public record ExpenseCategoryView(int Id, LocalizedText Name, int DisplayOrder, bool IsActive);

public record ExpenseView(
    int Id,
    int BranchId,
    DateOnly Date,
    int CategoryId,
    LocalizedText CategoryName,
    decimal Amount,
    PaidFrom PaidFrom,
    int? PartnerId,
    string? PartnerName,
    string? Vendor,
    string? Note,
    string? Reference,
    FinanceSource Source,
    string RecordedBy,
    DateTime RecordedAt,
    DateTime? VoidedAt,
    string? VoidedBy,
    string? VoidReason,
    bool HasReceipt = false);

public record CategoryTotal(int CategoryId, LocalizedText CategoryName, decimal Total);

public record RecurringExpenseView(
    int Id,
    int BranchId,
    int CategoryId,
    LocalizedText CategoryName,
    decimal Amount,
    int DayOfMonth,
    PaidFrom PaidFrom,
    int? PartnerId,
    string? PartnerName,
    string? Vendor,
    string? Note,
    bool IsActive);

/// <summary>A range of expenses at a branch: the total, per category, and the lines (voided ones included, flagged).</summary>
public record ExpensesView(decimal Total, IReadOnlyList<CategoryTotal> ByCategory, IReadOnlyList<ExpenseView> Expenses);

/// <summary>A supplier as the list shows them: with what the branch owes them.</summary>
public record SupplierView(int Id, string Name, string? Phone, string? Notes, bool IsActive, decimal Balance);

public record SupplierEntryView(
    int Id,
    int SupplierId,
    int BranchId,
    SupplierEntryType Type,
    decimal Amount,
    decimal Signed,
    DateOnly Date,
    string? Note,
    string? Reference,
    FinanceSource Source,
    string RecordedBy,
    DateTime RecordedAt);

public record SupplierLedgerView(int SupplierId, decimal Balance, IReadOnlyList<SupplierEntryView> Entries);

public record PartnerShareView(int BranchId, decimal Percent);

/// <summary>A partner as the list shows them: with what the café holds of theirs at the branch.</summary>
public record PartnerView(int Id, string Name, string? Phone, string? UserId, IReadOnlyList<int> BranchIds, IReadOnlyList<PartnerShareView> Shares, bool IsActive, decimal Balance);

public record PartnerEntryView(
    int Id,
    int PartnerId,
    int BranchId,
    PartnerEntryType Type,
    decimal Amount,
    decimal Signed,
    DateOnly Date,
    string? Note,
    string? Reference,
    FinanceSource Source,
    string RecordedBy,
    DateTime RecordedAt);

public record PartnerLedgerView(int PartnerId, decimal Balance, IReadOnlyList<PartnerEntryView> Entries);

/// <summary>The till's pickers: who can draw, what a pay-out can be for.</summary>
public record TillPickView(int Id, string Name);

/// <summary>A supplier as the till pays them, with what the branch owes them right now.</summary>
public record TillSupplierView(int Id, string Name, decimal Balance);

public record TillCategoryView(int Id, LocalizedText Name);

/// <summary>
/// A month's profit and loss at a branch. Sales less refunds is what came
/// in; goods, waste, labour and the expenses by category are what went out;
/// prime cost (goods + labour) over net sales is the ratio every café
/// watches. Partners' money is nowhere in it.
/// </summary>
public record ProfitView(
    int Year,
    int Month,
    decimal Sales,
    decimal Refunds,
    decimal NetSales,
    decimal Vat,
    decimal Goods,
    decimal Waste,
    decimal Labour,
    IReadOnlyList<CategoryTotal> ExpensesByCategory,
    decimal Expenses,
    decimal Profit,
    /// <summary>(goods + labour) ÷ net sales; null when there were no sales.</summary>
    decimal? PrimeCostRatio,
    /// <summary>profit ÷ net sales; null when there were no sales.</summary>
    decimal? Margin,
    /// <summary>How the profit falls to the partners by their shares; empty when none are set.</summary>
    IReadOnlyList<PartnerProfitShareView>? PartnerShares = null);

public record PartnerProfitShareView(int PartnerId, string Name, decimal Percent, decimal Amount);

/// <summary>One month's headline figures, for the trend.</summary>
public record ProfitMonthView(int Year, int Month, decimal NetSales, decimal Goods, decimal Labour, decimal Expenses, decimal Profit);
