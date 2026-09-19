using Ninja.Accounts.Domain.Exceptions;
using Ninja.Accounts.Domain.SeedWork;

namespace Ninja.Accounts.Domain.AggregatesModel.CustomerAccountAggregate;

public class AccountTransaction : Entity
{
    public int CustomerAccountId { get; private set; }
    public TransactionType Type { get; private set; }
    public decimal Amount { get; private set; }
    public string? Description { get; private set; }
    public string RecordedBy { get; private set; }
    public DateTime CreatedAt { get; private set; }

    /// <summary>
    /// What outside the ledger this transaction settles (e.g. "sales-ticket:42").
    /// Unique when set — it's what makes an event-driven charge idempotent:
    /// a redelivered settle event finds its reference already posted.
    /// Null for charges and payments staff key in by hand.
    /// </summary>
    public string? Reference { get; private set; }

    /// <summary>
    /// Where the line came from, and the till's number for it (receipt or
    /// credit note) when it was not keyed in by hand. The apps render these
    /// in the user's language; Description is only for what staff typed.
    /// </summary>
    public TransactionSource Source { get; private set; }
    public int? SourceNumber { get; private set; }

    protected AccountTransaction()
    {
        RecordedBy = string.Empty;
    }

    internal AccountTransaction(
        int customerAccountId,
        TransactionType type,
        decimal amount,
        string? description,
        string recordedBy,
        string? reference = null,
        TransactionSource source = TransactionSource.Manual,
        int? sourceNumber = null) : this()
    {
        if (amount <= 0)
            throw new AccountsDomainException("Transaction amount must be greater than zero");

        if (string.IsNullOrWhiteSpace(recordedBy))
            throw new AccountsDomainException("RecordedBy is required");

        CustomerAccountId = customerAccountId;
        Type = type;
        Amount = amount;
        Description = description;
        RecordedBy = recordedBy;
        Reference = reference;
        Source = source;
        SourceNumber = sourceNumber;
        CreatedAt = DateTime.UtcNow;
    }
}
