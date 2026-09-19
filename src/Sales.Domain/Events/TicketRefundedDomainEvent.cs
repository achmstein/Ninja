using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

namespace Ninja.Sales.Domain.Events;

public record TicketRefundedDomainEvent(Refund Refund) : INotification;
