using Ninja.Accounts.API.Application.Commands;
using Ninja.Accounts.API.IntegrationEvents.Events;
using Ninja.Accounts.Domain.AggregatesModel.CustomerAccountAggregate;
using Ninja.EventBus.Abstractions;

namespace Ninja.Accounts.API.IntegrationEvents.EventHandling;

public class UserProfileUpdatedIntegrationEventHandler(
    ICustomerAccountRepository accountRepository,
    ILogger<UserProfileUpdatedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<UserProfileUpdatedIntegrationEvent>
{
    // A posting landing on the tab at the same moment would refuse the save; read again and rename
    public Task Handle(UserProfileUpdatedIntegrationEvent @event)
        => AccountWriteRetry.RunAsync(accountRepository, logger, @event.UserId, async () =>
        {
            await Rename(@event);
            return true;
        });

    private async Task Rename(UserProfileUpdatedIntegrationEvent @event)
    {
        var account = await accountRepository.GetByCustomerIdAsync(@event.UserId);

        if (account == null)
        {
            logger.LogInformation("No account for user {UserId}, skipping name sync", @event.UserId);
            return;
        }

        if (account.CustomerName != @event.DisplayName)
        {
            account.UpdateCustomerName(@event.DisplayName);
            await accountRepository.UnitOfWork.SaveEntitiesAsync();
            logger.LogInformation("Updated account name for user {UserId} to {Name}", @event.UserId, @event.DisplayName);
        }
    }
}
