using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

namespace Ninja.Sales.Domain.Events;

/// <summary>
/// A bill was opened: for a table or a room it is now the bill of that place, and stays so until it is
/// settled or voided. What is ordered onto it belongs to that place, whoever rings it up.
/// </summary>
public record TicketOpenedDomainEvent(Ticket Ticket) : INotification;
