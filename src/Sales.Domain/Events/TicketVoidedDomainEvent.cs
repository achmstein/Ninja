using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

namespace Ninja.Sales.Domain.Events;

/// <summary>
/// An open ticket was voided — nothing was owed, so whatever its orders had
/// earned at confirmation goes back.
/// </summary>
public record TicketVoidedDomainEvent(Ticket Ticket) : INotification;
