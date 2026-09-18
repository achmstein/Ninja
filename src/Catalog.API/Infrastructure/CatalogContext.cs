namespace Chillax.Catalog.API.Infrastructure;

/// <remarks>
/// Add migrations using the following command inside the 'Catalog.API' project directory:
///
/// dotnet ef migrations add --context CatalogContext [migration-name]
/// </remarks>
public class CatalogContext : DbContext
{
    public CatalogContext(DbContextOptions<CatalogContext> options, IConfiguration configuration) : base(options)
    {
    }

    public required DbSet<CatalogItem> CatalogItems { get; set; }
    public required DbSet<CatalogType> CatalogTypes { get; set; }
    public required DbSet<ItemCustomization> ItemCustomizations { get; set; }
    public required DbSet<CustomizationOption> CustomizationOptions { get; set; }
    public required DbSet<UserItemPreference> UserItemPreferences { get; set; }
    public required DbSet<UserPreferenceOption> UserPreferenceOptions { get; set; }
    public required DbSet<UserItemFavorite> UserItemFavorites { get; set; }
    public required DbSet<CustomerItemPurchase> CustomerItemPurchases { get; set; }
    public required DbSet<BranchItemOverride> BranchItemOverrides { get; set; }
    public required DbSet<BranchOptionStockOut> BranchOptionStockOuts { get; set; }
    public required DbSet<PromoCode> PromoCodes { get; set; }
    public required DbSet<PromoRedemption> PromoRedemptions { get; set; }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        builder.ApplyConfiguration(new CatalogTypeEntityTypeConfiguration());
        builder.ApplyConfiguration(new CatalogItemEntityTypeConfiguration());
        builder.ApplyConfiguration(new ItemCustomizationEntityTypeConfiguration());
        builder.ApplyConfiguration(new CustomizationOptionEntityTypeConfiguration());
        builder.ApplyConfiguration(new UserItemPreferenceEntityTypeConfiguration());
        builder.ApplyConfiguration(new UserPreferenceOptionEntityTypeConfiguration());
        builder.ApplyConfiguration(new UserItemFavoriteEntityTypeConfiguration());
        builder.ApplyConfiguration(new CustomerItemPurchaseEntityTypeConfiguration());
        builder.ApplyConfiguration(new BranchItemOverrideEntityTypeConfiguration());
        builder.ApplyConfiguration(new BranchOptionStockOutEntityTypeConfiguration());
        builder.ApplyConfiguration(new PromoCodeEntityTypeConfiguration());
        builder.ApplyConfiguration(new PromoRedemptionEntityTypeConfiguration());

        // Add the outbox table to this context
        builder.UseIntegrationEventLogs();
    }
}
