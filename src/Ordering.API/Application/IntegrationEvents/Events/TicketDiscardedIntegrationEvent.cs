#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of the event Sales publishes when an empty bill at a table or a room is thrown away.
/// Same type name and properties as the source — the routing key is the type name.
/// </summary>
public record TicketDiscardedIntegrationEvent(int TicketId, int BranchId) : IntegrationEvent;
