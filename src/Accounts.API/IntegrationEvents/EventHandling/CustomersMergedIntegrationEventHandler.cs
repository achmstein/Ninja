using Microsoft.EntityFrameworkCore;
using Ninja.Accounts.API.IntegrationEvents.Events;
using Ninja.Accounts.Infrastructure;
using Ninja.EventBus.Abstractions;

namespace Ninja.Accounts.API.IntegrationEvents.EventHandling;

/// <summary>
/// Two tabs become one. When only the merged-away account had a tab, the tab
/// changes hands whole. When both had one, the lines move onto the kept
/// customer's tab with what they add up to, and the emptied tab is removed:
/// one history, one balance, nothing owed twice or forgiven. All in one
/// transaction; a second delivery finds no tab left to move.
/// </summary>
public class CustomersMergedIntegrationEventHandler(
    AccountsContext context,
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
            await using var transaction = await context.Database.BeginTransactionAsync();
            var from = await context.CustomerAccounts.AsNoTracking().FirstOrDefaultAsync(a => a.CustomerId == @event.FromUserId);
            if (from is null)
            {
                logger.LogInformation("No tab for merged user {From}; nothing to move", @event.FromUserId);
                return;
            }
            var into = await context.CustomerAccounts.AsNoTracking().FirstOrDefaultAsync(a => a.CustomerId == @event.IntoUserId);
            var now = DateTime.UtcNow;
            if (into is null)
            {
                await context.CustomerAccounts.Where(a => a.Id == from.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(a => a.CustomerId, @event.IntoUserId)
                        .SetProperty(a => a.CustomerName, @event.IntoDisplayName)
                        .SetProperty(a => a.UpdatedAt, now));
            }
            else
            {
                await context.AccountTransactions.Where(t => t.CustomerAccountId == from.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(t => t.CustomerAccountId, into.Id));
                await context.CustomerAccounts.Where(a => a.Id == into.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(a => a.Balance, a => a.Balance + from.Balance)
                        .SetProperty(a => a.UpdatedAt, now));
                await context.CustomerAccounts.Where(a => a.Id == from.Id).ExecuteDeleteAsync();
            }
            await transaction.CommitAsync();
            logger.LogInformation("Moved the tab of merged user {From} ({Balance}) to {Into}", @event.FromUserId, from.Balance, @event.IntoUserId);
        });
    }
}
