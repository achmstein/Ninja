#nullable enable
namespace Chillax.Sales.Domain.AggregatesModel.TicketAggregate;

/// <summary>
/// One tender settling (part of) a ticket. Split payments are simply several
/// rows; on cash, anything above the remaining due is change handed back.
/// </summary>
public class Payment : Entity
{
    public PaymentTender Tender { get; private set; }

    public decimal Amount { get; private set; }

    public string RecordedBy { get; private set; } = string.Empty;

    public DateTime RecordedAt { get; private set; }

    protected Payment() { }

    public Payment(PaymentTender tender, decimal amount, string recordedBy)
    {
        if (amount <= 0)
            throw new SalesDomainException("A payment must be a positive amount");

        Tender = tender;
        Amount = amount;
        RecordedBy = recordedBy;
        RecordedAt = DateTime.UtcNow;
    }
}
