#nullable enable
using Chillax.Sales.Domain.Events;

namespace Chillax.Sales.Domain.AggregatesModel.TicketAggregate;

/// <summary>
/// Ticket aggregate root — the open check for one visit: a room session, a
/// table sitting, or a single counter sale.
///
/// Tickets are assembled purely from integration events (docs/pos-plan.md D2,
/// D5b): Spaces stays the time authority, Ordering the order authority, Catalog
/// the price authority. This aggregate only composes what they said and settles
/// it. It never reaches into another service.
/// </summary>
public class Ticket : Entity, IAggregateRoot
{
    public TicketType Type { get; private set; }

    public TicketStatus Status { get; private set; }

    public int BranchId { get; private set; }

    /// <summary>The Spaces session a Room ticket bills.</summary>
    public int? SessionId { get; private set; }

    public int? RoomId { get; private set; }

    /// <summary>The café table a Table ticket accumulates for.</summary>
    public int? TableId { get; private set; }

    /// <summary>Room or table name snapshot for display and receipts.</summary>
    public LocalizedText? LocationName { get; private set; }

    /// <summary>Identity of the customer behind the visit, when known.</summary>
    public string? CustomerId { get; private set; }

    public string? CustomerName { get; private set; }

    /// <summary>Phone a guest left at checkout — the only way to reach them.</summary>
    public string? GuestPhone { get; private set; }

    public DateTime OpenedAt { get; private set; }

    public DateTime? SettledAt { get; private set; }

    public string? SettledBy { get; private set; }

    /// <summary>
    /// The drawer shift this settle was attributed to — the branch's open
    /// shift at settle time, or null when none was open (a shift never blocks
    /// selling). X/Z reports aggregate tickets by this.
    /// </summary>
    public int? ShiftId { get; private set; }

    public DateTime? VoidedAt { get; private set; }

    public string? VoidedBy { get; private set; }

    /// <summary>
    /// Why nothing was owed — the audit trail a void exists to leave.
    /// </summary>
    public string? VoidReason { get; private set; }

    /// <summary>
    /// Cash handed back at settle. Recorded so drawer math is a column sum,
    /// not a re-derivation of every ticket's payment arithmetic.
    /// </summary>
    public decimal ChangeGiven { get; private set; }

    /// <summary>When the last line landed — the floor view shows this as idle time.</summary>
    public DateTime LastActivityAt { get; private set; }

    private readonly List<TicketLine> _lines = [];
    public IReadOnlyCollection<TicketLine> Lines => _lines.AsReadOnly();

    private readonly List<Payment> _payments = [];
    public IReadOnlyCollection<Payment> Payments => _payments.AsReadOnly();

    public decimal GetTotal() => _lines.Sum(l => l.Total);

    public decimal GetPaid() => _payments.Sum(p => p.Amount);

    protected Ticket() { }

    private Ticket(TicketType type, int branchId)
    {
        Type = type;
        Status = TicketStatus.Open;
        BranchId = branchId;
        OpenedAt = DateTime.UtcNow;
        LastActivityAt = OpenedAt;

        AddDomainEvent(new TicketChangedDomainEvent(this));
    }

    /// <summary>Opened when a room session starts (or lazily, if Sales missed the start).</summary>
    public static Ticket OpenForSession(int sessionId, int roomId, LocalizedText roomName, int branchId, string? customerId, string? customerName)
        => new(TicketType.Room, branchId)
        {
            SessionId = sessionId,
            RoomId = roomId,
            LocationName = roomName,
            CustomerId = customerId,
            CustomerName = customerName,
        };

    /// <summary>Opened lazily by a table's first confirmed order (Q7: one open ticket per table).</summary>
    public static Ticket OpenForTable(int tableId, LocalizedText? tableName, int branchId)
        => new(TicketType.Table, branchId)
        {
            TableId = tableId,
            LocationName = tableName,
        };

    /// <summary>One counter sale — a POS walk-in, or an order-ahead paid at the counter.</summary>
    public static Ticket OpenForCounter(int branchId, string? customerId = null, string? customerName = null)
        => new(TicketType.Counter, branchId)
        {
            CustomerId = customerId,
            CustomerName = customerName,
        };

    /// <summary>
    /// Append a confirmed order's lines. Idempotent by order id — the event
    /// bus promises at-least-once, so a redelivered confirmation is a no-op.
    /// </summary>
    public void AppendOrder(
        int orderId,
        IEnumerable<TicketLine> lines,
        double loyaltyDiscount,
        LocalizedText? loyaltyDiscountLabel = null,
        string? customerName = null,
        string? guestPhone = null)
    {
        EnsureOpen();

        if (_lines.Any(l => l.OrderId == orderId))
            return;

        foreach (var line in lines)
        {
            line.MarkFromOrder(orderId);
            _lines.Add(line);
        }

        // The redeemed points print as their own negative line so the receipt
        // shows the discount instead of silently shrinking item prices
        if (loyaltyDiscount > 0)
        {
            _lines.Add(new TicketLine(
                TicketLineSource.Order,
                loyaltyDiscountLabel ?? new LocalizedText("Loyalty discount", "خصم نقاط الولاء"),
                qty: 1,
                unitPrice: -(decimal)loyaltyDiscount,
                orderId: orderId));
        }

        // A table ticket learns who is sitting there from the first order
        // that says so; a name never overwrites one already known
        CustomerName ??= customerName;
        GuestPhone ??= guestPhone;

        Touch();
    }

