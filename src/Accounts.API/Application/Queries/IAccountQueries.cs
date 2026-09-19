namespace Ninja.Accounts.API.Application.Queries;

public interface IAccountQueries
{
    Task<AccountViewModel?> GetAccountByCustomerIdAsync(string customerId);

    /// <summary>The balance alone, without the ledger — what the till shows on a customer's card.</summary>
    Task<AccountSummaryViewModel?> GetAccountSummaryByCustomerIdAsync(string customerId);
    Task<IEnumerable<TransactionViewModel>> GetTransactionsByCustomerIdAsync(string customerId, int? limit = null);
    Task<IEnumerable<AccountSummaryViewModel>> GetAllAccountsAsync();
    Task<IEnumerable<AccountSummaryViewModel>> SearchAccountsAsync(string? searchTerm);
}
