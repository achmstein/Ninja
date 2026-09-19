using Ninja.Loyalty.API.IntegrationEvents.Events;
using Ninja.Loyalty.API.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Ninja.Loyalty.API.IntegrationEvents.EventHandling;

public class UserProfileUpdatedIntegrationEventHandler(
    LoyaltyContext context,
    ILogger<UserProfileUpdatedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<UserProfileUpdatedIntegrationEvent>
{
    public async Task Handle(UserProfileUpdatedIntegrationEvent @event)
    {
        var account = await context.Accounts
            .FirstOrDefaultAsync(a => a.UserId == @event.UserId);

        if (account == null)
        {
            logger.LogInformation("No loyalty account for user {UserId}, skipping name sync", @event.UserId);
            return;
        }

        if (account.UserDisplayName != @event.DisplayName)
        {
            account.UserDisplayName = @event.DisplayName;
            await context.SaveChangesAsync();
            logger.LogInformation("Updated loyalty display name for user {UserId} to {Name}", @event.UserId, @event.DisplayName);
        }
    }
}
