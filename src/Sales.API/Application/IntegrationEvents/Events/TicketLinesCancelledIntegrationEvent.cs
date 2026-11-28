#nullable enable
using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// Some items of an open bill were cancelled after the kitchen had them.
/// Ordering strikes them on the kitchen's tickets, prints a slip where tickets
/// print, and lets their stock go as <see cref="StockDisposition"/> says;
/// Loyalty takes back the points they earned. The bill itself is Sales'.
/// </summary>
/// <param name="Lines">Each line touched: the order it came from (null for a manual line), what it was, and how many came off.</param>
/// <param name="OrderReversals">Per order touched: the menu money that came off, against what the order was worth on the bill as rung up.</param>
/// <param name="StockDisposition">"Waste" or "Restock" as the cashier said; null leaves it to Ordering.</param>
public record TicketLinesCancelledIntegrationEvent(
    int TicketId,
    int BranchId,
    string Reason,
    string CancelledBy,
    IReadOnlyCollection<CancelledTicketLine> Lines,
    IReadOnlyCollection<RefundOrderReversal> OrderReversals,
    string? StockDisposition = null) : IntegrationEvent;

/// <summary>
/// One cancelled line. The order's own item is found by what it was — the
/// catalog item and its options as described — since a ticket line is an
/// order line as confirmed; two lines alike are the same thing to cancel.
/// </summary>
public record CancelledTicketLine(
    int? OrderId,
    int? CatalogItemId,
    LocalizedText Description,
    LocalizedText? Details,
    decimal Qty);
