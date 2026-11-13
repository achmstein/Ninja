using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// An empty bill at a table or a room was thrown away (a stay that ended or was cancelled with nothing
/// on it, a table opened by mistake). A settle and a void each have their own event; this is the third
/// way a bill stops being a place's, and the only one that otherwise went unsaid. Ordering lets go of
/// which place the bill was the bill of.
/// </summary>
public record TicketDiscardedIntegrationEvent(int TicketId, int BranchId) : IntegrationEvent;
