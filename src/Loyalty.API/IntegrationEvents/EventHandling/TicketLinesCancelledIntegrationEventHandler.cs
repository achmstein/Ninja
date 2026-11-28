using Ninja.Loyalty.API.IntegrationEvents.Events;
using Ninja.Loyalty.API.Infrastructure;

namespace Ninja.Loyalty.API.IntegrationEvents.EventHandling;

/// <summary>
/// Items of an open bill were cancelled: the share of the points their order
/// earned goes back, through the clawback a credit note and a void run
/// (<see cref="OrderPointsClawback"/>). Filed per cancel and order, because
/// the bus redelivers. What the customer redeemed on the order stays spent:
/// the order still stands.
/// </summary>
public class TicketLinesCancelledIntegrationEventHandler(
    LoyaltyContext context,
    ILogger<TicketLinesCancelledIntegrationEventHandler> logger)
    : IIntegrationEventHandler<TicketLinesCancelledIntegrationEvent>
{
    public async Task Handle(TicketLinesCancelledIntegrationEvent @event)
    {
        foreach (var reversal in @event.OrderReversals)
        {
            await OrderPointsClawback.ApplyAsync(
                context,
                logger,
                reversal,
                reference: $"cancel:{@event.Id:N}:{reversal.OrderId}",
                description: $"Items cancelled from order #{reversal.OrderId} (ticket #{@event.TicketId}: {@event.Reason})",
                cause: $"items cancelled on ticket {@event.TicketId}");
        }

        await context.SaveChangesAsync();
    }
}
