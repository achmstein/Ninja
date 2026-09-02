using Chillax.EventBus.Abstractions;
using Chillax.Notification.API.Hubs;
using Chillax.Notification.API.IntegrationEvents.Events;
using Microsoft.AspNetCore.SignalR;

namespace Chillax.Notification.API.IntegrationEvents.EventHandling;

/// <summary>
/// Nudges the POS floor when a ticket opens, changes or settles. No FCM —
/// the POS is a screen that is already on; nobody needs a push about it.
/// </summary>
public class TicketUpdatedIntegrationEventHandler(
    IHubContext<NotificationHub> hubContext,
    ILogger<TicketUpdatedIntegrationEventHandler> logger) : IIntegrationEventHandler<TicketUpdatedIntegrationEvent>
{
    public async Task Handle(TicketUpdatedIntegrationEvent @event)
    {
        logger.LogInformation("Ticket {TicketId} updated - notifying admin group", @event.TicketId);

        await hubContext.Clients.Group("admin").SendAsync("TicketUpdated", new
        {
            ticketId = @event.TicketId,
            branchId = @event.BranchId
        });
    }
}
