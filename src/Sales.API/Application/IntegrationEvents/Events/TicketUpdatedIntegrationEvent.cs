using Chillax.EventBus.Events;

namespace Chillax.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// A ticket opened or changed — published so Notification can nudge the POS
/// floor over SignalR. Deliberately just a pointer: the POS refetches, the
/// event never carries money.
/// </summary>
public record TicketUpdatedIntegrationEvent(int TicketId, int BranchId) : IntegrationEvent;
