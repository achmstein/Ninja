#nullable enable
namespace Ninja.Finance.API.Application.Queries;

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

/// <summary>A partner as the list shows them: with what the business holds of theirs at the branch.</summary>
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
/// in (<see cref="NetSales"/>, as the customers paid it, VAT inside); less
/// the VAT inside them, which is the tax office's, it is what the business
/// earned (<see cref="NetSalesExVat"/>), and everything below is measured
/// against that. Goods, waste, shrinkage, labour and the expenses by
/// category are what went out; prime cost (goods + labour) over net sales
/// is the ratio every business watches. Partners' money is nowhere in it.
/// </summary>
public record ProfitView(
    int Year,
    int Month,
    /// <summary>What the till took, VAT inside.</summary>
    decimal Sales,
    /// <summary>What went back on credit notes, VAT inside.</summary>
    decimal Refunds,
    /// <summary>Sales less refunds, VAT inside: what the customers paid, for display.</summary>
    decimal NetSales,
    /// <summary>The VAT inside the sales (before refunds).</summary>
    decimal Vat,
    decimal Goods,
    decimal Waste,
    decimal Labour,
    IReadOnlyList<CategoryTotal> ExpensesByCategory,
    decimal Expenses,
    /// <summary>Net sales without VAT, less goods, waste, shrinkage, labour and expenses.</summary>
    decimal Profit,
    /// <summary>(goods + labour) ÷ net sales without VAT; null when there were no sales.</summary>
    decimal? PrimeCostRatio,
    /// <summary>profit ÷ net sales without VAT; null when there were no sales.</summary>
    decimal? Margin,
    /// <summary>How the profit falls to the partners by their shares; empty when none are set.</summary>
    IReadOnlyList<PartnerProfitShareView>? PartnerShares = null,
    /// <summary>The VAT that went back with the refunds: each refund's share of its sale's VAT.</summary>
    decimal RefundVat = 0,
    /// <summary>The VAT the month owes: <see cref="Vat"/> less <see cref="RefundVat"/>.</summary>
    decimal NetVat = 0,
    /// <summary>Net sales without the VAT inside them: (sales − refunds) − (VAT − refund VAT). What profit, margin, prime cost and the partners' shares are worked from.</summary>
    decimal NetSalesExVat = 0,
    /// <summary>Stock found short at counts or taken off by hand, less stock found over; negative when more was found than lost.</summary>
    decimal Shrinkage = 0);

public record PartnerProfitShareView(int PartnerId, string Name, decimal Percent, decimal Amount);

/// <summary>
/// One month's headline figures, for the trend. <see cref="Goods"/> is
/// everything the stock cost (goods, waste and shrinkage), so profit is
/// <see cref="NetSalesExVat"/> less goods, labour and expenses;
/// <see cref="NetSales"/> keeps the VAT, for display.
/// </summary>
public record ProfitMonthView(int Year, int Month, decimal NetSales, decimal Goods, decimal Labour, decimal Expenses, decimal Profit, decimal NetSalesExVat = 0);
