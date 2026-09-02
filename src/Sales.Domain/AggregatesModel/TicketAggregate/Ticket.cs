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

    /// <summary>
    /// What the bill is called, for humans: the session owner's name at open
    /// time on a room ticket, the name a cashier typed on a counter tab. Never
    /// a customer — the people on a bill are on its lines and payments, each a
    /// snapshot of who ordered or who paid, keyed by account or guest id.
    /// </summary>
    public string? Label { get; private set; }

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

    /// <summary>
    /// The bill as settled, frozen with the rules it was computed under, so
    /// a rate change later never moves a printed receipt. Zero until settle;
    /// an open ticket's figures come from <see cref="GetBill"/>.
    /// </summary>
    public decimal Subtotal { get; private set; }

    public decimal ServiceCharge { get; private set; }

    public decimal Vat { get; private set; }

    /// <summary>What the customer paid: subtotal, service, and VAT when it is added on top.</summary>
    public decimal Total { get; private set; }

    public decimal VatRate { get; private set; }

    public decimal ServiceChargeRate { get; private set; }

    public bool VatIncluded { get; private set; }

    /// <summary>When the last line landed — the floor view shows this as idle time.</summary>
    public DateTime LastActivityAt { get; private set; }

    private readonly List<TicketLine> _lines = [];
    public IReadOnlyCollection<TicketLine> Lines => _lines.AsReadOnly();

    private readonly List<Payment> _payments = [];
    public IReadOnlyCollection<Payment> Payments => _payments.AsReadOnly();

    /// <summary>Menu money: the lines, before service charge and VAT.</summary>
    public decimal GetSubtotal() => _lines.Sum(l => l.Total);

    /// <summary>
    /// What the customer pays. Settled, it is the frozen receipt whatever the
    /// rules say now; open, it is the lines priced under the rules given.
    /// </summary>
    public Bill GetBill(PricingRules rules)
        => Status == TicketStatus.Settled
            ? new Bill(Subtotal, ServiceCharge, Vat, Total, VatIncluded, VatRate, ServiceChargeRate)
            : ComputeBill(rules);

    private Bill ComputeBill(PricingRules rules)
    {
        var subtotal = GetSubtotal();

        // Service is for being served: what is ordered at a table or in a
        // room. A counter sale is not served, and room time is not an order.
        var served = Type == TicketType.Counter
            ? 0m
            : _lines.Where(l => l.Source != TicketLineSource.SessionTime).Sum(l => l.Total);
        var service = Money(Math.Max(0m, served) * rules.ServiceChargeRate);

        // VAT is on everything, service included — either shown out of a
        // price that already holds it, or added on top
        var taxable = subtotal + service;
        var vat = rules.PricesIncludeVat
            ? Money(taxable - taxable / (1 + rules.VatRate))
            : Money(taxable * rules.VatRate);
        var total = rules.PricesIncludeVat ? taxable : taxable + vat;

        return new Bill(subtotal, service, vat, total, rules.PricesIncludeVat, rules.VatRate, rules.ServiceChargeRate);
    }

    private static decimal Money(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);

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

    /// <summary>
    /// Opened when a room session starts (or lazily, if Sales missed the
    /// start). The label is whoever the session was opened for, as they were
    /// named at the time; the room's name stays the headline.
    /// </summary>
    public static Ticket OpenForSession(int sessionId, int roomId, LocalizedText roomName, int branchId, string? label = null)
        => new(TicketType.Room, branchId)
        {
            SessionId = sessionId,
            RoomId = roomId,
            LocationName = roomName,
            Label = CleanLabel(label),
        };

    /// <summary>Opened lazily by a table's first confirmed order (Q7: one open ticket per table).</summary>
    public static Ticket OpenForTable(int tableId, LocalizedText? tableName, int branchId)
        => new(TicketType.Table, branchId)
        {
            TableId = tableId,
            LocationName = tableName,
        };

    /// <summary>
    /// One counter sale — a POS walk-in, or an order-ahead paid at the
    /// counter. A counter tab has no place, so the label is its only name.
    /// </summary>
    public static Ticket OpenForCounter(int branchId, string? label = null)
        => new(TicketType.Counter, branchId)
        {
            Label = CleanLabel(label),
        };

    private static string? CleanLabel(string? label)
        => string.IsNullOrWhiteSpace(label) ? null : label.Trim();

    /// <summary>
    /// Append a confirmed order's lines. Idempotent by order id — the event
    /// bus promises at-least-once, so a redelivered confirmation is a no-op.
    /// </summary>
    public void AppendOrder(
        int orderId,
        IEnumerable<TicketLine> lines,
        double loyaltyDiscount,
        LocalizedText? loyaltyDiscountLabel = null,
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

        // The label is deliberately left alone: it names the bill — the
        // session's owner, the name a cashier gave a tab — and a shared table
        // belongs to the table, not to whoever ordered first. Who ordered what
        // is on the lines. Only the contact route is worth learning here.
        GuestPhone ??= guestPhone;

        Touch();
    }

    /// <summary>
    /// Append the authoritative time lines when the session completes.
    /// Idempotent — time lands exactly once, rounding stays owned by Spaces.
    /// The time is the session owner's, so the lines carry their account the
    /// way an order's lines carry the person who ordered: a room that only
    /// bought time can still go on its owner's tab at settle.
    /// </summary>
    public void AppendSessionTime(
        decimal singleHours,
        decimal singleCost,
        decimal multiHours,
        decimal multiCost,
        string? customerId = null,
        string? customerName = null)
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
                unitPrice: singleHours == 0 ? 0 : singleCost / singleHours,
                customerName: customerName,
                customerId: customerId));
        }

        if (multiHours > 0)
        {
            _lines.Add(new TicketLine(
                TicketLineSource.SessionTime,
                new LocalizedText("Room time — Multi", "وقت الأوضة — ملتي"),
                qty: multiHours,
                unitPrice: multiHours == 0 ? 0 : multiCost / multiHours,
                customerName: customerName,
                customerId: customerId));
        }

        Touch();
    }

    public void AddManualLine(LocalizedText description, decimal qty, decimal unitPrice, decimal discount, string addedBy, string? customerName = null)
    {
        EnsureOpen();

        _lines.Add(new TicketLine(TicketLineSource.Manual, description, qty, unitPrice, discount, addedBy: addedBy, customerName: customerName));

        Touch();
    }

    /// <summary>
    /// Settle the ticket: payments must cover the total (anything above it on
    /// cash is change), the ticket freezes, and a receipt can be issued.
    /// </summary>
    /// <returns>Change due back to the customer.</returns>
    public decimal Settle(IReadOnlyCollection<Payment> payments, string settledBy, int? shiftId = null, PricingRules? rules = null)
    {
        EnsureOpen();

        if (_lines.Count == 0)
            throw new SalesDomainException("An empty ticket has nothing to settle — discard it instead.");

        if (payments.Count == 0)
            throw new SalesDomainException("Settling a ticket takes at least one payment.");

        // Priced under the branch's rules as they stand at this moment, and
        // frozen below: this is the receipt
        var bill = ComputeBill(rules ?? PricingRules.None);
        var total = bill.Total;
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

        // Each account payment names its own tab (Payment enforces that), so a
        // shared bill can charge several: a table belongs to the table, and
        // the people who ordered on it may each have an account of their own.

        _payments.AddRange(payments);
        Status = TicketStatus.Settled;
        SettledAt = DateTime.UtcNow;
        SettledBy = settledBy;
        ShiftId = shiftId;
        ChangeGiven = overpaid;

        Subtotal = bill.Subtotal;
        ServiceCharge = bill.ServiceCharge;
        Vat = bill.Vat;
        Total = bill.Total;
        VatRate = bill.VatRate;
        ServiceChargeRate = bill.ServiceChargeRate;
        VatIncluded = bill.VatIncluded;

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
    /// Throw away an open ticket nothing ever landed on — a counter sale
    /// opened for a walk-in who changed their mind, a table bill started for
    /// a group that never ordered. Lines only accumulate — a move that empties
    /// a table or counter ticket discards it in the same transaction — so a
    /// ticket with none provably has no history:
    /// there is nothing for a void reason to record, and any cashier may do
    /// it. Room tickets are exempt — they follow their session, whose time
    /// lands on them at the end.
    /// </summary>
    public void Discard()
    {
        if (Type == TicketType.Room)
            throw new SalesDomainException("Room tickets follow their session and cannot be discarded.");

        DiscardEmpty();
    }

    /// <summary>
    /// The one way a Room ticket goes: its session was cancelled — a wrong
    /// room started, a group that changed its mind — so no time will ever
    /// land on it. Only while still empty; once it carries lines, someone
    /// has to look at it (settle, or void).
    /// </summary>
    public void DiscardForCancelledSession()
    {
        if (Type != TicketType.Room)
            throw new SalesDomainException("Only a room ticket follows a session.");

        DiscardEmpty();
    }

    private void DiscardEmpty()
    {
        EnsureOpen();

        if (_lines.Count > 0)
            throw new SalesDomainException("Only an empty ticket can be discarded — this one has lines; void it instead.");

        // The nudge still goes out: the dispatcher reads events off every
        // tracked entry, deleted ones included, so the floor drops the tile
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

        // A fresh LocalizedText, never this ticket's own instance: the name is
        // an owned entity whose key includes the id of the ticket it hangs
        // off, so handing the tracked one to a second ticket asks EF to
        // change part of a key and it refuses.
        var target = Type switch
        {
            TicketType.Table => OpenForTable(
                TableId!.Value,
                LocationName is null ? null : new LocalizedText(LocationName.En, LocationName.Ar),
                BranchId),
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

    /// <summary>
    /// Move lines onto another open ticket — the customer who ordered at a
    /// table and then took a room, a friend's coffee onto their own bill. Any
    /// target type will do; orders land on room tickets all the time. Session
    /// time never moves: it belongs to the session. A table or counter source
    /// left empty is discarded by the caller in the same transaction, so an
    /// empty ticket still never carries history.
    /// </summary>
    public void MoveLinesTo(Ticket target, IReadOnlyCollection<int> lineIds)
    {
        EnsureOpen();
        target.EnsureOpen();

        if (ReferenceEquals(target, this))
            throw new SalesDomainException("A ticket cannot receive its own lines.");

        if (target.BranchId != BranchId)
            throw new SalesDomainException("Lines only move between tickets of the same branch.");

        var moving = _lines.Where(l => lineIds.Contains(l.Id)).ToList();

        if (moving.Count == 0)
            throw new SalesDomainException("None of the given lines are on this ticket.");

        if (moving.Any(l => l.Source == TicketLineSource.SessionTime))
            throw new SalesDomainException("Session time stays on the session's ticket.");

        foreach (var line in moving)
        {
            _lines.Remove(line);
            target._lines.Add(line);
        }

        Touch();
        target.Touch();
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
