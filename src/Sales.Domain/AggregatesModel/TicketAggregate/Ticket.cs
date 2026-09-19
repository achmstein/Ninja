#nullable enable
using Ninja.Sales.Domain.Events;

namespace Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

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

    /// <summary>
    /// The customers who sat in the room: the session's customer and everyone
    /// who joined by its QR, noted from Spaces' events. Together with the
    /// customers on the lines and payments, these are the people the bill
    /// belongs to — the ones who may read its receipt.
    /// </summary>
    public List<string> MemberIds { get; private set; } = [];

    /// <summary>
    /// When the Room ticket's session stopped running: its time landed, or it
    /// was cancelled. Null while it runs — and while it runs the ticket can be
    /// neither settled nor voided, because the time is not on the bill yet.
    /// </summary>
    public DateTime? SessionEndedAt { get; private set; }

    /// <summary>
    /// The Spaces place this bill is for — a room, a table, a station. Null
    /// on a counter sale.
    /// </summary>
    public int? PlaceId { get; private set; }

    /// <summary>"Room", "Table" or "Station", as Spaces names it.</summary>
    public string? PlaceKind { get; private set; }

    /// <summary>Place name snapshot for display and receipts.</summary>
    public LocalizedText? LocationName { get; private set; }

    /// <summary>
    /// A bill with a Spaces stay on it: its time lands when the clock stops.
    /// Every rule about "the session" keys on this, not on the ticket type,
    /// so a timed table follows the same rules as a room.
    /// </summary>
    public bool HasSession => SessionId != null;

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
    /// The number a till printed on the receipt while it was offline, kept
    /// beside the real receipt number so the two copies can be matched.
    /// </summary>
    public string? ProvisionalReceiptNumber { get; private set; }

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

    /// <summary>
    /// The bill discount: money taken off the whole ticket by the till. A
    /// percent discount follows the lines while the ticket is open — this
    /// holds the money it came to at settle; a fixed one holds what was
    /// entered. Zero when none was given.
    /// </summary>
    public decimal Discount { get; private set; }

    /// <summary>The rate behind <see cref="Discount"/> as a fraction; null for a fixed amount, or none.</summary>
    public decimal? DiscountRate { get; private set; }

    /// <summary>Why — the audit trail a discount exists to leave.</summary>
    public string? DiscountReason { get; private set; }

    public string? DiscountBy { get; private set; }

    public DateTime? DiscountAt { get; private set; }

    public bool HasDiscount => DiscountRate is not null || Discount > 0;

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
    /// Menu money per order on this ticket: every line that came from the
    /// order, its loyalty discount line included. A share of the order when
    /// some of its lines were moved to another bill. The base Loyalty
    /// reverses against when money goes back or the ticket is voided, so a
    /// refund and a void report the same figure.
    /// </summary>
    public IReadOnlyDictionary<int, decimal> GetAmountByOrder()
        => _lines
            .Where(l => l.OrderId is not null)
            .GroupBy(l => l.OrderId!.Value)
            .ToDictionary(g => g.Key, g => g.Sum(l => l.Total));

    /// <summary>
    /// What the customer pays. Settled, it is the frozen receipt whatever the
    /// rules say now; open, it is the lines priced under the rules given.
    /// </summary>
    public Bill GetBill(PricingRules rules)
        => Status == TicketStatus.Settled
            ? new Bill(Subtotal, Discount, ServiceCharge, Vat, Total, VatIncluded, VatRate, ServiceChargeRate)
            : ComputeBill(rules);

    private Bill ComputeBill(PricingRules rules)
    {
        var subtotal = GetSubtotal();

        // The bill discount comes off the menu money first: a percent follows
        // the lines as they land, a fixed amount never exceeds what is there
        var discount = subtotal <= 0
            ? 0m
            : DiscountRate is { } rate
                ? Money(subtotal * rate)
                : Math.Min(Discount, subtotal);
        var discounted = subtotal - discount;

        // Service is for being served: what is ordered at a table or in a
        // room. A counter sale is not served, and room time is not an order.
        // The discount thins every line alike, so the served part shrinks by
        // the same share.
        var served = Type == TicketType.Counter
            ? 0m
            : _lines.Where(l => l.Source != TicketLineSource.SessionTime).Sum(l => l.Total);
        if (subtotal > 0)
            served *= discounted / subtotal;
        var service = Money(Math.Max(0m, served) * rules.ServiceChargeRate);

        // VAT is on everything, service included — either shown out of a
        // price that already holds it, or added on top
        var taxable = discounted + service;
        var vat = rules.PricesIncludeVat
            ? Money(taxable - taxable / (1 + rules.VatRate))
            : Money(taxable * rules.VatRate);
        var total = rules.PricesIncludeVat ? taxable : taxable + vat;

        return new Bill(subtotal, discount, service, vat, total, rules.PricesIncludeVat, rules.VatRate, rules.ServiceChargeRate);
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
    /// Opened when a stay's clock starts (or lazily, if Sales missed the
    /// start). Named by its place, like a table's bill by its table — never
    /// by a person: who is there is the stay's roster, and whose share is
    /// whose is decided at settle. A room's stay is a Room ticket; a timed
    /// table's is a Table ticket that follows its session all the same.
    /// </summary>
    public static Ticket OpenForSession(int sessionId, int placeId, LocalizedText placeName, int branchId, string placeKind = "Room")
    {
        var isRoom = string.Equals(placeKind, "Room", StringComparison.OrdinalIgnoreCase);
        return new(isRoom ? TicketType.Room : TicketType.Table, branchId)
        {
            SessionId = sessionId,
            PlaceId = placeId,
            PlaceKind = placeKind,
            LocationName = placeName,
        };
    }

    /// <summary>
    /// Opened lazily by a table's first confirmed order, or by the till (Q7:
    /// one open ticket per table). The place is the table as Spaces knows it.
    /// </summary>
    public static Ticket OpenForTable(int placeId, LocalizedText? placeName, int branchId)
        => new(TicketType.Table, branchId)
        {
            PlaceId = placeId,
            PlaceKind = "Table",
            LocationName = placeName,
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
        string? guestPhone = null,
        string? promoCode = null,
        decimal promoDiscount = 0)
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

        // A promo code redeemed in the app: its own negative line under the
        // code's name, so the receipt says where the money went
        if (promoDiscount > 0)
        {
            var label = string.IsNullOrWhiteSpace(promoCode) ? "Promo" : $"Promo {promoCode}";
            _lines.Add(new TicketLine(
                TicketLineSource.Order,
                new LocalizedText(label, string.IsNullOrWhiteSpace(promoCode) ? "كود خصم" : $"كود خصم {promoCode}"),
                qty: 1,
                unitPrice: -promoDiscount,
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
    /// Append the authoritative time lines when the stay ends, one per rate
    /// option of its tariff (zero-hour options are skipped). Idempotent —
    /// time lands exactly once, rounding stays owned by Spaces. The time is
    /// the place's, not anyone's: it carries no customer, sits under the
    /// place's own heading, and is split at settle however the group agrees.
    /// A tariff with one option reads "Table 4 time"; with several, each line
    /// reads "Room 4 time — Single".
    /// </summary>
    public void AppendSessionTime(IReadOnlyList<SessionTimeLine> lines)
    {
        EnsureOpen();

        SessionEndedAt ??= DateTime.UtcNow;

        if (_lines.Any(l => l.Source == TicketLineSource.SessionTime))
            return;

        var place = LocationName ?? new LocalizedText("Place");
        var placeAr = string.IsNullOrWhiteSpace(place.Ar) ? place.En : place.Ar;
        var perOption = lines.Count > 1;

        foreach (var line in lines.Where(l => l.Hours > 0))
        {
            var optionAr = string.IsNullOrWhiteSpace(line.OptionName.Ar) ? line.OptionName.En : line.OptionName.Ar;
            var description = perOption
                ? new LocalizedText($"{place.En} time — {line.OptionName.En}", $"وقت {placeAr} — {optionAr}")
                : new LocalizedText($"{place.En} time", $"وقت {placeAr}");

            _lines.Add(new TicketLine(
                TicketLineSource.SessionTime,
                description,
                qty: line.Hours,
                unitPrice: line.Cost / line.Hours));
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
    /// Ordering put a customer on an order after it landed here — the till
    /// forgot at the sale. Every line of that order takes the new snapshot,
    /// so the bill groups and settles under the right person. Only while
    /// open: a settled ticket is a printed receipt and a voided one a record,
    /// and neither is rewritten.
    /// </summary>
    /// <summary>
    /// A closed bill's lines learn the account behind an order that had none
    /// (a guest who signed in), so the customer finds the bill in their
    /// history. The receipt is frozen: names and money do not move, and a
    /// line that already belongs to an account is left alone.
    /// </summary>
    /// <returns>Whether any line changed.</returns>
    public bool AttachOrderCustomer(int orderId, string customerId)
    {
        var changed = false;
        foreach (var line in _lines.Where(l => l.OrderId == orderId))
            changed |= line.AttachCustomer(customerId);
        return changed;
    }

    public void AssignOrderCustomer(int orderId, string? customerId, string? customerName)
    {
        EnsureOpen();

        var lines = _lines.Where(l => l.OrderId == orderId).ToList();

        if (lines.Count == 0)
            throw new SalesDomainException($"Order {orderId} is not on ticket {Id}.");

        foreach (var line in lines)
            line.SetCustomer(customerId, customerName);

        // Not a Touch: nothing landed, so the floor's idle clock stays put —
        // but the open ticket screen and the floor tile still refetch
        AddDomainEvent(new TicketChangedDomainEvent(this));
    }

    /// <summary>
    /// Name who some of the lines were for — the split-bill fix when several
    /// people were rung up as one sale. Only the snapshot moves: the order,
    /// and the loyalty points it earned, stay with whoever placed it; a whole
    /// order changing hands goes through Ordering (<see cref="AssignOrderCustomer"/>).
    /// Session time is the session owner's and cannot be reassigned.
    /// </summary>
    public void AssignLinesCustomer(IReadOnlyCollection<int> lineIds, string? customerId, string? customerName)
    {
        EnsureOpen();

        if (lineIds.Count == 0)
            throw new SalesDomainException("Pick at least one line.");

        var wanted = lineIds.Distinct().ToHashSet();
        var lines = _lines.Where(l => wanted.Contains(l.Id)).ToList();

        if (lines.Count != wanted.Count)
            throw new SalesDomainException("Some of those lines are not on this ticket.");

        if (lines.Any(l => l.Source == TicketLineSource.SessionTime))
            throw new SalesDomainException("Session time belongs to the session's owner and cannot be reassigned.");

        foreach (var line in lines)
            line.SetCustomer(customerId, customerName);

        AddDomainEvent(new TicketChangedDomainEvent(this));
    }

    /// <summary>
    /// Settle the ticket: payments must cover the total (anything above it on
    /// cash is change), the ticket freezes, and a receipt can be issued.
    /// </summary>
    /// <returns>Change due back to the customer.</returns>
    public decimal Settle(
        IReadOnlyCollection<Payment> payments,
        string settledBy,
        int? shiftId = null,
        PricingRules? rules = null,
        DateTime? settledAt = null,
        string? provisionalReceiptNumber = null)
    {
        EnsureOpen();
        EnsureSessionEnded();

        // A till replaying an offline sale says when the money was taken. It
        // cannot be in the future, and it cannot be older than a month; the
        // ticket itself was only opened by the replay, so it opens then too.
        if (settledAt is { } at)
        {
            if (at > DateTime.UtcNow.AddMinutes(5) || at < DateTime.UtcNow.AddDays(-31))
                throw new SalesDomainException("The settle time is not plausible.");
            if (at < OpenedAt)
                OpenedAt = at;
        }

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
        SettledAt = settledAt ?? DateTime.UtcNow;
        SettledBy = settledBy;
        ProvisionalReceiptNumber = string.IsNullOrWhiteSpace(provisionalReceiptNumber) ? null : provisionalReceiptNumber.Trim();
        ShiftId = shiftId;
        ChangeGiven = overpaid;

        Subtotal = bill.Subtotal;
        Discount = bill.Discount;
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
    /// Take money off the whole bill — a regular, a complaint, staff. One
    /// discount per ticket, replaced when given again. A percent follows the
    /// lines until settle; a fixed amount is capped by the menu money at
    /// settle. The reason is the audit trail. <paramref name="maxRate"/> is
    /// the caller's ceiling as a share of the bill — the branch's cashier cap,
    /// or null for an owner, who has none.
    /// </summary>
    /// <summary>Note a customer who sat in the room. Returns whether they were new.</summary>
    public bool AddMember(string customerId)
    {
        if (string.IsNullOrWhiteSpace(customerId) || MemberIds.Contains(customerId))
            return false;
        MemberIds.Add(customerId);
        return true;
    }

    /// <summary>
    /// Whether this customer was on the bill: in the room, on a line, or
    /// paying a share — the test for reading the receipt.
    /// </summary>
    public bool Involves(string customerId)
        => MemberIds.Contains(customerId)
           || _lines.Any(l => l.CustomerId == customerId)
           || _payments.Any(p => p.CustomerId == customerId);

    public void ApplyDiscount(decimal? rate, decimal? amount, string? reason, string by, decimal? maxRate)
    {
        EnsureOpen();

        if ((rate is null) == (amount is null))
            throw new SalesDomainException("A discount is a percent or an amount, not both.");

        if (rate is <= 0 or > 1)
            throw new SalesDomainException("A percent discount is between 0 and 100.");

        if (amount is <= 0)
            throw new SalesDomainException("A discount amount is positive.");

        var subtotal = GetSubtotal();

        if (subtotal <= 0)
            throw new SalesDomainException("There is nothing on the bill to discount.");

        if (amount > subtotal)
            throw new SalesDomainException("A discount cannot exceed the bill.");

        var share = rate ?? amount!.Value / subtotal;

        if (maxRate is { } cap && share > cap + 0.00001m)
            throw new SalesDomainException($"Discounts above {cap:P0} need an owner.");

        DiscountRate = rate;
        Discount = amount ?? 0m;
        DiscountReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        DiscountBy = by;
        DiscountAt = DateTime.UtcNow;

        AddDomainEvent(new TicketChangedDomainEvent(this));
    }

    /// <summary>Take the discount back off an open ticket — nothing was settled, so nothing is recorded.</summary>
    public void RemoveDiscount()
    {
        EnsureOpen();

        DiscountRate = null;
        Discount = 0m;
        DiscountReason = null;
        DiscountBy = null;
        DiscountAt = null;

        AddDomainEvent(new TicketChangedDomainEvent(this));
    }

    /// <summary>
    /// Cancel an open ticket with nothing owed — a mistake, a comp, a group
    /// that walked. Owner-gated at the API: the reason is the audit trail,
    /// and the lines stay exactly as they were for anyone reviewing it.
    /// A settled ticket can never be voided; taking money back is a refund,
    /// which is a different, deliberate thing. Loyalty hears of it: the
    /// points the ticket's orders earned at confirmation go back with the sale.
    /// </summary>
    public void Void(string reason, string voidedBy)
    {
        EnsureOpen();
        EnsureSessionEnded();

        if (string.IsNullOrWhiteSpace(reason))
            throw new SalesDomainException("Voiding a ticket needs a reason — that is the whole audit trail.");

        Status = TicketStatus.Voided;
        VoidReason = reason;
        VoidedBy = voidedBy;
        VoidedAt = DateTime.UtcNow;

        AddDomainEvent(new TicketChangedDomainEvent(this));
        AddDomainEvent(new TicketVoidedDomainEvent(this));
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
        // A room ticket follows its session while it runs. Once the session has
        // ended and nothing ever landed — no time billed, no orders — there is
        // nothing to bill and it is thrown away like any other empty ticket.
        if (HasSession && SessionEndedAt == null)
            throw new SalesDomainException("A ticket cannot be discarded while its session is running.");

        DiscardEmpty();
    }

    /// <summary>
    /// The session was cancelled while the ticket already carried lines, so no
    /// time will ever land on it. Recorded so the ticket can be settled or
    /// voided; the empty case is <see cref="DiscardForCancelledSession"/>.
    /// </summary>
    public void MarkSessionCancelled()
    {
        if (!HasSession)
            throw new SalesDomainException("Only a ticket with a session follows one.");

        EnsureOpen();
        SessionEndedAt ??= DateTime.UtcNow;

        AddDomainEvent(new TicketChangedDomainEvent(this));
    }

    /// <summary>
    /// A Room ticket whose session is still running has its time yet to come:
    /// settling or voiding it now would lose that time (or strand it on a new
    /// ticket after the group has paid). End the session first.
    /// </summary>
    private void EnsureSessionEnded()
    {
        var running = HasSession
            && SessionEndedAt == null
            && !_lines.Any(l => l.Source == TicketLineSource.SessionTime);

        if (running)
            throw new SalesDomainException("The session is still running — end it first so its time lands on the bill.");
    }

    /// <summary>
    /// The one way a Room ticket goes: its session was cancelled — a wrong
    /// room started, a group that changed its mind — so no time will ever
    /// land on it. Only while still empty; once it carries lines, someone
    /// has to look at it (settle, or void).
    /// </summary>
    public void DiscardForCancelledSession()
    {
        if (!HasSession)
            throw new SalesDomainException("Only a ticket with a session follows one.");

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

        if (HasSession)
            throw new SalesDomainException("A ticket with a session follows it and cannot be split this way.");

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
                PlaceId ?? throw new SalesDomainException("A table ticket names its place."),
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
