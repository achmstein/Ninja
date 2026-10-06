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

/// <summary>
/// Money a payment still has to move at the provider. Recorded first, in the same save as what
/// decided it (the order accepted, cancelled; a refund asked for), then made, outside any
/// transaction, and its outcome recorded: a move is never lost to a save that failed after the
/// provider acted, nor made twice because nobody wrote down that it was.
/// </summary>
public enum PaymentMove
{
    None = 0,
    /// <summary>Charge the hold: the order it pays was accepted.</summary>
    Capture = 1,
    /// <summary>Let the hold go uncharged: the order will not be made.</summary>
    Void = 2,
    /// <summary>Give back what was charged.</summary>
    Refund = 3,
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
    /// <summary>
    /// The card is held for the amount, not yet charged (an order paid ahead, until the branch accepts
    /// it): captured then (<see cref="OnlinePayment.MarkCaptured"/>), or voided (<see cref="OnlinePayment.Void"/>),
    /// which lets the hold go at no cost. The provider lets an uncaptured hold go by itself after a while.
    /// </summary>
    Authorized = 5,
    /// <summary>A hold let go before it was charged: nothing was ever taken from the customer.</summary>
    Voided = 6,
}

/// <summary>
/// A guest paying part or all of a table's bill from their phone, through the
/// business's own payment provider account (Ninja never holds the money). While
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

    /// <summary>
    /// The bill it pays. Null for an order paid ahead (<see cref="OrderId"/>)
    /// until the order is confirmed and its bill opens (<see cref="AttachToTicket"/>).
    /// </summary>
    public int? TicketId { get; private set; }

    /// <summary>
    /// An order paid ahead online, in the app, before the business saw it:
    /// the payment is for the whole order, and lands on the order's own bill
    /// once it is confirmed. Null for a share of a bill.
    /// </summary>
    public int? OrderId { get; private set; }

    public int BranchId { get; private set; }

    /// <summary>The guest's share of the bill: what the ticket is paid.</summary>
    public decimal Amount { get; private set; }

    /// <summary>The provider's fee when the business passes it on to the guest; 0 when the business absorbs it.</summary>
    public decimal Fee { get; private set; }

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

    /// <summary>When the money was taken: the payment itself, or the capture of a hold.</summary>
    public DateTime? PaidAt { get; private set; }

    /// <summary>
    /// The checkout asked to hold the card rather than charge it (an order paid ahead, where the
    /// business has a card integration that holds). Whether it did is the provider's to say: a wallet
    /// is charged at once whatever was asked.
    /// </summary>
    public bool CardHold { get; private set; }

    /// <summary>When the provider held the card for it; null for a payment charged at once.</summary>
    public DateTime? AuthorizedAt { get; private set; }

    /// <summary>When a hold was let go uncharged.</summary>
    public DateTime? VoidedAt { get; private set; }

    /// <summary>Held or taken: the customer's money is secured for what it pays.</summary>
    public bool Secured => Status is OnlinePaymentStatus.Paid or OnlinePaymentStatus.Authorized;

    public DateTime? RefundedAt { get; private set; }

    public string? RefundedBy { get; private set; }

    /// <summary>What the guest is charged: their share and the fee they carry.</summary>
    public decimal Charged => Amount + Fee;

    /// <summary>The money still to move at the provider; None when there is none.</summary>
    public PaymentMove Move { get; private set; }

    /// <summary>Who asked for <see cref="Move"/>: a cashier, or "ordering" for a move the order decided.</summary>
    public string? MoveBy { get; private set; }

    /// <summary>Why: the cancellation's reason, or the refund's.</summary>
    public string? MoveReason { get; private set; }

    /// <summary>How many times the provider was asked and did not do it.</summary>
    public int MoveAttempts { get; private set; }

    /// <summary>When it is next tried; null while it is not waiting on a retry.</summary>
    public DateTime? MoveDueAt { get; private set; }

    /// <summary>
    /// Whoever is making the move holds it until then: two workers (or the request that decided it
    /// and the retry worker) never ask the provider for the same move at once.
    /// </summary>
    public DateTime? MoveLeasedUntil { get; private set; }

    /// <summary>What went wrong last, in the provider's words or ours, for the owner.</summary>
    public string? Problem { get; private set; }

    /// <summary>
    /// Since when it waits on the owner: a move that keeps failing, or the provider's records
    /// disagreeing with ours. Null when all is well.
    /// </summary>
    public DateTime? AttentionSince { get; private set; }

    /// <summary>When the provider was last asked how it stands (a checkout whose callback is late, the daily check).</summary>
    public DateTime? CheckedAt { get; private set; }

    /// <summary>Failures in a row after which the owner is told; the move is still tried, less often.</summary>
    public const int AttentionAfter = 5;

    /// <summary>How long a failed move waits before the next try: quick at first, then hourly.</summary>
    public static TimeSpan Backoff(int attempts) => attempts switch
    {
        <= 1 => TimeSpan.FromSeconds(30),
        2 => TimeSpan.FromMinutes(1),
        3 => TimeSpan.FromMinutes(2),
        4 => TimeSpan.FromMinutes(5),
        5 => TimeSpan.FromMinutes(10),
        6 => TimeSpan.FromMinutes(30),
        _ => TimeSpan.FromHours(1),
    };

    /// <summary>
    /// The order it pays was accepted: its hold is to be charged. A payment charged at once has
    /// nothing to move. Idempotent.
    /// </summary>
    public bool RequestCapture(string by, DateTime now)
    {
        if (Status != OnlinePaymentStatus.Authorized) return false;
        if (Move == PaymentMove.Capture) return false;
        if (Move != PaymentMove.None)
            throw new SalesDomainException("This payment is being given back; it cannot be charged.");
        return Request(PaymentMove.Capture, by, null, now);
    }

    /// <summary>
    /// What this payment took is to go back: a hold is let go (a charge asked for and not yet made
    /// gives way to it), a charge is refunded, a checkout still open is closed. False when there is
    /// no money to move. Idempotent.
    /// </summary>
    public bool RequestGiveBack(string by, string reason, DateTime now)
    {
        switch (Status)
        {
            case OnlinePaymentStatus.Pending:
                Cancel(reason);
                return false;
            case OnlinePaymentStatus.Authorized when Move != PaymentMove.Void:
                return Request(PaymentMove.Void, by, reason, now);
            case OnlinePaymentStatus.Paid when Move != PaymentMove.Refund:
                if (TransactionId is null)
                    throw new SalesDomainException("This payment has no transaction to refund; refund it from the provider's dashboard.");
                return Request(PaymentMove.Refund, by, reason, now);
            default:
                return false;
        }
    }

    private bool Request(PaymentMove move, string by, string? reason, DateTime now)
    {
        Move = move;
        MoveBy = by;
        MoveReason = reason;
        MoveAttempts = 0;
        MoveDueAt = now;
        MoveLeasedUntil = null;
        Problem = null;
        return true;
    }

    /// <summary>
    /// The provider did not make the move. A failure that may pass (it did not answer, or was busy)
    /// is tried again after <see cref="Backoff"/>; one it refused outright is not, and waits on the
    /// owner at once. Either way the owner is told once it keeps failing.
    /// </summary>
    public void MoveFailed(string problem, bool retry, DateTime now)
    {
        if (Move == PaymentMove.None) return;
        MoveAttempts++;
        Problem = problem.Length > 500 ? problem[..500] : problem;
        MoveLeasedUntil = null;
        MoveDueAt = retry ? now + Backoff(MoveAttempts) : null;
        if (!retry || MoveAttempts >= AttentionAfter)
            AttentionSince ??= now;
    }

    /// <summary>
    /// A move a person asked for that the provider refused outright: dropped, and they are told then and
    /// there; it is not left for the owner.
    /// </summary>
    public void DropMove(string problem)
    {
        Move = PaymentMove.None;
        MoveDueAt = null;
        MoveLeasedUntil = null;
        MoveAttempts = 0;
        Problem = problem.Length > 500 ? problem[..500] : problem;
    }

    /// <summary>The owner asks for the move to be tried now, or a move that was refused to be tried again.</summary>
    public void RetryMoveNow(DateTime now)
    {
        if (Move == PaymentMove.None)
            throw new SalesDomainException("There is nothing to retry on this payment.");
        MoveDueAt = now;
        MoveLeasedUntil = null;
    }

    private void MoveDone()
    {
        Move = PaymentMove.None;
        MoveDueAt = null;
        MoveLeasedUntil = null;
        MoveAttempts = 0;
        Problem = null;
        AttentionSince = null;
    }

    /// <summary>The provider says something we did not expect of it; the owner is shown why.</summary>
    public void NeedsAttention(string problem, DateTime now)
    {
        Problem = problem.Length > 500 ? problem[..500] : problem;
        AttentionSince ??= now;
    }

    /// <summary>The owner has seen to it (in the provider's dashboard, or decided it is fine).</summary>
    public void Dismiss()
    {
        if (Move != PaymentMove.None)
            throw new SalesDomainException("Money is still to move on this payment: retry it, or mark it done once it is done in the provider's dashboard.");
        AttentionSince = null;
        Problem = null;
    }

    /// <summary>The provider was asked how it stands.</summary>
    public void Checked(DateTime now) => CheckedAt = now;

    /// <summary>Holding a share of the bill: paid, or still in checkout at <paramref name="now"/>.</summary>
    public bool Holds(DateTime now)
        => Secured || (Status == OnlinePaymentStatus.Pending && ExpiresAt > now);

    protected OnlinePayment() { }

    public static OnlinePayment Start(
        int ticketId,
        int branchId,
        OnlineShare share,
        decimal fee,
        string currency,
        string payerId,
        string? payerName,
        string provider,
        DateTime now)
    {
        if (share.Amount <= 0)
            throw new SalesDomainException("There is nothing to pay.");
        if (fee < 0)
            throw new SalesDomainException("A fee cannot be negative.");
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

    /// <summary>
    /// Paying an order ahead: the whole of it, before it has a bill. Held
    /// as a share of a bill is (<see cref="Hold"/>), so a second checkout for
    /// the same order is refused while this one is open.
    /// </summary>
    public static OnlinePayment StartForOrder(
        int orderId,
        int branchId,
        decimal amount,
        decimal fee,
        string currency,
        string payerId,
        string? payerName,
        string provider,
        DateTime now,
        bool hold = false)
    {
        if (orderId <= 0)
            throw new SalesDomainException("A payment ahead needs its order.");
        var payment = Start(0, branchId, new OnlineShare(SplitMode.Full, OnlineShares.Money(amount), [], null, null), fee, currency, payerId, payerName, provider, now);
        payment.TicketId = null;
        payment.OrderId = orderId;
        payment.CardHold = hold;
        return payment;
    }

    /// <summary>
    /// An order paid ahead was confirmed and its bill opened: the payment is
    /// that bill's from now on, and settles it. Idempotent for the same bill.
    /// </summary>
    public void AttachToTicket(int ticketId)
    {
        if (OrderId is null)
            throw new SalesDomainException("Only a payment for an order is put on its bill.");
        if (TicketId is { } current && current != ticketId)
            throw new SalesDomainException("This payment is on another bill already.");
        TicketId = ticketId;
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
        if (Status is OnlinePaymentStatus.Refunded or OnlinePaymentStatus.Authorized or OnlinePaymentStatus.Voided)
            throw new SalesDomainException($"A payment {Status.ToString().ToLowerInvariant()} already cannot be paid by another transaction.");

        Status = OnlinePaymentStatus.Paid;
        TransactionId = transactionId;
        PaidAt = at;
        FailureReason = null;
        AddDomainEvent(new OnlinePaymentPaidDomainEvent(this));
        return true;
    }

    /// <summary>
    /// The provider held the card for it (an authorization), without charging it yet. Late is still
    /// held, as late is still paid. Returns false when this authorization was already recorded.
    /// </summary>
    public bool MarkAuthorized(string transactionId, DateTime at)
    {
        if (Status == OnlinePaymentStatus.Authorized)
        {
            if (TransactionId == transactionId) return false;
            throw new SalesDomainException("This payment was already held by another transaction.");
        }
        if (Status is not (OnlinePaymentStatus.Pending or OnlinePaymentStatus.Failed or OnlinePaymentStatus.Expired))
        {
            if (TransactionId == transactionId) return false; // the hold's own callback, after it was captured or let go
            throw new SalesDomainException($"A payment {Status.ToString().ToLowerInvariant()} already cannot be held by another transaction.");
        }

        Status = OnlinePaymentStatus.Authorized;
        TransactionId = transactionId;
        AuthorizedAt = at;
        FailureReason = null;
        return true;
    }

    /// <summary>
    /// The hold was captured at the provider: the money is taken now. Returns false when it was
    /// already (a capture repeated after an answer that never came back).
    /// </summary>
    public bool MarkCaptured(DateTime at)
    {
        if (Status == OnlinePaymentStatus.Paid && AuthorizedAt is not null) return false;
        if (Status != OnlinePaymentStatus.Authorized)
            throw new SalesDomainException("Only a held payment can be captured.");
        Status = OnlinePaymentStatus.Paid;
        PaidAt = at;
        if (Move == PaymentMove.Capture) MoveDone();
        AddDomainEvent(new OnlinePaymentPaidDomainEvent(this));
        return true;
    }

    /// <summary>
    /// The hold was let go at the provider before anything was charged. Returns false when it was
    /// already.
    /// </summary>
    public bool Void(string by, DateTime at)
    {
        if (Status == OnlinePaymentStatus.Voided) return false;
        if (Status != OnlinePaymentStatus.Authorized)
            throw new SalesDomainException("Only a held payment can be let go; a paid one is refunded.");
        Status = OnlinePaymentStatus.Voided;
        RefundedBy = by;
        VoidedAt = at;
        if (Move is PaymentMove.Void or PaymentMove.Capture) MoveDone();
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

    /// <summary>
    /// The guest walked away from the checkout, or the till let the share
    /// go: it is free again at once instead of when the hold runs out. If the
    /// provider still reports it paid, it is paid (<see cref="MarkPaid"/>).
    /// </summary>
    public bool Cancel(string reason)
    {
        if (Status != OnlinePaymentStatus.Pending) return false;
        Status = OnlinePaymentStatus.Failed;
        FailureReason = reason;
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
        if (Move == PaymentMove.Refund) MoveDone();
    }
}
