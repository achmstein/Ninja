using Chillax.EventBus.Abstractions;
using Chillax.Notification.API.Hubs;
using Chillax.Notification.API.IntegrationEvents.Events;
using Microsoft.AspNetCore.SignalR;

namespace Chillax.Notification.API.IntegrationEvents.EventHandling;

/// <summary>
/// The bill for a place was voided: the sitting is over just the same, so
/// every phone in the place's group drops the table. No thanks card — the
/// event says so — and no push.
/// </summary>
public class TicketVoidedIntegrationEventHandler(
    IHubContext<NotificationHub> hubContext,
    ILogger<TicketVoidedIntegrationEventHandler> logger) : IIntegrationEventHandler<TicketVoidedIntegrationEvent>
{
    public async Task Handle(TicketVoidedIntegrationEvent @event)
    {
        if (@event.PlaceId is not int placeId)
        {
            return;
        }
        logger.LogInformation("Ticket {TicketId} voided at place {PlaceId} - clearing the place group", @event.TicketId, placeId);

        await hubContext.Clients.Group(NotificationHub.PlaceGroup(placeId)).SendAsync("PlaceCleared", new
        {
            placeId,
            ticketId = @event.TicketId,
            receiptNumber = (int?)null,
            reason = "voided"
        });
    }
}
