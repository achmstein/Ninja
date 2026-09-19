using Ninja.Catalog.API.Model;

namespace Ninja.Catalog.API.IntegrationEvents.EventHandling;

public class OrderConfirmedWithPreferencesIntegrationEventHandler(
    CatalogContext catalogContext,
    ILogger<OrderConfirmedWithPreferencesIntegrationEventHandler> logger) :
    IIntegrationEventHandler<OrderConfirmedWithPreferencesIntegrationEvent>
{
    public async Task Handle(OrderConfirmedWithPreferencesIntegrationEvent @event)
    {
        logger.LogInformation(
            "Handling OrderConfirmedWithPreferencesIntegrationEvent for order {OrderId} with {ItemCount} items",
            @event.OrderId, @event.Items.Count);

        foreach (var item in @event.Items)
        {
            if (item.Customizations.Count == 0)
            {
                continue;
            }

            // Find or create preference
            var existingPreference = await catalogContext.UserItemPreferences
                .Include(p => p.SelectedOptions)
                .FirstOrDefaultAsync(p =>
                    p.UserId == @event.BuyerIdentityGuid &&
                    p.CatalogItemId == item.ProductId);

            if (existingPreference != null)
            {
                // Update existing preference - clear old options and add new ones
                catalogContext.UserPreferenceOptions.RemoveRange(existingPreference.SelectedOptions);
                existingPreference.SelectedOptions.Clear();

                foreach (var customization in item.Customizations)
                {
                    existingPreference.SelectedOptions.Add(new UserPreferenceOption
                    {
                        CustomizationId = customization.CustomizationId,
                        OptionId = customization.OptionId
                    });
                }
                existingPreference.LastUpdated = DateTime.UtcNow;

                logger.LogInformation(
                    "Updated preference for user {UserId} and item {ItemId} with {OptionCount} options",
                    @event.BuyerIdentityGuid, item.ProductId, item.Customizations.Count);
            }
            else
            {
                // Create new preference
                var newPreference = new UserItemPreference
                {
                    UserId = @event.BuyerIdentityGuid,
                    CatalogItemId = item.ProductId,
                    LastUpdated = DateTime.UtcNow
                };

                foreach (var customization in item.Customizations)
                {
                    newPreference.SelectedOptions.Add(new UserPreferenceOption
                    {
                        CustomizationId = customization.CustomizationId,
                        OptionId = customization.OptionId
                    });
                }

                catalogContext.UserItemPreferences.Add(newPreference);

                logger.LogInformation(
                    "Created new preference for user {UserId} and item {ItemId} with {OptionCount} options",
                    @event.BuyerIdentityGuid, item.ProductId, item.Customizations.Count);
            }
        }

        await catalogContext.SaveChangesAsync();
        logger.LogInformation("Saved preferences for order {OrderId}", @event.OrderId);
    }
}
