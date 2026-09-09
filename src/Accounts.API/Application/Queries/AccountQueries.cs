using Chillax.Accounts.Domain.AggregatesModel.CustomerAccountAggregate;
using Chillax.Accounts.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Chillax.Accounts.API.Application.Queries;

public class AccountQueries : IAccountQueries
{
    private readonly AccountsContext _context;

    public AccountQueries(AccountsContext context)
    {
        _context = context;
    }

    public async Task<AccountViewModel?> GetAccountByCustomerIdAsync(string customerId)
    {
        var account = await _context.CustomerAccounts
            .Include(a => a.Transactions)
            .FirstOrDefaultAsync(a => a.CustomerId == customerId);

        if (account == null)
            return null;

        return MapToViewModel(account);
    }

    public async Task<IEnumerable<TransactionViewModel>> GetTransactionsByCustomerIdAsync(string customerId, int? limit = null)
    {
        var query = _context.AccountTransactions
            .Join(_context.CustomerAccounts,
                t => t.CustomerAccountId,
                a => a.Id,
                (t, a) => new { Transaction = t, Account = a })
            .Where(x => x.Account.CustomerId == customerId)
            .OrderByDescending(x => x.Transaction.CreatedAt)
            .Select(x => x.Transaction);

        if (limit.HasValue)
        {
            query = query.Take(limit.Value);
        }

        var transactions = await query.ToListAsync();

        return transactions.Select(MapTransactionToViewModel);
    }

    public async Task<IEnumerable<AccountSummaryViewModel>> GetAllAccountsAsync()
    {
        var accounts = await _context.CustomerAccounts
            .OrderByDescending(a => Math.Abs(a.Balance))
            .ThenBy(a => a.CustomerName)
            .ToListAsync();

        return accounts.Select(MapToSummaryViewModel);
    }

    public async Task<IEnumerable<AccountSummaryViewModel>> SearchAccountsAsync(string? searchTerm)
    {
        var query = _context.CustomerAccounts.AsQueryable();

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.ToLower();
            query = query.Where(a =>
                (a.CustomerName != null && a.CustomerName.ToLower().Contains(term)) ||
                a.CustomerId.ToLower().Contains(term));
        }

        var accounts = await query
            .OrderByDescending(a => Math.Abs(a.Balance))
            .ThenBy(a => a.CustomerName)
            .ToListAsync();

        return accounts.Select(MapToSummaryViewModel);
    }

    private static AccountViewModel MapToViewModel(CustomerAccount account)
    {
        return new AccountViewModel
        {
            Id = account.Id,
            CustomerId = account.CustomerId,
            CustomerName = account.CustomerName,
            Balance = account.Balance,
            CreatedAt = account.CreatedAt,
            UpdatedAt = account.UpdatedAt,
            Transactions = account.Transactions
                .OrderByDescending(t => t.CreatedAt)
                .Select(MapTransactionToViewModel)
                .ToList()
        };
    }

    private static AccountSummaryViewModel MapToSummaryViewModel(CustomerAccount account)
    {
        return new AccountSummaryViewModel
        {
            Id = account.Id,
            CustomerId = account.CustomerId,
            CustomerName = account.CustomerName,
            Balance = account.Balance,
            UpdatedAt = account.UpdatedAt
        };
    }

    private static TransactionViewModel MapTransactionToViewModel(AccountTransaction transaction)
    {
        return new TransactionViewModel
        {
            Id = transaction.Id,
            Type = transaction.Type == TransactionType.Charge ? "charge" : "payment",
            Amount = transaction.Amount,
            Description = transaction.Description,
            Source = transaction.Source switch
            {
                TransactionSource.PosReceipt => "posReceipt",
                TransactionSource.PosCreditNote => "posCreditNote",
                _ => "manual"
            },
            SourceNumber = transaction.SourceNumber,
            RecordedBy = transaction.RecordedBy,
            CreatedAt = transaction.CreatedAt
        };
    }
}
