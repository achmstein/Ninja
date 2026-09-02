#nullable enable
using Chillax.Sales.Domain.Events;

namespace Chillax.Sales.Domain.AggregatesModel.TicketAggregate;

/// <summary>A line and quantity a cashier asks to refund.</summary>
public record RefundRequestLine(int LineId, decimal Qty);

/// <summary>
/// A credit note: money given back against a settled ticket. The ticket
/// itself never changes — its receipt stays exactly as printed — and the
/// refund is its own numbered document referencing it. Each refunded line
/// gives back what the customer actually paid for it, so the frozen service
/// charge and VAT ride along in proportion. Cash leaves the drawer; Account
/// credits the named tab (Accounts posts it off the refunded event).
/// </summary>
public class Refund : Entity, IAggregateRoot
{
    /// <summary>Per-branch credit note number, sequential like receipts.</summary>
    public int Number { get; private set; }

    public int BranchId { get; private set; }

    public int TicketId { get; private set; }

    /// <summary>The receipt this credits, as printed.</summary>
    public int ReceiptNumber { get; private set; }

    /// <summary>Why — the audit trail a refund exists to leave.</summary>
    public string Reason { get; private set; } = string.Empty;

    /// <summary>Cash back, or a credit on the customer's tab.</summary>
    public PaymentTender Tender { get; private set; }

    /// <summary>The tab credited, when the tender is Account.</summary>
    public string? CustomerId { get; private set; }

    public string? CustomerName { get; private set; }

    public decimal Amount { get; private set; }

    public string RefundedBy { get; private set; } = string.Empty;

    public DateTime RefundedAt { get; private set; }

    /// <summary>The drawer shift a cash refund came out of, if one was open.</summary>
    public int? ShiftId { get; private set; }

    private readonly List<RefundLine> _lines = [];
    public IReadOnlyCollection<RefundLine> Lines => _lines.AsReadOnly();

    protected Refund() { }

