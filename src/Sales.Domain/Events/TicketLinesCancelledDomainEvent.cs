#nullable enable
using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

namespace Ninja.Sales.Domain.Events;

/// <summary>
/// Some of an open bill's items were cancelled after the kitchen had them.
/// </summary>
/// <param name="Lines">Each line touched, how many came off it, and the menu money that went with them.</param>
/// <param name="StockDisposition">"Waste" or "Restock" as the cashier said; null leaves it to Ordering.</param>
/// <param name="OriginalAmountByOrder">Each order's worth on the bill before this cancel, for Loyalty's share.</param>
public record TicketLinesCancelledDomainEvent(
    Ticket Ticket,
    IReadOnlyList<CancelledLine> Lines,
    string Reason,
    string CancelledBy,
    string? StockDisposition,
    IReadOnlyDictionary<int, decimal> OriginalAmountByOrder) : INotification;
