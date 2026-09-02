using Chillax.Sales.Domain.AggregatesModel.TicketAggregate;

namespace Chillax.Sales.Domain.Events;

public record TicketSettledDomainEvent(Ticket Ticket) : INotification;
