#nullable enable
namespace Chillax.Finance.Domain.AggregatesModel.ExpenseAggregate;

public interface IExpenseRepository : IRepository<Expense>
{
    Expense Add(Expense expense);

    Task<Expense?> GetAsync(int id);

    Task<Expense?> FindByReferenceAsync(string reference);

    Task<ExpenseReceipt?> GetReceiptAsync(int expenseId);

    ExpenseReceipt AddReceipt(ExpenseReceipt receipt);

    void RemoveReceipt(ExpenseReceipt receipt);
}

public interface IExpenseCategoryRepository : IRepository<ExpenseCategory>
{
    ExpenseCategory Add(ExpenseCategory category);

    Task<ExpenseCategory?> GetAsync(int id);

    Task<List<ExpenseCategory>> GetAllAsync();
}
