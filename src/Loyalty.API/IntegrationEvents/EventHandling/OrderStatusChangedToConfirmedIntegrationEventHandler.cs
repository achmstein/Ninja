using Chillax.Loyalty.API.IntegrationEvents.Events;
using Chillax.Loyalty.API.Infrastructure;
using Chillax.Loyalty.API.Model;
using Microsoft.EntityFrameworkCore;

namespace Chillax.Loyalty.API.IntegrationEvents.EventHandling;

/// <summary>
/// Handles OrderStatusChangedToConfirmedIntegrationEvent to award and redeem loyalty points.
/// Base rate: 1 EGP = 2 points (2% return at 100 points = 1 EGP redemption).
/// Tier multipliers: Bronze 1x, Silver 1.25x, Gold 1.5x, Platinum 2x.
/// </summary>
public class OrderStatusChangedToConfirmedIntegrationEventHandler(
    LoyaltyContext context,
    ILogger<OrderStatusChangedToConfirmedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderStatusChangedToConfirmedIntegrationEvent>
{
    private const int BasePointsPerPound = 2;

    public async Task Handle(OrderStatusChangedToConfirmedIntegrationEvent @event)
    {
        logger.LogInformation(
            "Handling OrderStatusChangedToConfirmedIntegrationEvent: OrderId={OrderId}, UserId={UserId}, Total={Total}, PointsToRedeem={PointsToRedeem}",
            @event.OrderId, @event.BuyerIdentityGuid, @event.OrderTotal, @event.PointsToRedeem);

        // Guest orders carry no identity, so there is nothing to credit and
        // nothing to match on — never let an empty id find an account.
        if (string.IsNullOrEmpty(@event.BuyerIdentityGuid))
        {
            logger.LogInformation(
                "Order {OrderId} was placed by a guest, skipping loyalty points",
                @event.OrderId);
            return;
        }

        // Get loyalty account for user (must already exist - user joins manually)
        var account = await context.Accounts
            .FirstOrDefaultAsync(a => a.UserId == @event.BuyerIdentityGuid);

        if (account == null)
        {
            // User hasn't joined loyalty program - skip awarding points
            logger.LogInformation(
                "User {UserId} has no loyalty account, skipping points for order {OrderId}",
                @event.BuyerIdentityGuid, @event.OrderId);
            return;
        }

        // Keep display name in sync (handles Apple hidden email → real name updates)
        if (!string.IsNullOrEmpty(@event.BuyerName) && account.UserDisplayName != @event.BuyerName)
        {
            account.UserDisplayName = @event.BuyerName;
        }

        // The bus promises at-least-once: a redelivered confirmation must not
        // redeem or award a second time. The order id is the reference every
        // transaction for this order carries.
        var alreadyProcessed = await context.Transactions
            .AnyAsync(t => t.ReferenceId == @event.OrderId.ToString() && t.AccountId == account.Id);

        if (alreadyProcessed)
        {
            logger.LogInformation(
                "Order {OrderId} already has loyalty transactions for account {AccountId} - skipping redelivery",
                @event.OrderId, account.Id);
            await context.SaveChangesAsync();
            return;
        }

        // Redeem points if any (do this first, before awarding new points)
        if (@event.PointsToRedeem > 0)
        {
            account.RedeemPoints(
                @event.PointsToRedeem,
                @event.OrderId.ToString());

            logger.LogInformation(
                "Redeemed {Points} points for user {UserId} on order {OrderId}",
                @event.PointsToRedeem, @event.BuyerIdentityGuid, @event.OrderId);
        }

        // Calculate points to award with tier multiplier
        var tierMultiplier = GetTierMultiplier(account.CurrentTier);
        var pointsToAward = PointsToAward(@event.OrderTotal, account.CurrentTier);

        if (pointsToAward > 0)
        {
            // Award points
            account.AddPoints(
                pointsToAward,
                TransactionType.Purchase,
                @event.OrderId.ToString());

            logger.LogInformation(
                "Awarded {Points} points to user {UserId} for order {OrderId} (tier={Tier}, multiplier={Multiplier}x). New balance: {Balance}",
                pointsToAward, @event.BuyerIdentityGuid, @event.OrderId, account.CurrentTier, tierMultiplier, account.PointsBalance);
        }

        await context.SaveChangesAsync();
    }

    /// <summary>
    /// What an order earns: the base rate on its total, scaled by the tier.
    /// Shared with the after-the-fact assignment so both paths award alike.
    /// </summary>
    internal static int PointsToAward(decimal orderTotal, LoyaltyTier tier)
        => (int)Math.Floor(orderTotal * BasePointsPerPound * (decimal)GetTierMultiplier(tier));

    private static double GetTierMultiplier(LoyaltyTier tier) => tier switch
    {
        LoyaltyTier.Silver => 1.25,
        LoyaltyTier.Gold => 1.5,
        LoyaltyTier.Platinum => 2.0,
        _ => 1.0 // Bronze
    };
}
