#nullable enable
namespace Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

/// <summary>
/// One tender settling (part of) a ticket. Split payments are simply several
/// rows; on cash, anything above the remaining due is change handed back.
/// </summary>
public class Payment : Entity
{
    public PaymentTender Tender { get; private set; }

    public decimal Amount { get; private set; }

    public string RecordedBy { get; private set; } = string.Empty;

    /// <summary>
    /// Whose tab an Account payment charges. A shared bill can put Ahmed's
    /// share on his account and Sara's on hers, so the account belongs to the
    /// payment, not to the ticket. Null on every other tender.
    /// </summary>
    public string? CustomerId { get; private set; }

    /// <summary>Display name for <see cref="CustomerId"/>, snapshotted.</summary>
    public string? CustomerName { get; private set; }

    public DateTime RecordedAt { get; private set; }

    /// <summary>
    /// How a bill was paid, in one word for the customer's own screens: the
    /// tender when every payment used the same one, "Mixed" otherwise, "None"
    /// for a bill that needed no money.
    /// </summary>
    public static string DescribeTenders(IEnumerable<Payment> payments)
    {
        var tenders = payments.Select(p => p.Tender).Distinct().ToList();
        return tenders.Count switch
        {
            0 => "None",
            1 => tenders[0].ToString(),
            _ => "Mixed",
        };
    }

    protected Payment() { }

    public Payment(
        PaymentTender tender,
        decimal amount,
        string recordedBy,
        string? customerId = null,
        string? customerName = null)
    {
        if (amount <= 0)
            throw new SalesDomainException("A payment must be a positive amount");

        // A tab charge has to land on exactly one account holder, and no
        // other tender has an account to speak of
        if (tender == PaymentTender.Account && string.IsNullOrWhiteSpace(customerId))
            throw new SalesDomainException("An account payment must say whose account it charges.");

        Tender = tender;
        Amount = amount;
        RecordedBy = recordedBy;
        CustomerId = tender == PaymentTender.Account ? customerId : null;
        CustomerName = tender == PaymentTender.Account ? customerName : null;
        RecordedAt = DateTime.UtcNow;
    }
}
