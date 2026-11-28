#nullable enable
namespace Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

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

    /// <summary>
    /// The catalog item behind an order line, as the confirmation named it;
    /// null on the room's time and on lines from before it was stamped. The
    /// back office groups sales by category through it - the category
    /// itself stays Catalog's, joined on the screen, never copied here.
    /// </summary>
    public int? CatalogItemId { get; private set; }

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

    /// <summary>Whether the order line was added from a suggestion, and which.</summary>
    public SuggestionSource Suggestion { get; private set; }

    public decimal Total => Qty * UnitPrice - Discount;

    /// <summary>
    /// How many of the line were cancelled after the kitchen had it: <see cref="Qty"/>
    /// is what is still sold, so every total, refund and report reads the line
    /// as it now stands; this keeps what was taken off, for the bill and the
    /// kitchen to show struck. Zero on a line nothing was cancelled from.
    /// </summary>
    public decimal CancelledQty { get; private set; }

    /// <summary>The menu money the cancellations took off the line, at its own price and discount.</summary>
    public decimal CancelledAmount { get; private set; }

    /// <summary>Why, as the last cancellation said: the audit trail, as a void's reason is.</summary>
    public string? CancelReason { get; private set; }

    /// <summary>The longest a cancel reason is kept, as the column is made.</summary>
    public const int CancelReasonLength = 200;

    public string? CancelledBy { get; private set; }

    public DateTime? CancelledAt { get; private set; }

    /// <summary>The line as it was rung up, before anything was cancelled.</summary>
    public decimal OriginalQty => Qty + CancelledQty;

    /// <summary>The delivery's fee: billed with the order, but not a thing sold.</summary>
    public bool IsDeliveryFee => Source == TicketLineSource.DeliveryFee;

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
        string? guestId = null,
        int? catalogItemId = null,
        SuggestionSource suggestion = SuggestionSource.None)
    {
        if (description is null || description.IsEmpty)
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
        CatalogItemId = catalogItemId;
        Suggestion = suggestion;
    }

    /// <summary>
    /// Take <paramref name="qty"/> off the line: it stays on the bill, struck
    /// as far as it was cancelled, and its discount shrinks with it. Returns
    /// the menu money that came off.
    /// </summary>
    internal decimal Cancel(decimal qty, string reason, string by, DateTime at)
    {
        if (qty <= 0)
            throw new SalesDomainException("A cancelled quantity must be positive.");

        if (qty > Qty + 0.0001m)
            throw new SalesDomainException($"Only {Qty:0.##} of \"{Description.Primary}\" is left to cancel.");

        var before = Total;
        var left = Math.Max(0m, Qty - qty);
        Discount = Qty == 0 ? 0 : Math.Round(Discount * left / Qty, 2, MidpointRounding.AwayFromZero);
        Qty = left;

        var amount = before - Total;
        CancelledQty += qty;
        CancelledAmount += amount;
        CancelReason = reason;
        CancelledBy = by;
        CancelledAt = at;
        return amount;
    }

    /// <summary>
    /// Stamped by <see cref="Ticket.AppendOrder"/> so the per-order
    /// idempotency never depends on callers setting it line by line.
    /// </summary>
    internal void MarkFromOrder(int orderId)
    {
        OrderId = orderId;
    }

    /// <summary>
    /// Re-tag the line with whoever it turned out to be for — Ordering said so
    /// after the fact (<see cref="Ticket.AssignOrderCustomer"/>). Cleaned the
    /// way the constructor cleans, so a blank stays null.
    /// </summary>
    internal void SetCustomer(string? customerId, string? customerName)
    {
        CustomerName = string.IsNullOrWhiteSpace(customerName) ? null : customerName.Trim();
        CustomerId = string.IsNullOrWhiteSpace(customerId) ? null : customerId;
    }

    /// <summary>
    /// The account behind a line that had none - a guest who signed in. The
    /// printed name is left as it was; only who may read the bill changes.
    /// </summary>
    internal bool AttachCustomer(string customerId)
    {
        if (CustomerId is not null || string.IsNullOrWhiteSpace(customerId))
            return false;
        CustomerId = customerId;
        return true;
    }
}
