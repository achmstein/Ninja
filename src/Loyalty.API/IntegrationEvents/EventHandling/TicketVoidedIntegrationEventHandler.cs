using Ninja.Loyalty.API.IntegrationEvents.Events;
using Ninja.Loyalty.API.Infrastructure;
using Ninja.Loyalty.API.Model;
using Microsoft.EntityFrameworkCore;

namespace Ninja.Loyalty.API.IntegrationEvents.EventHandling;

/// <summary>
/// A void undoes the sale — nothing was owed — so it undoes what the sale
/// earned: every order on the ticket comes back in full, through the same
/// clawback a credit note runs (<see cref="OrderPointsClawback"/>). And what
/// the customer spent on it: points redeemed on an order of the ticket go
/// back on their balance, before the clawback, so the points earned come
/// back out of a balance that has them. Filed per ticket and order (the
/// clawback) and per order (the redemption, which only goes back once),
/// because the bus redelivers.
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
            await RestoreRedeemedAsync(@event, reversal.OrderId);

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

    public static string RestoredReferenceFor(int orderId) => $"void-redeemed:{orderId}";

    private async Task RestoreRedeemedAsync(TicketVoidedIntegrationEvent @event, int orderId)
    {
        var orderReference = orderId.ToString();
        var restoredReference = RestoredReferenceFor(orderId);

        // The points the confirmation took off, on whichever account paid with them
        var redeemed = await context.Transactions
            .Where(t => t.ReferenceId == orderReference && t.Type == TransactionType.Redemption && t.Points < 0)
            .ToListAsync();

        if (redeemed.Count == 0)
            return;

        if (await context.Transactions.AnyAsync(t => t.ReferenceId == restoredReference))
        {
            logger.LogInformation("Points redeemed on order {OrderId} already given back - skipping redelivery", orderId);
            return;
        }

        foreach (var spent in redeemed.GroupBy(t => t.AccountId))
        {
            var account = await context.Accounts.FirstAsync(a => a.Id == spent.Key);
            var points = -spent.Sum(t => t.Points);

            account.RestoreRedeemedPoints(points, restoredReference,
                $"Points given back: void of order #{orderId} (ticket #{@event.TicketId}: {@event.Reason})");

            logger.LogInformation(
                "Gave back {Points} points redeemed on order {OrderId} to account {AccountId} (void of ticket {TicketId})",
                points, orderId, account.Id, @event.TicketId);
        }
    }
}
