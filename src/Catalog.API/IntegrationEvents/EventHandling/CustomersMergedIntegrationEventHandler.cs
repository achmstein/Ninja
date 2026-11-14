namespace Ninja.Catalog.API.IntegrationEvents.EventHandling;

/// <summary>
/// What the menu remembers of the merged-away account goes to the kept
/// customer: what they bought (their "usual"), their favourites and how they
/// take each item. Where the kept customer already has a favourite or a way
/// of taking the same item, theirs stands. Each statement finds nothing to do
/// the second time.
/// </summary>
public class CustomersMergedIntegrationEventHandler(
    CatalogContext context,
    ILogger<CustomersMergedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<CustomersMergedIntegrationEvent>
{
    public async Task Handle(CustomersMergedIntegrationEvent @event)
    {
        var (from, into) = (@event.FromUserId, @event.IntoUserId);
        if (string.IsNullOrWhiteSpace(from) || string.IsNullOrWhiteSpace(into) || from == into)
            return;

        var purchases = await context.CustomerItemPurchases.Where(p => p.UserId == from)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.UserId, into));

        await context.UserItemFavorites
            .Where(f => f.UserId == from && context.UserItemFavorites.Any(o => o.UserId == into && o.CatalogItemId == f.CatalogItemId))
            .ExecuteDeleteAsync();
        var favorites = await context.UserItemFavorites.Where(f => f.UserId == from)
            .ExecuteUpdateAsync(s => s.SetProperty(f => f.UserId, into));

        // A preference's chosen options go with it (they hang off the preference row)
        await context.UserItemPreferences
            .Where(p => p.UserId == from && context.UserItemPreferences.Any(o => o.UserId == into && o.CatalogItemId == p.CatalogItemId))
            .ExecuteDeleteAsync();
        var preferences = await context.UserItemPreferences.Where(p => p.UserId == from)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.UserId, into));

        logger.LogInformation("Merged user {From} into {Into}: {Purchases} purchase(s), {Favorites} favourite(s), {Preferences} preference(s)",
            from, into, purchases, favorites, preferences);
    }
}
