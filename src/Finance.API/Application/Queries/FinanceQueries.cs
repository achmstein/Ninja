#nullable enable
using Ninja.Finance.Infrastructure;

namespace Ninja.Finance.API.Application.Queries;

public interface IFinanceQueries
{
    Task<IReadOnlyList<ExpenseCategoryView>> GetCategoriesAsync(bool includeInactive);
    Task<ExpensesView> GetExpensesAsync(int branchId, DateOnly from, DateOnly to);
    Task<IReadOnlyList<RecurringExpenseView>> GetRecurringAsync(int branchId);
    Task<IReadOnlyList<string>> GetVendorsAsync(int branchId, int take);
    Task<IReadOnlyList<SupplierView>> GetSuppliersAsync(int branchId, bool includeInactive);
    Task<SupplierLedgerView?> GetSupplierLedgerAsync(int supplierId, int branchId);
    Task<IReadOnlyList<PartnerView>> GetPartnersAsync(int branchId, bool includeInactive);
    Task<PartnerLedgerView?> GetPartnerLedgerAsync(int partnerId, int branchId);
    Task<IReadOnlyList<TillSupplierView>> GetTillSuppliersAsync(int branchId);
    Task<IReadOnlyList<TillPickView>> GetTillPartnersAsync(int branchId);
    Task<IReadOnlyList<TillCategoryView>> GetTillCategoriesAsync();
    Task<ProfitView> GetProfitAsync(int branchId, int year, int month);
    Task<IReadOnlyList<ProfitMonthView>> GetProfitTrendAsync(int branchId, int months);
}

/// <summary>Read side, straight off the context with no tracking. Balances are sums over the ledgers.</summary>
public class FinanceQueries(FinanceContext context) : IFinanceQueries
{
    public async Task<IReadOnlyList<ExpenseCategoryView>> GetCategoriesAsync(bool includeInactive)
    {
        var query = context.ExpenseCategories.AsNoTracking();
        if (!includeInactive) query = query.Where(c => c.IsActive);
        var rows = await query.OrderBy(c => c.DisplayOrder).ThenBy(c => c.Id).ToListAsync();
        return rows.Select(c => new ExpenseCategoryView(c.Id, c.Name, c.DisplayOrder, c.IsActive)).ToList();
    }

    public async Task<ExpensesView> GetExpensesAsync(int branchId, DateOnly from, DateOnly to)
    {
        var rows = await context.Expenses.AsNoTracking()
            .Where(e => e.BranchId == branchId && e.Date >= from && e.Date <= to)
            .OrderByDescending(e => e.Date).ThenByDescending(e => e.Id)
            .ToListAsync();

        var categories = await context.ExpenseCategories.AsNoTracking().ToDictionaryAsync(c => c.Id, c => c.Name);
        var partners = await context.Partners.AsNoTracking().ToDictionaryAsync(p => p.Id, p => p.Name);

        var live = rows.Where(e => e.VoidedAt == null).ToList();
        var ids = rows.Select(e => e.Id).ToList();
        var withReceipt = (await context.ExpenseReceipts.AsNoTracking()
            .Where(r => ids.Contains(r.ExpenseId))
            .Select(r => r.ExpenseId)
            .ToListAsync()).ToHashSet();

        var byCategory = live
            .GroupBy(e => e.CategoryId)
            .Select(g => new CategoryTotal(g.Key, categories.GetValueOrDefault(g.Key) ?? new LocalizedText("?"), g.Sum(e => e.Amount)))
            .OrderByDescending(c => c.Total)
            .ToList();

        return new ExpensesView(
            live.Sum(e => e.Amount),
            byCategory,
            rows.Select(e => new ExpenseView(
                e.Id, e.BranchId, e.Date, e.CategoryId, categories.GetValueOrDefault(e.CategoryId) ?? new LocalizedText("?"),
                e.Amount, e.PaidFrom, e.PartnerId, e.PartnerId is { } pid ? partners.GetValueOrDefault(pid) : null,
                e.Vendor, e.Note, e.Reference, e.Source, e.RecordedBy, e.RecordedAt, e.VoidedAt, e.VoidedBy, e.VoidReason,
                withReceipt.Contains(e.Id))).ToList());
    }

    public async Task<IReadOnlyList<RecurringExpenseView>> GetRecurringAsync(int branchId)
    {
        var rows = await context.RecurringExpenses.AsNoTracking()
            .Where(r => r.BranchId == branchId)
            .OrderBy(r => r.DayOfMonth).ThenBy(r => r.Id)
            .ToListAsync();
        var categories = await context.ExpenseCategories.AsNoTracking().ToDictionaryAsync(c => c.Id, c => c.Name);
        var partners = await context.Partners.AsNoTracking().ToDictionaryAsync(p => p.Id, p => p.Name);

        return rows.Select(r => new RecurringExpenseView(
            r.Id, r.BranchId, r.CategoryId, categories.GetValueOrDefault(r.CategoryId) ?? new LocalizedText("?"),
            r.Amount, r.DayOfMonth, r.PaidFrom, r.PartnerId, r.PartnerId is { } pid ? partners.GetValueOrDefault(pid) : null,
            r.Vendor, r.Note, r.IsActive)).ToList();
    }

