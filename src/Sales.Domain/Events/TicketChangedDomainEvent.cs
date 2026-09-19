using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

namespace Ninja.Sales.Domain.Events;

/// <summary>
/// A ticket opened or its lines changed — the POS floor should refresh.
/// </summary>
public record TicketChangedDomainEvent(Ticket Ticket) : INotification;
