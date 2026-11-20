using Ninja.EventBus.Abstractions;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.IntegrationEvents.Events;
using Microsoft.AspNetCore.SignalR;

namespace Ninja.Notification.API.IntegrationEvents.EventHandling;

/// <summary>
/// The bill an order sits on changed: nudge the customer who placed it,
/// over the same "OrderStatusChanged" message both apps already refetch
/// their orders on. No push — the receipt is not an event to be woken for.
/// A voided bill also nudges the staff group: the kitchen display drops the
/// order's card, now that Ordering has stamped it voided.
/// </summary>
public class OrderPaymentChangedIntegrationEventHandler(
    IHubContext<NotificationHub> hubContext,
    ILogger<OrderPaymentChangedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderPaymentChangedIntegrationEvent>
{
    public async Task Handle(OrderPaymentChangedIntegrationEvent @event)
    {
        if (string.Equals(@event.Change, "Voided", StringComparison.OrdinalIgnoreCase))
        {
            await hubContext.Clients.Group("admin").SendAsync("OrderStatusChanged", new
            {
                type = "order_voided",
                orderId = @event.OrderId,
                branchId = @event.BranchId
            });
        }

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
