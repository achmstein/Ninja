using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

namespace Ninja.Sales.Domain.Events;

/// <summary>Someone named on lines that were moved onto a room's bill.</summary>
public record MovedCustomer(string CustomerId, string? CustomerName);

/// <summary>
/// Lines carrying a customer's name were moved onto a room session's bill:
/// the customer went to the room with them, so the room's party takes them.
/// </summary>
public record CustomersMovedToSessionDomainEvent(Ticket Ticket, IReadOnlyList<MovedCustomer> Customers) : INotification;
