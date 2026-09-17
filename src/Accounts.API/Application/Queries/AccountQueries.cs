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

    public async Task<AccountSummaryViewModel?> GetAccountSummaryByCustomerIdAsync(string customerId)
    {
        var account = await _context.CustomerAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.CustomerId == customerId);

        return account == null ? null : MapToSummaryViewModel(account);
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
                TransactionSource.PosTabPayment => "posTabPayment",
                _ => "manual"
            },
            SourceNumber = transaction.SourceNumber,
            TicketId = TicketIdOf(transaction),
            RecordedBy = transaction.RecordedBy,
            CreatedAt = transaction.CreatedAt
        };
    }

    /// <summary>
    /// A receipt charge is posted under "sales-ticket:{ticketId}:{customerId}"
    /// (see TicketSettledIntegrationEventHandler); the ticket id is read back
    /// out of it, so the customer can open the receipt from the ledger.
    /// </summary>
    private static int? TicketIdOf(AccountTransaction transaction)
    {
        const string prefix = "sales-ticket:";
        if (transaction.Source != TransactionSource.PosReceipt
            || transaction.Reference is null
            || !transaction.Reference.StartsWith(prefix, StringComparison.Ordinal))
            return null;
        var rest = transaction.Reference.AsSpan(prefix.Length);
        var end = rest.IndexOf(':');
        return int.TryParse(end < 0 ? rest : rest[..end], out var id) ? id : null;
    }
}
