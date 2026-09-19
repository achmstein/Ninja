using Ninja.Loyalty.API.IntegrationEvents.Events;
using Ninja.Loyalty.API.Infrastructure;
using Ninja.Loyalty.API.Model;
using Microsoft.EntityFrameworkCore;

namespace Ninja.Loyalty.API.IntegrationEvents.EventHandling;

/// <summary>
/// A customer was put on an order after it was placed — the till forgot, or
/// named the wrong regular. Whoever held the order before gives back what it
/// earned them, and the new account earns it at its own rate and tier; only
/// for a confirmed order, since one still pending earns at its own
/// confirmation, which by then carries the buyer. Both sides go by what the
/// account holds from this order right now — the award, less what earlier
/// moves took back — so A to B and back to A ends where it began, and a
/// redelivery finds nothing left to do.
/// </summary>
public class OrderCustomerAssignedIntegrationEventHandler(
    LoyaltyContext context,
    ILogger<OrderCustomerAssignedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderCustomerAssignedIntegrationEvent>
{
    public async Task Handle(OrderCustomerAssignedIntegrationEvent @event)
    {
        logger.LogInformation(
            "Handling OrderCustomerAssignedIntegrationEvent: OrderId={OrderId}, UserId={UserId}, PreviousUserId={PreviousUserId}, Status={Status}, Total={Total}",
            @event.OrderId, @event.BuyerIdentityGuid, @event.PreviousBuyerIdentityGuid, @event.OrderStatus, @event.OrderTotal);

        if (!string.Equals(@event.OrderStatus, "Confirmed", StringComparison.OrdinalIgnoreCase))
        {
            logger.LogInformation(
                "Order {OrderId} is {Status} - it earns at confirmation, which now carries the buyer",
                @event.OrderId, @event.OrderStatus);
            return;
        }

        // The order changed hands: the account it left gives back first, so
        // the same points are never held twice
        var changedHands = !string.IsNullOrEmpty(@event.PreviousBuyerIdentityGuid)
            && !string.Equals(@event.PreviousBuyerIdentityGuid, @event.BuyerIdentityGuid, StringComparison.Ordinal);

        if (changedHands)
        {
            await ReverseAsync(@event);
        }

        await AwardAsync(@event);

        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Take back what the previous account still holds from the order — the
    /// award, less anything earlier moves already took. Capped at the
    /// balance: points already spent are not a debt, so the move can come up
    /// short, and says so.
    /// </summary>
    private async Task ReverseAsync(OrderCustomerAssignedIntegrationEvent @event)
    {
        var previous = await context.Accounts
            .FirstOrDefaultAsync(a => a.UserId == @event.PreviousBuyerIdentityGuid);

        if (previous == null)
        {
            logger.LogInformation(
                "Previous user {UserId} has no loyalty account - order {OrderId} earned nothing to move",
                @event.PreviousBuyerIdentityGuid, @event.OrderId);
            return;
        }

        var held = await HeldForOrderAsync(previous.Id, @event.OrderId);

        if (held <= 0)
        {
            // Never earned here, or already moved away — where a redelivery lands
            logger.LogInformation(
                "Account {AccountId} holds no points from order {OrderId} - nothing to move",
                previous.Id, @event.OrderId);
            return;
        }

        var to = @event.CustomerName ?? @event.BuyerIdentityGuid ?? "another customer";
        var deducted = previous.DeductPoints(
            held,
            ReassignReference(@event.OrderId, previous.Id),
            $"Order #{@event.OrderId} moved to {to}");

        if (deducted < held)
        {
            logger.LogWarning(
                "Account {AccountId} held {Held} points from order {OrderId} but only {Deducted} were left to take back - the rest was already spent",
                previous.Id, held, @event.OrderId, deducted);
        }
        else
        {
            logger.LogInformation(
                "Moved {Points} points off account {AccountId} for order {OrderId}. New balance: {Balance}",
                deducted, previous.Id, @event.OrderId, previous.PointsBalance);
        }
    }

    /// <summary>
    /// Award the new account what the order earns at its tier — unless it
    /// already holds points from this order, as after a redelivery, or a
    /// confirmation that already carried this buyer.
    /// </summary>
    private async Task AwardAsync(OrderCustomerAssignedIntegrationEvent @event)
    {
        // A bare name identifies nobody — nothing to credit, nothing to match on
        if (string.IsNullOrEmpty(@event.BuyerIdentityGuid))
        {
            logger.LogInformation(
                "Order {OrderId} was given a name without an account, skipping loyalty points",
                @event.OrderId);
            return;
        }

        var account = await context.Accounts
            .FirstOrDefaultAsync(a => a.UserId == @event.BuyerIdentityGuid);

        if (account == null)
        {
            logger.LogInformation(
                "User {UserId} has no loyalty account, skipping points for order {OrderId}",
                @event.BuyerIdentityGuid, @event.OrderId);
            return;
        }

        if (!string.IsNullOrEmpty(@event.CustomerName) && account.UserDisplayName != @event.CustomerName)
        {
            account.UserDisplayName = @event.CustomerName;
        }

        var held = await HeldForOrderAsync(account.Id, @event.OrderId);

        if (held > 0)
        {
            logger.LogInformation(
                "Account {AccountId} already holds {Points} points from order {OrderId} - skipping",
                account.Id, held, @event.OrderId);
            return;
        }

        var pointsToAward = OrderStatusChangedToConfirmedIntegrationEventHandler.PointsToAward(@event.OrderTotal, account.CurrentTier);

        if (pointsToAward > 0)
        {
            account.AddPoints(
                pointsToAward,
                TransactionType.Purchase,
                @event.OrderId.ToString());

            logger.LogInformation(
                "Awarded {Points} points to user {UserId} for order {OrderId} assigned after the fact (tier={Tier}). New balance: {Balance}",
                pointsToAward, @event.BuyerIdentityGuid, @event.OrderId, account.CurrentTier, account.PointsBalance);
        }
    }

    /// <summary>
    /// What the account holds from the order: the purchase filed under it,
    /// less the moves filed against it. Redemptions and refund clawbacks are
    /// left out — the one is the customer's own spending, the other money
    /// that went back and stays gone.
    /// </summary>
    private Task<int> HeldForOrderAsync(int accountId, int orderId)
    {
        var orderReference = orderId.ToString();
        var reassignReference = ReassignReference(orderId, accountId);

        return context.Transactions
            .Where(t => t.AccountId == accountId
                && ((t.Type == TransactionType.Purchase && t.ReferenceId == orderReference)
                    || t.ReferenceId == reassignReference))
            .SumAsync(t => t.Points);
    }

    /// <summary>Where a move off an account is filed: per order, per account it left.</summary>
    private static string ReassignReference(int orderId, int accountId) => $"reassign:{orderId}:{accountId}";
}
