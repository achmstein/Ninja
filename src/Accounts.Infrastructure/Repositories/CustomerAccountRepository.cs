namespace Ninja.Accounts.Infrastructure.Repositories;

public class CustomerAccountRepository : ICustomerAccountRepository
{
    private readonly AccountsContext _context;

    public IUnitOfWork UnitOfWork => _context;

    public CustomerAccountRepository(AccountsContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    public CustomerAccount Add(CustomerAccount account)
    {
        return _context.CustomerAccounts.Add(account).Entity;
    }

    public void Update(CustomerAccount account)
    {
        _context.Entry(account).State = EntityState.Modified;
    }

    public async Task<CustomerAccount?> GetAsync(int id)
    {
        return await _context.CustomerAccounts.FindAsync(id);
    }

    public async Task<CustomerAccount?> GetByCustomerIdAsync(string customerId)
    {
        return await _context.CustomerAccounts
            .FirstOrDefaultAsync(a => a.CustomerId == customerId);
    }

    public async Task<CustomerAccount?> GetWithTransactionsAsync(int id)
    {
        return await _context.CustomerAccounts
            .Include(a => a.Transactions)
            .FirstOrDefaultAsync(a => a.Id == id);
    }

    public async Task<CustomerAccount?> GetWithTransactionsByCustomerIdAsync(string customerId)
    {
        return await _context.CustomerAccounts
            .Include(a => a.Transactions)
            .FirstOrDefaultAsync(a => a.CustomerId == customerId);
    }

    public async Task<IEnumerable<CustomerAccount>> GetAllAsync()
    {
        return await _context.CustomerAccounts
            .OrderBy(a => a.CustomerName)
            .ToListAsync();
    }

    public async Task<IEnumerable<CustomerAccount>> GetAccountsWithBalanceAsync()
    {
        return await _context.CustomerAccounts
            .Where(a => a.Balance != 0)
            .OrderByDescending(a => Math.Abs(a.Balance))
            .ToListAsync();
    }
}
