using Chillax.Loyalty.API.IntegrationEvents.Events;
using Chillax.Loyalty.API.Infrastructure;
using Chillax.Loyalty.API.Model;
using Microsoft.EntityFrameworkCore;

namespace Chillax.Loyalty.API.IntegrationEvents.EventHandling;

/// <summary>
/// Points are earned when an order is confirmed; when part of that order is
/// refunded, the same share of those points goes back. The purchase
/// transaction that carries the order's reference says who earned them and
/// how many. Never below zero — points already spent are not a debt.
/// Idempotent per credit note and order, because the bus redelivers.
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
            if (reversal.OrderAmount <= 0 || reversal.RefundedAmount <= 0)
                continue;

            var reference = $"refund:{@event.RefundId}:{reversal.OrderId}";

            var earned = await context.Transactions
                .FirstOrDefaultAsync(t => t.ReferenceId == reversal.OrderId.ToString() && t.Type == TransactionType.Purchase);

            if (earned is null)
            {
                // A guest order, or one placed before the customer joined
                logger.LogInformation("Order {OrderId} earned no points - nothing to claw back for credit note #{Number}", reversal.OrderId, @event.Number);
                continue;
            }

            if (await context.Transactions.AnyAsync(t => t.ReferenceId == reference))
            {
                logger.LogInformation("Credit note #{Number} already reversed order {OrderId} - skipping redelivery", @event.Number, reversal.OrderId);
                continue;
            }

            var account = await context.Accounts.FirstAsync(a => a.Id == earned.AccountId);

            var share = Math.Min(1m, reversal.RefundedAmount / reversal.OrderAmount);
            var points = (int)Math.Round(earned.Points * share, MidpointRounding.AwayFromZero);

            var deducted = account.DeductPoints(points, reference, $"Refund of order #{reversal.OrderId} (credit note #{@event.Number})");

            logger.LogInformation(
                "Clawed back {Points} of {Earned} points from account {AccountId} for order {OrderId} (credit note #{Number})",
                deducted, earned.Points, account.Id, reversal.OrderId, @event.Number);
        }

        await context.SaveChangesAsync();
    }
}
