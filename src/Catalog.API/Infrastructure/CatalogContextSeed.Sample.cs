namespace Ninja.Catalog.API.Infrastructure;

/// <summary>
/// A small menu so a demo looks alive the moment it comes up, for the
/// stack's kind of place (<see cref="SampleMenus"/>): categories in order,
/// items in both languages, and the customizations such a place has. The
/// owner replaces all of it from the admin app.
/// </summary>
public partial class CatalogContextSeed
{
    private async Task SeedSampleAsync(CatalogContext context)
    {
        var business = SeedProfile.Business(configuration);
        var menu = SampleMenus.For(business);

        await context.CatalogTypes.AddRangeAsync(menu.Types);
        await context.SaveChangesAsync();
        await ResetCategorySequenceAsync(context);

        await context.CatalogItems.AddRangeAsync(menu.Items);
        await context.SaveChangesAsync();
        logger.LogInformation("Seeded the sample {Business} menu: {NumTypes} categories, {NumItems} items", business, menu.Types.Count, menu.Items.Count);

        var byName = menu.Items.ToDictionary(i => i.Name.Primary);
        foreach (var (item, customization) in menu.Customizations)
        {
            customization.CatalogItemId = byName[item].Id;
        }

        await context.ItemCustomizations.AddRangeAsync(menu.Customizations.Select(c => c.Customization));
        await context.SaveChangesAsync();
        logger.LogInformation("Seeded {NumCustomizations} sample customizations", menu.Customizations.Count);

        var pairings = menu.Pairings
            .SelectMany(p => p.Paired.Select((paired, i) => new CatalogItemPairing
            {
                CatalogItemId = byName[p.Item].Id,
                PairedItemId = byName[paired].Id,
                DisplayOrder = i + 1
            }))
            .ToList();
        await context.CatalogItemPairings.AddRangeAsync(pairings);
        await context.SaveChangesAsync();
        logger.LogInformation("Seeded {NumPairings} sample pairings", pairings.Count);
    }
}
