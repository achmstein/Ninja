using Chillax.EventBus.Abstractions;
using Chillax.Notification.API.Hubs;
using Chillax.Notification.API.IntegrationEvents.Events;
using Microsoft.AspNetCore.SignalR;

namespace Chillax.Notification.API.IntegrationEvents.EventHandling;

/// <summary>
/// The bill an order sits on changed: nudge the customer who placed it,
/// over the same "OrderStatusChanged" message both apps already refetch
/// their orders on. No push — the receipt is not an event to be woken for.
/// </summary>
public class OrderPaymentChangedIntegrationEventHandler(
    IHubContext<NotificationHub> hubContext,
    ILogger<OrderPaymentChangedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderPaymentChangedIntegrationEvent>
{
    public async Task Handle(OrderPaymentChangedIntegrationEvent @event)
    {
        // Their identity when signed in, their guest id when not
        var customerGroup = !string.IsNullOrEmpty(@event.BuyerIdentityGuid)
            ? $"user:{@event.BuyerIdentityGuid}"
            : !string.IsNullOrEmpty(@event.GuestId)
                ? $"guest:{@event.GuestId}"
                : null;
        if (customerGroup is null)
        {
            return;
        }
        logger.LogInformation("Order {OrderId} {Change} - nudging {Group}", @event.OrderId, @event.Change, customerGroup);
        await hubContext.Clients.Group(customerGroup).SendAsync("OrderStatusChanged", new
        {
            type = "order_" + @event.Change.ToLowerInvariant(),
            orderId = @event.OrderId,
            receiptNumber = @event.ReceiptNumber
        });
    }
}
