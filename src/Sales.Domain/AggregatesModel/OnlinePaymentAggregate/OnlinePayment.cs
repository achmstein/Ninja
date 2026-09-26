#nullable enable
using Ninja.Sales.Domain.Events;
namespace Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate;

/// <summary>How a guest chose their share of the bill.</summary>
public enum SplitMode
{
    /// <summary>Everything that is left.</summary>
    Full = 0,

    /// <summary>The lines they had, each at its share of the total.</summary>
    Items = 1,

    /// <summary>Some of N equal parts of the total.</summary>
    Equal = 2,

    /// <summary>An amount of their own, up to what is left.</summary>
    Custom = 3,
}

public enum OnlinePaymentStatus
{
    /// <summary>Sent to the provider's checkout; its share is held until it is paid, fails or expires.</summary>
    Pending = 0,
    Paid = 1,
    Failed = 2,
    /// <summary>Never finished within the hold; its share is free again.</summary>
    Expired = 3,
    Refunded = 4,
}

/// <summary>
/// A guest paying part or all of a table's bill from their phone, through the
/// café's own payment provider account (Ninja never holds the money). While
/// the provider's checkout is open the share is held, so two guests cannot
/// pay the same items or more than the bill; the provider's signed callback
/// marks it paid or failed. Paid shares become Online payments on the ticket
/// when it is settled, by the till or by itself once they cover it.
/// </summary>
public class OnlinePayment : Entity, IAggregateRoot
{
    /// <summary>How long a checkout holds its share before it is let go.</summary>
    public static readonly TimeSpan Hold = TimeSpan.FromMinutes(15);

    /// <summary>What the guest's phone and the provider know this payment by: unguessable, unlike the id.</summary>
    public Guid Key { get; private set; }

    public int TicketId { get; private set; }

    public int BranchId { get; private set; }

    /// <summary>The guest's share of the bill: what the ticket is paid.</summary>
    public decimal Amount { get; private set; }

    /// <summary>The provider's fee when the café passes it on to the guest; 0 when the café absorbs it.</summary>
    public decimal Fee { get; private set; }

    /// <summary>For the staff; not part of the bill.</summary>
    public decimal Tip { get; private set; }

    public string Currency { get; private set; } = string.Empty;

    public SplitMode Mode { get; private set; }

    /// <summary>The ticket lines an Items share pays for.</summary>
    public List<int> LineIds { get; private set; } = [];

    /// <summary>An Equal share: <see cref="Parts"/> of <see cref="Of"/> equal parts.</summary>
    public int? Parts { get; private set; }

    public int? Of { get; private set; }

    /// <summary>The signed-in customer, or the guest's device id.</summary>
    public string PayerId { get; private set; } = string.Empty;

    public string? PayerName { get; private set; }

    /// <summary>"paymob" for now.</summary>
    public string Provider { get; private set; } = string.Empty;

    /// <summary>The provider's order (Paymob's intention / order id): how its callback finds this payment.</summary>
    public string? ProviderReference { get; private set; }

    /// <summary>The provider's transaction once paid: the idempotency key of its callbacks and the handle for a refund.</summary>
    public string? TransactionId { get; private set; }

    public OnlinePaymentStatus Status { get; private set; }

    public string? FailureReason { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public DateTime ExpiresAt { get; private set; }

    public DateTime? PaidAt { get; private set; }

    public DateTime? RefundedAt { get; private set; }

    public string? RefundedBy { get; private set; }

    /// <summary>What the guest is charged: their share, the fee they carry and their tip.</summary>
    public decimal Charged => Amount + Fee + Tip;

    /// <summary>Holding a share of the bill: paid, or still in checkout at <paramref name="now"/>.</summary>
    public bool Holds(DateTime now)
        => Status == OnlinePaymentStatus.Paid || (Status == OnlinePaymentStatus.Pending && ExpiresAt > now);

    protected OnlinePayment() { }

    public static OnlinePayment Start(
        int ticketId,
        int branchId,
        OnlineShare share,
        decimal fee,
        decimal tip,
        string currency,
        string payerId,
        string? payerName,
        string provider,
        DateTime now)
    {
        if (share.Amount <= 0)
            throw new SalesDomainException("There is nothing to pay.");
        if (fee < 0 || tip < 0)
            throw new SalesDomainException("A fee or a tip cannot be negative.");
        if (string.IsNullOrWhiteSpace(payerId))
            throw new SalesDomainException("A payment needs the guest paying it.");
        if (string.IsNullOrWhiteSpace(provider))
            throw new SalesDomainException("A payment needs its provider.");

        return new OnlinePayment
        {
            Key = Guid.NewGuid(),
            TicketId = ticketId,
            BranchId = branchId,
            Amount = share.Amount,
            Fee = OnlineShares.Money(fee),
            Tip = OnlineShares.Money(tip),
            Currency = currency,
            Mode = share.Mode,
            LineIds = [.. share.LineIds],
            Parts = share.Parts,
            Of = share.Of,
            PayerId = payerId,
            PayerName = string.IsNullOrWhiteSpace(payerName) ? null : payerName.Trim(),
            Provider = provider,
            Status = OnlinePaymentStatus.Pending,
            CreatedAt = now,
            ExpiresAt = now + Hold,
        };
    }

    /// <summary>The provider's order for this checkout, once it made one.</summary>
    public void Opened(string providerReference)
    {
        if (Status != OnlinePaymentStatus.Pending)
            throw new SalesDomainException("Only a checkout in progress can be opened.");
        ProviderReference = providerReference;
    }

    /// <summary>
    /// The provider says it was paid. Late is still paid: the guest's money
    /// moved, so an expired hold is taken back rather than refused. Returns
    /// false when this transaction was already recorded (a repeated callback).
    /// </summary>
    public bool MarkPaid(string transactionId, DateTime at)
    {
        if (Status == OnlinePaymentStatus.Paid)
        {
            if (TransactionId == transactionId) return false;
            throw new SalesDomainException("This payment was already paid by another transaction.");
        }
        if (Status == OnlinePaymentStatus.Refunded)
            throw new SalesDomainException("A refunded payment cannot be paid again.");

        Status = OnlinePaymentStatus.Paid;
        TransactionId = transactionId;
        PaidAt = at;
        FailureReason = null;
        AddDomainEvent(new OnlinePaymentPaidDomainEvent(this));
        return true;
    }

    /// <summary>The provider declined it, or the guest gave up. A failure after a payment changes nothing.</summary>
    public bool MarkFailed(string? reason)
    {
        if (Status != OnlinePaymentStatus.Pending && Status != OnlinePaymentStatus.Expired) return false;
        Status = OnlinePaymentStatus.Failed;
        FailureReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        return true;
    }

    /// <summary>Lets the share go once the hold has run out without a word from the provider.</summary>
    public bool Expire(DateTime now)
    {
        if (Status != OnlinePaymentStatus.Pending || ExpiresAt > now) return false;
        Status = OnlinePaymentStatus.Expired;
        return true;
    }

    /// <summary>Given back through the provider; the share is owed again.</summary>
    public void Refund(string by, DateTime at)
    {
        if (Status != OnlinePaymentStatus.Paid)
            throw new SalesDomainException("Only a paid payment can be refunded.");
        Status = OnlinePaymentStatus.Refunded;
        RefundedBy = by;
        RefundedAt = at;
    }
}
