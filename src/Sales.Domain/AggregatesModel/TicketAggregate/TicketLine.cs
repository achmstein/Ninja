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

    /// <summary>
    /// Whose items these are, when a table's bill is shared. One "add items"
    /// run is one order for one person, so a line inherits the customer the
    /// cashier attached to it. Null means nobody was named — the line belongs
    /// to the table at large.
    /// </summary>
    public string? CustomerName { get; private set; }

    /// <summary>
    /// The account behind <see cref="CustomerName"/>, when the name came from
    /// an attached customer rather than one the till was simply told. It is
    /// what lets settle offer "put Ahmed's share on Ahmed's tab".
    /// </summary>
    public string? CustomerId { get; private set; }

    /// <summary>
    /// The guest id Ordering minted for a customer with no account, so one
    /// guest's lines group together the way an account holder's do. A key
    /// for reading and splitting the bill — never a tab to charge.
    /// </summary>
    public string? GuestId { get; private set; }

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
        string? addedBy = null,
        string? customerName = null,
        string? customerId = null,
        string? guestId = null)
    {
        if (string.IsNullOrWhiteSpace(description.En))
            throw new SalesDomainException("A ticket line needs a description");

        if (qty == 0)
            throw new SalesDomainException("A ticket line needs a quantity");

        if (discount < 0)
            throw new SalesDomainException("A line discount cannot be negative");

        Source = source;
        CustomerName = string.IsNullOrWhiteSpace(customerName) ? null : customerName.Trim();
        CustomerId = string.IsNullOrWhiteSpace(customerId) ? null : customerId;
        GuestId = string.IsNullOrWhiteSpace(guestId) ? null : guestId;
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
