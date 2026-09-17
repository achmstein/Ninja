using Chillax.EventBus.Abstractions;
using Chillax.Notification.API.Hubs;
using Chillax.Notification.API.IntegrationEvents.Events;
using Microsoft.AspNetCore.SignalR;

namespace Chillax.Notification.API.IntegrationEvents.EventHandling;

/// <summary>
/// The bill for a place was paid: the sitting there is over for everyone
/// who scanned its code, not only for whoever ordered (they hear about their
/// own orders separately). Every phone in the place's group drops the table
/// and shows its thanks (docs/visit-tab.html). No push — the customer is
/// at the table, phone in hand.
/// </summary>
public class TicketSettledIntegrationEventHandler(
    IHubContext<NotificationHub> hubContext,
    ILogger<TicketSettledIntegrationEventHandler> logger) : IIntegrationEventHandler<TicketSettledIntegrationEvent>
{
    public async Task Handle(TicketSettledIntegrationEvent @event)
    {
        if (@event.PlaceId is not int placeId)
        {
            return;
        }
        logger.LogInformation("Ticket {TicketId} settled at place {PlaceId} - clearing the place group", @event.TicketId, placeId);

        await hubContext.Clients.Group(NotificationHub.PlaceGroup(placeId)).SendAsync("PlaceCleared", new
        {
            placeId,
            ticketId = @event.TicketId,
            receiptNumber = @event.ReceiptNumber,
            reason = "paid"
        });
    }
}
