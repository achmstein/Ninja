using Ninja.Accounts.Domain.Exceptions;
using Ninja.Accounts.Domain.SeedWork;

namespace Ninja.Accounts.Domain.AggregatesModel.CustomerAccountAggregate;

public class CustomerAccount : Entity, IAggregateRoot
{
    public string CustomerId { get; private set; }
    public string? CustomerName { get; private set; }
    public decimal Balance { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private readonly List<AccountTransaction> _transactions = new();
    public IReadOnlyCollection<AccountTransaction> Transactions => _transactions.AsReadOnly();

    protected CustomerAccount()
    {
        CustomerId = string.Empty;
    }

    public CustomerAccount(string customerId, string? customerName) : this()
    {
        if (string.IsNullOrWhiteSpace(customerId))
            throw new AccountsDomainException("Customer ID is required");

        CustomerId = customerId;
        CustomerName = customerName;
        Balance = 0;
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void AddCharge(decimal amount, string? description, string addedBy, string? reference = null, TransactionSource source = TransactionSource.Manual, int? sourceNumber = null)
    {
        if (amount <= 0)
            throw new AccountsDomainException("Charge amount must be greater than zero");

        if (string.IsNullOrWhiteSpace(addedBy))
            throw new AccountsDomainException("AddedBy is required");

        var transaction = new AccountTransaction(
            Id,
            TransactionType.Charge,
            amount,
            description,
            addedBy,
            reference,
            source,
            sourceNumber);

        _transactions.Add(transaction);
        Balance += amount;
        UpdatedAt = DateTime.UtcNow;
    }

    public void RecordPayment(decimal amount, string? description, string recordedBy, string? reference = null, TransactionSource source = TransactionSource.Manual, int? sourceNumber = null)
    {
        if (amount <= 0)
            throw new AccountsDomainException("Payment amount must be greater than zero");

        if (string.IsNullOrWhiteSpace(recordedBy))
            throw new AccountsDomainException("RecordedBy is required");

        var transaction = new AccountTransaction(
            Id,
            TransactionType.Payment,
            amount,
            description,
            recordedBy,
            reference,
            source,
            sourceNumber);

        _transactions.Add(transaction);
        Balance -= amount;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateCustomerName(string? customerName)
    {
        CustomerName = customerName;
        UpdatedAt = DateTime.UtcNow;
    }
}
