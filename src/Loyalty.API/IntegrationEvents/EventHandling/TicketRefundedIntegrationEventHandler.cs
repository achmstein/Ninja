using Ninja.Loyalty.API.IntegrationEvents.Events;
using Ninja.Loyalty.API.Infrastructure;

namespace Ninja.Loyalty.API.IntegrationEvents.EventHandling;

/// <summary>
/// Points are earned when an order is confirmed; when part of that order is
/// refunded, the same share of those points goes back. The clawback itself
/// is <see cref="OrderPointsClawback"/>, shared with a void; what is this
/// handler's is the reference — per credit note and order, because the bus
/// redelivers.
/// </summary>
public class TicketRefundedIntegrationEventHandler(
    LoyaltyContext context,
    ILogger<TicketRefundedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<TicketRefundedIntegrationEvent>
{
    public async Task Handle(TicketRefundedIntegrationEvent @event)
    {
        foreach (var reversal in @event.OrderReversals)
        {
            await OrderPointsClawback.ApplyAsync(
                context,
                logger,
                reversal,
                reference: $"refund:{@event.RefundId}:{reversal.OrderId}",
                description: $"Refund of order #{reversal.OrderId} (credit note #{@event.Number})",
                cause: $"credit note #{@event.Number}");
        }

        await context.SaveChangesAsync();
    }
}
