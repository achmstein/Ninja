#nullable enable
namespace Chillax.Sales.Domain.AggregatesModel.ShiftAggregate;

/// <summary>
/// Cash moving in or out of the drawer for a reason other than a sale.
/// Always positive; the type says which way it went.
/// </summary>
public class CashMovement : Entity
{
    public CashMovementType Type { get; private set; }

    public decimal Amount { get; private set; }

    public string Reason { get; private set; } = string.Empty;

    public string RecordedBy { get; private set; } = string.Empty;

    public DateTime RecordedAt { get; private set; }

    protected CashMovement() { }

    public CashMovement(CashMovementType type, decimal amount, string reason, string recordedBy)
    {
        if (amount <= 0)
            throw new SalesDomainException("A cash movement must be a positive amount");

        if (string.IsNullOrWhiteSpace(reason))
            throw new SalesDomainException("A cash movement needs a reason — the count at close has to be explainable");

        Type = type;
        Amount = amount;
        Reason = reason;
        RecordedBy = recordedBy;
        RecordedAt = DateTime.UtcNow;
    }
}
