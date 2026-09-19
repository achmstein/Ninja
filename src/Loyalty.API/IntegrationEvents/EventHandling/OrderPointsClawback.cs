using Ninja.Loyalty.API.IntegrationEvents.Events;
using Ninja.Loyalty.API.Infrastructure;
using Ninja.Loyalty.API.Model;
using Microsoft.EntityFrameworkCore;

namespace Ninja.Loyalty.API.IntegrationEvents.EventHandling;

/// <summary>
/// The one way points an order earned go back — behind a credit note and a
/// void alike. The purchase transaction filed under the order says who earned
/// them and how many; the reversal says what share of the order's value came
/// back, and that share of the points goes with it. Never below zero: points
/// already spent are not a debt. Idempotent on the reference the caller
/// files it under, because the bus redelivers.
/// </summary>
internal static class OrderPointsClawback
{
    /// <param name="reference">
    /// What the deduction is filed under — unique per cause and order, so a
    /// redelivery finds it and stops.
    /// </param>
    /// <param name="description">What the customer reads against the deduction.</param>
    /// <param name="cause">The credit note or void, for the log.</param>
    /// <returns>The points actually taken back; zero when nothing applied.</returns>
    public static async Task<int> ApplyAsync(
        LoyaltyContext context,
        ILogger logger,
        RefundOrderReversal reversal,
        string reference,
        string description,
        string cause)
    {
        if (reversal.OrderAmount <= 0 || reversal.RefundedAmount <= 0)
            return 0;

        var orderReference = reversal.OrderId.ToString();

        // The latest award is the account holding the points now: an order
        // that changed hands earned once on every account it passed through
        var earned = await context.Transactions
            .Where(t => t.ReferenceId == orderReference && t.Type == TransactionType.Purchase)
            .OrderByDescending(t => t.Id)
            .FirstOrDefaultAsync();

        if (earned is null)
        {
            // A guest order, or one placed before the customer joined
            logger.LogInformation("Order {OrderId} earned no points - nothing to claw back for {Cause}", reversal.OrderId, cause);
            return 0;
        }

        if (await context.Transactions.AnyAsync(t => t.ReferenceId == reference))
        {
            logger.LogInformation("{Cause} already reversed order {OrderId} - skipping redelivery", cause, reversal.OrderId);
            return 0;
        }

        var account = await context.Accounts.FirstAsync(a => a.Id == earned.AccountId);

        var share = Math.Min(1m, reversal.RefundedAmount / reversal.OrderAmount);
        var points = (int)Math.Round(earned.Points * share, MidpointRounding.AwayFromZero);

        var deducted = account.DeductPoints(points, reference, description);

        logger.LogInformation(
            "Clawed back {Points} of {Earned} points from account {AccountId} for order {OrderId} ({Cause})",
            deducted, earned.Points, account.Id, reversal.OrderId, cause);

        return deducted;
    }
}
