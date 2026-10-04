using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

namespace Ninja.Sales.Domain.Events;

/// <summary>
/// An open ticket was voided — nothing was owed, so whatever its orders had
/// earned at confirmation goes back.
/// </summary>
/// <param name="StockDisposition">"Waste" or "Restock" as the cashier said; null when they did not.</param>
public record TicketVoidedDomainEvent(Ticket Ticket, string? StockDisposition = null) : INotification;
