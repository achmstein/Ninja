using Ninja.EventBus.Abstractions;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.IntegrationEvents.Events;
using Microsoft.AspNetCore.SignalR;

namespace Ninja.Notification.API.IntegrationEvents.EventHandling;

/// <summary>
/// The bill for a place was paid: the sitting there is over for everyone
/// who scanned its code, not only for whoever ordered (they hear about their
/// own orders separately). Every phone in the place's group drops the table
/// (docs/visit-tab.html), and anyone whose tab the settle charged hears
/// that their balance moved. No push — the customer is at the table, phone
/// in hand.
/// </summary>
public class TicketSettledIntegrationEventHandler(
    IHubContext<NotificationHub> hubContext,
    ILogger<TicketSettledIntegrationEventHandler> logger) : IIntegrationEventHandler<TicketSettledIntegrationEvent>
{
    public async Task Handle(TicketSettledIntegrationEvent @event)
    {
        // A share on someone's tab: that account holder reads their balance
        // again, whether or not they ordered or scanned anything
        foreach (var customerId in (@event.AccountCharges ?? []).Select(c => c.CustomerId).Distinct())
        {
            if (string.IsNullOrWhiteSpace(customerId))
            {
                continue;
            }
            await hubContext.Clients.Group($"user:{customerId}").SendAsync("AccountChanged", new
            {
                ticketId = @event.TicketId,
                receiptNumber = @event.ReceiptNumber
            });
        }

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