    public static Refund Issue(
        int number,
        Ticket ticket,
        int receiptNumber,
        IReadOnlyCollection<Refund> earlier,
        IReadOnlyCollection<RefundRequestLine> requested,
        string reason,
        PaymentTender tender,
        string? customerId,
        string? customerName,
        string refundedBy,
        int? shiftId)
    {
        if (number <= 0)
            throw new SalesDomainException("A credit note needs a positive number.");

        if (ticket.Status != TicketStatus.Settled)
            throw new SalesDomainException("Only a settled ticket can be refunded — an open one is voided, or its lines moved.");

        if (string.IsNullOrWhiteSpace(reason))
            throw new SalesDomainException("A refund needs a reason — that is the audit trail.");

        if (tender is not (PaymentTender.Cash or PaymentTender.Account))
            throw new SalesDomainException("A refund goes back as cash, or onto the customer's tab.");

        if (tender == PaymentTender.Account && string.IsNullOrWhiteSpace(customerId))
            throw new SalesDomainException("Crediting a tab needs the customer it belongs to.");

        if (string.IsNullOrWhiteSpace(refundedBy))
            throw new SalesDomainException("A refund needs the person issuing it.");

        // The same line asked for twice is one request for the sum
        var wanted = requested
            .GroupBy(r => r.LineId)
            .Select(g => new RefundRequestLine(g.Key, g.Sum(r => r.Qty)))
            .ToList();

        if (wanted.Count == 0)
            throw new SalesDomainException("Pick at least one line to refund.");

        var alreadyQty = earlier
            .SelectMany(r => r.Lines)
            .GroupBy(l => l.TicketLineId)
            .ToDictionary(g => g.Key, g => g.Sum(l => l.Qty));
        var alreadyAmount = earlier.Sum(r => r.Amount);
        var remainder = ticket.Total - alreadyAmount;

        // What the customer paid per pound of menu price: the frozen service
        // charge and VAT, spread over every line
        var paidPerMenuPound = ticket.Subtotal > 0 ? ticket.Total / ticket.Subtotal : 1m;

        var refund = new Refund
        {
            Number = number,
            BranchId = ticket.BranchId,
            TicketId = ticket.Id,
            ReceiptNumber = receiptNumber,
            Reason = reason.Trim(),
            Tender = tender,
            CustomerId = tender == PaymentTender.Account ? customerId : null,
            CustomerName = tender == PaymentTender.Account ? customerName : null,
            RefundedBy = refundedBy,
            RefundedAt = DateTime.UtcNow,
            ShiftId = shiftId,
        };

        foreach (var request in wanted)
        {
            var line = ticket.Lines.FirstOrDefault(l => l.Id == request.LineId)
                ?? throw new SalesDomainException($"Line {request.LineId} is not on this ticket.");

            if (line.Total <= 0)
                throw new SalesDomainException("A discount line cannot be refunded on its own.");

            if (request.Qty <= 0)
                throw new SalesDomainException("A refunded quantity must be positive.");

            var left = line.Qty - alreadyQty.GetValueOrDefault(line.Id);

            if (request.Qty > left + 0.0001m)
                throw new SalesDomainException($"Only {left:0.##} of \"{line.Description.En}\" is left to refund.");

            var menuAmount = Money(line.Total * request.Qty / line.Qty);

            refund._lines.Add(new RefundLine(
                line.Id,
                line.Description,
                request.Qty,
                Money(menuAmount * paidPerMenuPound),
                menuAmount,
                line.OrderId));
        }

        var amount = refund._lines.Sum(l => l.Amount);

        // Refunding everything that is left gives back exactly what is left,
        // so rounding never strands a piastre on either side
        var wantedQty = wanted.ToDictionary(w => w.LineId, w => w.Qty);
        var everythingLeft = ticket.Lines
            .Where(l => l.Total > 0)
            .All(l => l.Qty - alreadyQty.GetValueOrDefault(l.Id) - wantedQty.GetValueOrDefault(l.Id) <= 0.0001m);

        if (everythingLeft)
        {
            refund._lines[^1].Absorb(remainder - amount);
            amount = remainder;
        }

        if (amount <= 0)
            throw new SalesDomainException("There is nothing left to refund on this receipt.");

        if (amount > remainder + 0.005m)
            throw new SalesDomainException($"Only {remainder:0.00} of this receipt is left to refund.");

        refund.Amount = amount;
        refund.AddDomainEvent(new TicketRefundedDomainEvent(refund));

        return refund;
    }

    /// <summary>
    /// The refunded share of each order on the ticket, at menu prices — what
    /// Loyalty needs to claw back the points that order earned, in proportion.
    /// </summary>
    public IReadOnlyCollection<(int OrderId, decimal RefundedAmount)> RefundedByOrder()
        => _lines
            .Where(l => l.OrderId is not null)
            .GroupBy(l => l.OrderId!.Value)
            .Select(g => (g.Key, g.Sum(l => l.MenuAmount)))
            .ToList();

    private static decimal Money(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
}

/// <summary>One refunded line: which ticket line, how much of it, and what came back for it.</summary>
public class RefundLine : Entity
{
    public int TicketLineId { get; private set; }

    public LocalizedText Description { get; private set; } = new();

    public decimal Qty { get; private set; }

    /// <summary>What the customer gets back for this line — menu price plus its share of service and VAT.</summary>
    public decimal Amount { get; private set; }

    /// <summary>The same at menu price, for reversing loyalty in proportion.</summary>
    public decimal MenuAmount { get; private set; }

    public int? OrderId { get; private set; }

    protected RefundLine() { }

    public RefundLine(int ticketLineId, LocalizedText description, decimal qty, decimal amount, decimal menuAmount, int? orderId)
    {
        TicketLineId = ticketLineId;
        Description = new LocalizedText(description.En, description.Ar);
        Qty = qty;
        Amount = amount;
        MenuAmount = menuAmount;
        OrderId = orderId;
    }

    internal void Absorb(decimal residue) => Amount += residue;
}
