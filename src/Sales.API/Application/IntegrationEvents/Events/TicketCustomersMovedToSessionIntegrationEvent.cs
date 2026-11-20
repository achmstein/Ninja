using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>One customer who came to the room with their lines.</summary>
public record MovedSessionCustomer(string CustomerId, string? CustomerName);

/// <summary>
/// A customer's lines were moved onto a room session's bill (their counter
/// tab or table bill went to the room). Spaces puts them in the room's
/// party: its owner when the room had none, a member otherwise.
/// </summary>
public record TicketCustomersMovedToSessionIntegrationEvent(
    int TicketId,
    int SessionId,
    int BranchId,
    IReadOnlyCollection<MovedSessionCustomer> Customers) : IntegrationEvent;
