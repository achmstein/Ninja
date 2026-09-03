using Chillax.Loyalty.API.IntegrationEvents.Events;
using Chillax.Loyalty.API.Infrastructure;

namespace Chillax.Loyalty.API.IntegrationEvents.EventHandling;

/// <summary>
/// A void undoes the sale — nothing was owed — so it undoes what the sale
/// earned: every order on the ticket comes back in full, through the same
/// clawback a credit note runs (<see cref="OrderPointsClawback"/>). Filed
/// per ticket and order, because the bus redelivers.
/// </summary>
public class TicketVoidedIntegrationEventHandler(
    LoyaltyContext context,
    ILogger<TicketVoidedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<TicketVoidedIntegrationEvent>
{
    public async Task Handle(TicketVoidedIntegrationEvent @event)
    {
        foreach (var reversal in @event.OrderReversals)
        {
            await OrderPointsClawback.ApplyAsync(
                context,
                logger,
                reversal,
                reference: $"void:{@event.TicketId}:{reversal.OrderId}",
                description: $"Void of order #{reversal.OrderId} (ticket #{@event.TicketId}: {@event.Reason})",
                cause: $"void of ticket {@event.TicketId}");
        }

        await context.SaveChangesAsync();
    }
}
