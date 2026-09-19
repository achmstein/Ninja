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

    /// <summary>Explicit category ids leave the identity sequence at 1; the next category created through the API must not collide.</summary>
    private static Task ResetCategorySequenceAsync(CatalogContext context)
        => context.Database.ExecuteSqlRawAsync(
            """SELECT setval(pg_get_serial_sequence('"CatalogType"', 'Id'), (SELECT MAX("Id") FROM "CatalogType"))""");
}
