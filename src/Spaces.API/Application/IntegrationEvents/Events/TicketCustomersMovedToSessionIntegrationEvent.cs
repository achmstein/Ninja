using Ninja.EventBus.Events;

namespace Ninja.Spaces.API.Application.IntegrationEvents.Events;

/// <summary>One customer who came to the room with their lines.</summary>
public record MovedSessionCustomer(string CustomerId, string? CustomerName);

/// <summary>
/// Consumer copy of the event Sales publishes when a customer's lines are
/// moved onto a room's bill. Same type name as the source (the routing key).
/// </summary>
public record TicketCustomersMovedToSessionIntegrationEvent(
    int TicketId,
    int SessionId,
    int BranchId,
    IReadOnlyCollection<MovedSessionCustomer> Customers) : IntegrationEvent;
