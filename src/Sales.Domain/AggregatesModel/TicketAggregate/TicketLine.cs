#nullable enable
namespace Chillax.Sales.Domain.AggregatesModel.TicketAggregate;

/// <summary>
/// One billed line on a ticket. The unit price is a snapshot — Catalog stays
/// the price authority at order time, Spaces at session time; a ticket never
/// recomputes what another service already priced.
/// </summary>
public class TicketLine : Entity
{
    public TicketLineSource Source { get; private set; }

    /// <summary>
    /// The confirmed order this line came from. Also the idempotency key:
    /// an order's lines are appended at most once per ticket.
    /// </summary>
    public int? OrderId { get; private set; }

    public LocalizedText Description { get; private set; } = new();

    /// <summary>Localized customization summary, when the item had any.</summary>
    public LocalizedText? Details { get; private set; }

    /// <summary>Units for items; hours for session time (hence decimal).</summary>
    public decimal Qty { get; private set; }

    public decimal UnitPrice { get; private set; }

    public decimal Discount { get; private set; }

    /// <summary>Who keyed a manual line in; null for event-sourced lines.</summary>
    public string? AddedBy { get; private set; }

    public decimal Total => Qty * UnitPrice - Discount;

    protected TicketLine() { }

    public TicketLine(
        TicketLineSource source,
        LocalizedText description,
        decimal qty,
        decimal unitPrice,
        decimal discount = 0,
        int? orderId = null,
        LocalizedText? details = null,
        string? addedBy = null)
    {
        if (string.IsNullOrWhiteSpace(description.En))
            throw new SalesDomainException("A ticket line needs a description");

        if (qty == 0)
            throw new SalesDomainException("A ticket line needs a quantity");

        if (discount < 0)
            throw new SalesDomainException("A line discount cannot be negative");

        Source = source;
        Description = description;
        Details = details;
        Qty = qty;
        UnitPrice = unitPrice;
        Discount = discount;
        OrderId = orderId;
        AddedBy = addedBy;
    }

    /// <summary>
    /// Stamped by <see cref="Ticket.AppendOrder"/> so the per-order
    /// idempotency never depends on callers setting it line by line.
    /// </summary>
    internal void MarkFromOrder(int orderId)
    {
        OrderId = orderId;
    }
}
