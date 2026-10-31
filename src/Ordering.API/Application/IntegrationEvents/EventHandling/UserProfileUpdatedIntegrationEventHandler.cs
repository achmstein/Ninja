#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// A customer renamed themselves: their Buyer takes the new name. Every order
/// list, the kitchen and the rider read the buyer's name live, so the orders
/// already placed say the new name too.
/// </summary>
public class UserProfileUpdatedIntegrationEventHandler(
    IBuyerRepository buyerRepository,
    ILogger<UserProfileUpdatedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<UserProfileUpdatedIntegrationEvent>
{
    public async Task Handle(UserProfileUpdatedIntegrationEvent @event)
    {
        if (string.IsNullOrWhiteSpace(@event.DisplayName))
        {
            return;
        }

        var buyer = await buyerRepository.FindAsync(@event.UserId);

        if (buyer is null)
        {
            logger.LogInformation("No buyer for user {UserId}, skipping name sync", @event.UserId);
            return;
        }

        if (buyer.Name != @event.DisplayName)
        {
            buyer.UpdateName(@event.DisplayName);
            await buyerRepository.UnitOfWork.SaveEntitiesAsync();
            logger.LogInformation("Updated buyer name for user {UserId} to {Name}", @event.UserId, @event.DisplayName);
        }
    }
}