    /// <summary>
    /// Append the authoritative time lines when the session completes.
    /// Idempotent — time lands exactly once, rounding stays owned by Spaces.
    /// </summary>
    public void AppendSessionTime(decimal singleHours, decimal singleCost, decimal multiHours, decimal multiCost)
    {
        EnsureOpen();

        if (_lines.Any(l => l.Source == TicketLineSource.SessionTime))
            return;

        if (singleHours > 0)
        {
            _lines.Add(new TicketLine(
                TicketLineSource.SessionTime,
                new LocalizedText("Room time — Single", "وقت الأوضة — سينجل"),
                qty: singleHours,
                unitPrice: singleHours == 0 ? 0 : singleCost / singleHours));
        }

        if (multiHours > 0)
        {
            _lines.Add(new TicketLine(
                TicketLineSource.SessionTime,
                new LocalizedText("Room time — Multi", "وقت الأوضة — ملتي"),
                qty: multiHours,
                unitPrice: multiHours == 0 ? 0 : multiCost / multiHours));
        }

        Touch();
    }

    public void AddManualLine(LocalizedText description, decimal qty, decimal unitPrice, decimal discount, string addedBy)
    {
        EnsureOpen();

        _lines.Add(new TicketLine(TicketLineSource.Manual, description, qty, unitPrice, discount, addedBy: addedBy));

        Touch();
    }

    /// <summary>
    /// Settle the ticket: payments must cover the total (anything above it on
    /// cash is change), the ticket freezes, and a receipt can be issued.
    /// </summary>
    /// <returns>Change due back to the customer.</returns>
    public decimal Settle(IReadOnlyCollection<Payment> payments, string settledBy, int? shiftId = null)
    {
        EnsureOpen();

        if (_lines.Count == 0)
            throw new SalesDomainException("An empty ticket has nothing to settle — void it instead.");

        if (payments.Count == 0)
            throw new SalesDomainException("Settling a ticket takes at least one payment.");

        var total = GetTotal();
        var tendered = payments.Sum(p => p.Amount);

        if (tendered < total)
            throw new SalesDomainException($"Payments ({tendered:0.00}) do not cover the ticket total ({total:0.00}).");

        // Change only makes sense on cash — card, wallet and account tenders
        // charge exact, so together they can never exceed the total (nobody
        // gets cash back out of their account tab)
        var overpaid = tendered - total;
        var nonCash = payments.Where(p => p.Tender != PaymentTender.Cash).Sum(p => p.Amount);
        if (nonCash > total)
            throw new SalesDomainException("Only cash payments can exceed the total (change).");

        // Settling onto an account tab charges a real customer's balance —
        // an anonymous ticket has no tab to charge
        if (payments.Any(p => p.Tender == PaymentTender.Account) && string.IsNullOrEmpty(CustomerId))
            throw new SalesDomainException("Settling on account requires a customer attached to the ticket.");

        _payments.AddRange(payments);
        Status = TicketStatus.Settled;
        SettledAt = DateTime.UtcNow;
        SettledBy = settledBy;
        ShiftId = shiftId;
        ChangeGiven = overpaid;

        AddDomainEvent(new TicketSettledDomainEvent(this));

        return overpaid;
    }

    /// <summary>
    /// Cancel an open ticket with nothing owed — a mistake, a comp, a group
    /// that walked. Owner-gated at the API: the reason is the audit trail,
    /// and the lines stay exactly as they were for anyone reviewing it.
    /// A settled ticket can never be voided; taking money back is a refund,
    /// which is a different, deliberate thing.
    /// </summary>
    public void Void(string reason, string voidedBy)
    {
        EnsureOpen();

        if (string.IsNullOrWhiteSpace(reason))
            throw new SalesDomainException("Voiding a ticket needs a reason — that is the whole audit trail.");

        Status = TicketStatus.Voided;
        VoidReason = reason;
        VoidedBy = voidedBy;
        VoidedAt = DateTime.UtcNow;

        AddDomainEvent(new TicketChangedDomainEvent(this));
    }

    /// <summary>
    /// Move lines onto a fresh open ticket for the same place — the turnover
    /// guard: an order that landed on the previous group's bill gets its own.
    /// </summary>
    public Ticket MoveLines(IReadOnlyCollection<int> lineIds)
    {
        EnsureOpen();

        if (Type == TicketType.Room)
            throw new SalesDomainException("Room tickets follow their session and cannot be split this way.");

        var moving = _lines.Where(l => lineIds.Contains(l.Id)).ToList();

        if (moving.Count == 0)
            throw new SalesDomainException("None of the given lines are on this ticket.");

        if (moving.Count == _lines.Count)
            throw new SalesDomainException("Moving every line would leave an empty ticket — settle or reuse this one instead.");

        var target = Type switch
        {
            TicketType.Table => OpenForTable(TableId!.Value, LocationName, BranchId),
            _ => OpenForCounter(BranchId),
        };

        foreach (var line in moving)
        {
            _lines.Remove(line);
            target._lines.Add(line);
        }

        Touch();
        target.Touch();

        return target;
    }

    private void EnsureOpen()
    {
        if (Status != TicketStatus.Open)
            throw new SalesDomainException($"Ticket {Id} is {Status} and cannot change.");
    }

    private void Touch()
    {
        LastActivityAt = DateTime.UtcNow;
        AddDomainEvent(new TicketChangedDomainEvent(this));
    }
}
