using Microsoft.EntityFrameworkCore;
using Ninja.Loyalty.API.Infrastructure;
using Ninja.Loyalty.API.IntegrationEvents.Events;

namespace Ninja.Loyalty.API.IntegrationEvents.EventHandling;

/// <summary>
/// Two memberships become one. When only the merged-away account was a
/// member, the membership changes hands. When both were, the kept one takes
/// the other's points, its lifetime points (so the tier is the one the two
/// earned together) and its history, and the emptied membership is removed.
/// A second delivery finds no membership left to move.
/// </summary>
public class CustomersMergedIntegrationEventHandler(
    LoyaltyContext context,
    ILogger<CustomersMergedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<CustomersMergedIntegrationEvent>
{
    public async Task Handle(CustomersMergedIntegrationEvent @event)
    {
        if (string.IsNullOrWhiteSpace(@event.FromUserId) || string.IsNullOrWhiteSpace(@event.IntoUserId) || @event.FromUserId == @event.IntoUserId)
            return;

        var strategy = context.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            context.ChangeTracker.Clear();
            await using var transaction = await context.Database.BeginTransactionAsync();
            var from = await context.Accounts.FirstOrDefaultAsync(a => a.UserId == @event.FromUserId);
            if (from is null)
            {
                logger.LogInformation("Merged user {From} was not a member; nothing to move", @event.FromUserId);
                return;
            }
            var into = await context.Accounts.FirstOrDefaultAsync(a => a.UserId == @event.IntoUserId);
            if (into is null)
            {
                from.UserId = @event.IntoUserId;
                from.UserDisplayName = @event.IntoDisplayName;
                from.UpdatedAt = DateTime.UtcNow;
                await context.SaveChangesAsync();
            }
            else
            {
                await context.Transactions.Where(t => t.AccountId == from.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(t => t.AccountId, into.Id));
                into.Absorb(from.PointsBalance, from.LifetimePoints);
                context.Accounts.Remove(from);
                await context.SaveChangesAsync();
            }
            await transaction.CommitAsync();
            logger.LogInformation("Moved the membership of merged user {From} ({Points} points) to {Into}", @event.FromUserId, from.PointsBalance, @event.IntoUserId);
        });
    }
}
