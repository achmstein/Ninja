using Ninja.Accounts.Domain.SeedWork;

namespace Ninja.Accounts.Domain.AggregatesModel.CustomerAccountAggregate;

public interface ICustomerAccountRepository : IRepository<CustomerAccount>
{
    CustomerAccount Add(CustomerAccount account);
    void Update(CustomerAccount account);
    Task<CustomerAccount?> GetAsync(int id);
    Task<CustomerAccount?> GetByCustomerIdAsync(string customerId);
    Task<CustomerAccount?> GetWithTransactionsAsync(int id);
    Task<CustomerAccount?> GetWithTransactionsByCustomerIdAsync(string customerId);
    Task<IEnumerable<CustomerAccount>> GetAllAsync();
    Task<IEnumerable<CustomerAccount>> GetAccountsWithBalanceAsync();
}
