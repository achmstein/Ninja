#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// The merged-away account's orders and saved addresses become the kept
/// customer's. When the kept customer never ordered, the other's buyer record
/// changes hands with its orders; when both did, the orders move to the kept
/// buyer. Each statement finds nothing to do the second time.
/// </summary>
public class CustomersMergedIntegrationEventHandler(
    OrderingContext context,
    ILogger<CustomersMergedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<CustomersMergedIntegrationEvent>
{
    public async Task Handle(CustomersMergedIntegrationEvent @event)
    {
        if (string.IsNullOrWhiteSpace(@event.FromUserId) || string.IsNullOrWhiteSpace(@event.IntoUserId) || @event.FromUserId == @event.IntoUserId)
            return;

        var from = await context.Buyers.AsNoTracking().FirstOrDefaultAsync(b => b.IdentityGuid == @event.FromUserId);
        var moved = 0;
        if (from is not null)
        {
            var into = await context.Buyers.AsNoTracking().FirstOrDefaultAsync(b => b.IdentityGuid == @event.IntoUserId);
            if (into is null)
            {
                await context.Buyers.Where(b => b.Id == from.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(b => b.IdentityGuid, @event.IntoUserId)
                        .SetProperty(b => b.Name, string.IsNullOrWhiteSpace(@event.IntoDisplayName) ? from.Name : @event.IntoDisplayName));
            }
            else
            {
                moved = await context.Orders.IgnoreQueryFilters().Where(o => o.BuyerId == from.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(o => o.BuyerId, (int?)into.Id));
            }
        }

        var addresses = await context.CustomerAddresses.Where(a => a.UserId == @event.FromUserId)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.UserId, @event.IntoUserId));

        logger.LogInformation("Merged user {From} into {Into}: {Orders} order(s) moved to the kept buyer, {Addresses} address(es)",
            @event.FromUserId, @event.IntoUserId, moved, addresses);
    }
}
