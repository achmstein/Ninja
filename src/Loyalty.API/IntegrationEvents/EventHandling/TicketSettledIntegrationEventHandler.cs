using Chillax.Loyalty.API.IntegrationEvents.Events;
using Chillax.Loyalty.API.Infrastructure;
using Chillax.Loyalty.API.Model;
using Microsoft.EntityFrameworkCore;

namespace Chillax.Loyalty.API.IntegrationEvents.EventHandling;

/// <summary>
/// Awards points on the session-time portion of a settled POS ticket — the
/// long-promised "loyalty on session time". Items are deliberately excluded:
/// they accrued when their order was confirmed, and awarding on the whole
/// ticket would pay twice. Same rate and tier math as order accrual.
/// Idempotent by reference — the bus redelivers.
/// </summary>
public class TicketSettledIntegrationEventHandler(
    LoyaltyContext context,
    ILogger<TicketSettledIntegrationEventHandler> logger)
    : IIntegrationEventHandler<TicketSettledIntegrationEvent>
{
    private const int BasePointsPerPound = 2;

    public async Task Handle(TicketSettledIntegrationEvent @event)
    {
        if (@event.TimeTotal <= 0 || string.IsNullOrEmpty(@event.CustomerId))
        {
            return;
        }

        var account = await context.Accounts
            .FirstOrDefaultAsync(a => a.UserId == @event.CustomerId);

        if (account == null)
        {
            // Same rule as order accrual: joining loyalty is the customer's move
            logger.LogInformation(
                "User {UserId} has no loyalty account, skipping session-time points for ticket {TicketId}",
                @event.CustomerId, @event.TicketId);
            return;
        }

        var reference = $"sales-ticket:{@event.TicketId}";

        var alreadyAwarded = await context.Transactions
            .AnyAsync(t => t.ReferenceId == reference && t.AccountId == account.Id);

        if (alreadyAwarded)
        {
            logger.LogInformation("Ticket {TicketId} session time already awarded - skipping", @event.TicketId);
            return;
        }

        var tierMultiplier = GetTierMultiplier(account.CurrentTier);
        var pointsToAward = (int)Math.Floor(@event.TimeTotal * BasePointsPerPound * (decimal)tierMultiplier);

        if (pointsToAward <= 0)
        {
            return;
        }

        account.AddPoints(
            pointsToAward,
            TransactionType.Purchase,
            reference,
            $"Session time (receipt #{@event.ReceiptNumber})");

        await context.SaveChangesAsync();

        logger.LogInformation(
            "Awarded {Points} session-time points to {UserId} for ticket {TicketId} ({TimeTotal} EGP, tier {Tier})",
            pointsToAward, @event.CustomerId, @event.TicketId, @event.TimeTotal, account.CurrentTier);
    }

    private static double GetTierMultiplier(LoyaltyTier tier) => tier switch
    {
        LoyaltyTier.Silver => 1.25,
        LoyaltyTier.Gold => 1.5,
        LoyaltyTier.Platinum => 2.0,
        _ => 1.0 // Bronze
    };
}
