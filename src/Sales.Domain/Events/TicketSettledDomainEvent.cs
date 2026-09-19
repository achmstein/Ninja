using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

namespace Ninja.Sales.Domain.Events;

public record TicketSettledDomainEvent(Ticket Ticket) : INotification;
