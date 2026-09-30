using Ninja.Catalog.API.Model;

namespace Ninja.Catalog.API.Infrastructure;

/// <summary>
/// Plants the menu once, on an empty catalog, according to the stack's
/// <see cref="SeedProfile"/>: nothing for a customer (the wizard fills it),
/// a small generic café for a demo, tenant one's own data for dev and tests.
/// </summary>
public partial class CatalogContextSeed(
    IConfiguration configuration,
    ILogger<CatalogContextSeed> logger) : IDbSeeder<CatalogContext>
{
    public async Task SeedAsync(CatalogContext context)
    {
        if (context.CatalogItems.Any())
        {
            return;
        }

        var profile = SeedProfile.Of(configuration);
        switch (profile)
        {
            case SeedProfile.Chillax:
                await SeedChillaxAsync(context);
                break;
            case SeedProfile.Sample:
                await SeedSampleAsync(context);
                break;
            default:
                logger.LogInformation("Seed profile {Profile}: the menu starts empty", profile);
                break;
        }
    }

    /// <summary>
    /// What each item suggests alongside it ("goes well with"), by English
    /// name, in order; written once the items are in, since it names them by id.
    /// </summary>
    private async Task SeedPairingsAsync(CatalogContext context, IReadOnlyList<(string Item, string[] Paired)> pairings)
    {
        var byName = (await context.CatalogItems.ToListAsync()).ToDictionary(i => i.Name.Primary);
        var rows = pairings
            .SelectMany(p => p.Paired.Select((paired, i) => new CatalogItemPairing
            {
                CatalogItemId = byName[p.Item].Id,
                PairedItemId = byName[paired].Id,
                DisplayOrder = i + 1
            }))
            .ToList();

        await context.CatalogItemPairings.AddRangeAsync(rows);
        await context.SaveChangesAsync();
        logger.LogInformation("Seeded {NumPairings} pairings", rows.Count);
    }

    /// <summary>Explicit category ids leave the identity sequence at 1; the next category created through the API must not collide.</summary>
    private static Task ResetCategorySequenceAsync(CatalogContext context)
        => context.Database.ExecuteSqlRawAsync(
            """SELECT setval(pg_get_serial_sequence('"CatalogType"', 'Id'), (SELECT MAX("Id") FROM "CatalogType"))""");
}
