#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Sales publishes when items of an open bill are
/// cancelled after the kitchen had them: each order's own items are struck,
/// and their stock goes as the till said.
/// </summary>
public record TicketLinesCancelledIntegrationEvent(
    int TicketId,
    int BranchId,
    string? Reason = null,
    string? CancelledBy = null,
    IReadOnlyCollection<CancelledTicketLine>? Lines = null,
    IReadOnlyCollection<RefundOrderReversal>? OrderReversals = null,
    string? StockDisposition = null) : IntegrationEvent;

/// <summary>One cancelled line of the bill: its order (null for a manual line), what it was, and how many.</summary>
public record CancelledTicketLine(
    int? OrderId,
    int? CatalogItemId,
    LocalizedText? Description,
    LocalizedText? Details,
    decimal Qty);