    /// <summary>
    /// The vendor names the branch's expenses were recorded under, most
    /// recent first, one spelling each: what the bill scanner offers so a
    /// company keeps one name on the list.
    /// </summary>
    public async Task<IReadOnlyList<string>> GetVendorsAsync(int branchId, int take)
    {
        var recent = await context.Expenses.AsNoTracking()
            .Where(e => e.BranchId == branchId && e.VoidedAt == null && e.Vendor != null)
            .OrderByDescending(e => e.Date).ThenByDescending(e => e.Id)
            .Select(e => e.Vendor!)
            .Take(take * 10)
            .ToListAsync();
        var recurring = await context.RecurringExpenses.AsNoTracking()
            .Where(r => r.BranchId == branchId && r.IsActive && r.Vendor != null)
            .OrderBy(r => r.Id)
            .Select(r => r.Vendor!)
            .ToListAsync();

        return recurring.Concat(recent)
            .Select(v => v.Trim())
            .Where(v => v.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(take)
            .ToList();
    }

    public async Task<IReadOnlyList<SupplierView>> GetSuppliersAsync(int branchId, bool includeInactive)
    {
        var query = context.Suppliers.AsNoTracking();
        if (!includeInactive) query = query.Where(s => s.IsActive);
        var suppliers = await query.OrderBy(s => s.Name).ToListAsync();
        var balances = await SupplierBalancesAsync(branchId);

        return suppliers.Select(s => new SupplierView(s.Id, s.Name, s.Phone, s.Notes, s.IsActive, balances.GetValueOrDefault(s.Id))).ToList();
    }

    /// <summary>What the branch owes each supplier: invoices less payments and credits.</summary>
    private Task<Dictionary<int, decimal>> SupplierBalancesAsync(int branchId)
        => context.SupplierEntries.AsNoTracking()
            .Where(e => e.BranchId == branchId)
            .GroupBy(e => e.SupplierId)
            .Select(g => new { g.Key, Balance = g.Sum(e => e.Type == SupplierEntryType.Invoice ? e.Amount : -e.Amount) })
            .ToDictionaryAsync(x => x.Key, x => x.Balance);

    public async Task<SupplierLedgerView?> GetSupplierLedgerAsync(int supplierId, int branchId)
    {
        if (!await context.Suppliers.AnyAsync(s => s.Id == supplierId))
            return null;

        var entries = await context.SupplierEntries.AsNoTracking()
            .Where(e => e.SupplierId == supplierId && e.BranchId == branchId)
            .OrderByDescending(e => e.Date).ThenByDescending(e => e.Id)
            .ToListAsync();

        return new SupplierLedgerView(supplierId, entries.Sum(e => e.Signed),
            entries.Select(e => new SupplierEntryView(e.Id, e.SupplierId, e.BranchId, e.Type, e.Amount, e.Signed, e.Date, e.Note, e.Reference, e.Source, e.RecordedBy, e.RecordedAt)).ToList());
    }

    public async Task<IReadOnlyList<PartnerView>> GetPartnersAsync(int branchId, bool includeInactive)
    {
        var query = context.Partners.AsNoTracking().Where(p => p.Shares.Any(s => s.BranchId == branchId));
        if (!includeInactive) query = query.Where(p => p.IsActive);
        var partners = await query.OrderBy(p => p.Name).ToListAsync();

        var balances = await context.PartnerEntries.AsNoTracking()
            .Where(e => e.BranchId == branchId)
            .GroupBy(e => e.PartnerId)
            .Select(g => new { g.Key, Balance = g.Sum(e => e.Type == PartnerEntryType.Contribution ? e.Amount : -e.Amount) })
            .ToDictionaryAsync(x => x.Key, x => x.Balance);

        return partners.Select(p => new PartnerView(p.Id, p.Name, p.Phone, p.UserId, p.BranchIds.ToList(),
            p.Shares.Select(s => new PartnerShareView(s.BranchId, s.Percent)).ToList(), p.IsActive, balances.GetValueOrDefault(p.Id))).ToList();
    }

    public async Task<PartnerLedgerView?> GetPartnerLedgerAsync(int partnerId, int branchId)
    {
        if (!await context.Partners.AnyAsync(p => p.Id == partnerId))
            return null;

        var entries = await context.PartnerEntries.AsNoTracking()
            .Where(e => e.PartnerId == partnerId && e.BranchId == branchId)
            .OrderByDescending(e => e.Date).ThenByDescending(e => e.Id)
            .ToListAsync();

        return new PartnerLedgerView(partnerId, entries.Sum(e => e.Signed),
            entries.Select(e => new PartnerEntryView(e.Id, e.PartnerId, e.BranchId, e.Type, e.Amount, e.Signed, e.Date, e.Note, e.Reference, e.Source, e.RecordedBy, e.RecordedAt)).ToList());
    }

    public async Task<IReadOnlyList<TillSupplierView>> GetTillSuppliersAsync(int branchId)
    {
        var suppliers = await context.Suppliers.AsNoTracking().Where(s => s.IsActive).OrderBy(s => s.Name).ToListAsync();
        var balances = await SupplierBalancesAsync(branchId);
        return suppliers.Select(s => new TillSupplierView(s.Id, s.Name, balances.GetValueOrDefault(s.Id))).ToList();
    }

    public async Task<IReadOnlyList<TillPickView>> GetTillPartnersAsync(int branchId)
        => await context.Partners.AsNoTracking().Where(p => p.IsActive && p.Shares.Any(s => s.BranchId == branchId)).OrderBy(p => p.Name)
            .Select(p => new TillPickView(p.Id, p.Name)).ToListAsync();

    public async Task<ProfitView> GetProfitAsync(int branchId, int year, int month)
    {
        var from = new DateOnly(year, month, 1);
        var to = from.AddMonths(1).AddDays(-1);

        var sales = await context.SalesFacts.AsNoTracking()
            .Where(f => f.BranchId == branchId && f.Date >= from && f.Date <= to)
            .GroupBy(f => f.Kind)
            .Select(g => new { g.Key, Amount = g.Sum(f => f.Amount), Vat = g.Sum(f => f.Vat) })
            .ToListAsync();

        var costs = await context.CostFacts.AsNoTracking()
            .Where(f => f.BranchId == branchId && f.Date >= from && f.Date <= to)
            .GroupBy(f => f.Kind)
            .Select(g => new { g.Key, Amount = g.Sum(f => f.Amount) })
            .ToListAsync();

        var labour = await context.LabourFacts.AsNoTracking()
            .Where(f => f.BranchId == branchId && f.PeriodStart >= from && f.PeriodStart <= to)
            .SumAsync(f => f.Amount);

        var expenses = await context.Expenses.AsNoTracking()
            .Where(e => e.BranchId == branchId && e.Date >= from && e.Date <= to && e.VoidedAt == null)
            .GroupBy(e => e.CategoryId)
            .Select(g => new { g.Key, Amount = g.Sum(e => e.Amount) })
            .ToListAsync();
        var categories = await context.ExpenseCategories.AsNoTracking().ToDictionaryAsync(c => c.Id, c => c.Name);

        var gross = sales.FirstOrDefault(s => s.Key == SalesFactKind.Sale);
        var refunds = sales.FirstOrDefault(s => s.Key == SalesFactKind.Refund)?.Amount ?? 0;
        var net = (gross?.Amount ?? 0) - refunds;
        var goods = costs.FirstOrDefault(c => c.Key == CostFactKind.Goods)?.Amount ?? 0;
        var waste = costs.FirstOrDefault(c => c.Key == CostFactKind.Waste)?.Amount ?? 0;
        var byCategory = expenses
            .Select(e => new CategoryTotal(e.Key, categories.GetValueOrDefault(e.Key) ?? new LocalizedText("?"), e.Amount))
            .OrderByDescending(c => c.Total)
            .ToList();
        var operating = byCategory.Sum(c => c.Total);
        var profit = net - goods - waste - labour - operating;

        // How the month falls to the partners, by their shares of this branch
        var partners = await context.Partners.AsNoTracking()
            .Where(p => p.IsActive && p.Shares.Any(s => s.BranchId == branchId))
            .OrderBy(p => p.Name)
            .ToListAsync();
        var shares = partners
            .Select(p => new PartnerProfitShareView(p.Id, p.Name, p.ShareAt(branchId), Math.Round(profit * p.ShareAt(branchId) / 100m, 2)))
            .ToList();

        return new ProfitView(year, month, gross?.Amount ?? 0, refunds, net, gross?.Vat ?? 0, goods, waste, labour,
            byCategory, operating, profit,
            net > 0 ? Math.Round((goods + labour) / net, 4) : null,
            net > 0 ? Math.Round(profit / net, 4) : null,
            shares);
    }

    public async Task<IReadOnlyList<ProfitMonthView>> GetProfitTrendAsync(int branchId, int months)
    {
        var rows = new List<ProfitMonthView>();
        var today = BusinessDay.Of(DateTime.UtcNow);
        var first = new DateOnly(today.Year, today.Month, 1);

        for (var i = 0; i < months; i++)
        {
            var m = first.AddMonths(-i);
            var p = await GetProfitAsync(branchId, m.Year, m.Month);
            rows.Add(new ProfitMonthView(m.Year, m.Month, p.NetSales, p.Goods + p.Waste, p.Labour, p.Expenses, p.Profit));
        }

        return rows;
    }

    public async Task<IReadOnlyList<TillCategoryView>> GetTillCategoriesAsync()
    {
        var rows = await context.ExpenseCategories.AsNoTracking().Where(c => c.IsActive).OrderBy(c => c.DisplayOrder).ThenBy(c => c.Id).ToListAsync();
        return rows.Select(c => new TillCategoryView(c.Id, c.Name)).ToList();
    }
}
