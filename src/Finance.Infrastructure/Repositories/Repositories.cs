#nullable enable
namespace Chillax.Finance.Infrastructure.Repositories;

public class ExpenseRepository(FinanceContext context) : IExpenseRepository
{
    public IUnitOfWork UnitOfWork => context;

    public Expense Add(Expense expense) => context.Expenses.Add(expense).Entity;

    public Task<Expense?> GetAsync(int id)
        => context.Expenses.FirstOrDefaultAsync(e => e.Id == id);

    public Task<Expense?> FindByReferenceAsync(string reference)
        => context.Expenses.FirstOrDefaultAsync(e => e.Reference == reference);

    public Task<ExpenseReceipt?> GetReceiptAsync(int expenseId)
        => context.ExpenseReceipts.FirstOrDefaultAsync(r => r.ExpenseId == expenseId);

    public ExpenseReceipt AddReceipt(ExpenseReceipt receipt) => context.ExpenseReceipts.Add(receipt).Entity;

    public void RemoveReceipt(ExpenseReceipt receipt) => context.ExpenseReceipts.Remove(receipt);
}

public class ExpenseCategoryRepository(FinanceContext context) : IExpenseCategoryRepository
{
    public IUnitOfWork UnitOfWork => context;

    public ExpenseCategory Add(ExpenseCategory category) => context.ExpenseCategories.Add(category).Entity;

    public Task<ExpenseCategory?> GetAsync(int id)
        => context.ExpenseCategories.FirstOrDefaultAsync(c => c.Id == id);

    public Task<List<ExpenseCategory>> GetAllAsync()
        => context.ExpenseCategories.OrderBy(c => c.DisplayOrder).ThenBy(c => c.Id).ToListAsync();
}

public class RecurringExpenseRepository(FinanceContext context) : IRecurringExpenseRepository
{
    public IUnitOfWork UnitOfWork => context;

    public RecurringExpense Add(RecurringExpense bill) => context.RecurringExpenses.Add(bill).Entity;

    public Task<RecurringExpense?> GetAsync(int id)
        => context.RecurringExpenses.FirstOrDefaultAsync(r => r.Id == id);

    public Task<List<RecurringExpense>> GetAllAsync(int? branchId = null)
    {
        var query = context.RecurringExpenses.AsQueryable();
        if (branchId is { } b) query = query.Where(r => r.BranchId == b);
        return query.OrderBy(r => r.DayOfMonth).ThenBy(r => r.Id).ToListAsync();
    }
}

public class SupplierRepository(FinanceContext context) : ISupplierRepository
{
    public IUnitOfWork UnitOfWork => context;

    public Supplier Add(Supplier supplier) => context.Suppliers.Add(supplier).Entity;

    public Task<Supplier?> GetAsync(int id)
        => context.Suppliers.FirstOrDefaultAsync(s => s.Id == id);

    public Task<List<Supplier>> GetAllAsync()
        => context.Suppliers.OrderBy(s => s.Name).ToListAsync();

    public SupplierEntry AddEntry(SupplierEntry entry) => context.SupplierEntries.Add(entry).Entity;

    public Task<SupplierEntry?> FindEntryByReferenceAsync(string reference)
        => context.SupplierEntries.FirstOrDefaultAsync(e => e.Reference == reference);
}

public class ProfitRepository(FinanceContext context) : IProfitRepository
{
    public IUnitOfWork UnitOfWork => context;

    public SalesFact Add(SalesFact fact) => context.SalesFacts.Add(fact).Entity;

    public CostFact Add(CostFact fact) => context.CostFacts.Add(fact).Entity;

    public LabourFact Add(LabourFact fact) => context.LabourFacts.Add(fact).Entity;

    public Task<bool> HasSalesReferenceAsync(string reference)
        => context.SalesFacts.AnyAsync(f => f.Reference == reference);

    public Task<bool> HasCostReferenceAsync(string reference)
        => context.CostFacts.AnyAsync(f => f.Reference == reference);

    public Task<LabourFact?> FindLabourAsync(int employeeId, DateOnly periodStart)
        => context.LabourFacts.FirstOrDefaultAsync(f => f.EmployeeId == employeeId && f.PeriodStart == periodStart);
}

public class PartnerRepository(FinanceContext context) : IPartnerRepository
{
    public IUnitOfWork UnitOfWork => context;

    public Partner Add(Partner partner) => context.Partners.Add(partner).Entity;

    public Task<Partner?> GetAsync(int id)
        => context.Partners.FirstOrDefaultAsync(p => p.Id == id);

    public Task<List<Partner>> GetAllAsync()
        => context.Partners.OrderBy(p => p.Name).ToListAsync();

    public PartnerEntry AddEntry(PartnerEntry entry) => context.PartnerEntries.Add(entry).Entity;

    public Task<PartnerEntry?> FindEntryByReferenceAsync(string reference)
        => context.PartnerEntries.FirstOrDefaultAsync(e => e.Reference == reference);
}
