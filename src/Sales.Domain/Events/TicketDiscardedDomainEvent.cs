using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

namespace Ninja.Sales.Domain.Events;

/// <summary>
/// An empty open bill was thrown away: nothing was ever on it and nothing will be. Unlike a settle or
/// a void it leaves no record behind, so whoever kept which place it was the bill of is told to let go.
/// </summary>
public record TicketDiscardedDomainEvent(Ticket Ticket) : INotification;
