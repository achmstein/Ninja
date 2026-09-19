namespace Ninja.Catalog.API.Infrastructure.EntityConfigurations;

class CatalogItemEntityTypeConfiguration
    : IEntityTypeConfiguration<CatalogItem>
{
    public void Configure(EntityTypeBuilder<CatalogItem> builder)
    {
        builder.ToTable("Catalog");

        // Configure Name as JSON column
        builder.OwnsOne(ci => ci.Name, b => b.ToJson());

        // Configure Description as JSON column
        builder.OwnsOne(ci => ci.Description, b => b.ToJson());

        builder.Property(ci => ci.Price)
            .HasPrecision(18, 2);

        builder.Property(ci => ci.OfferPrice)
            .HasPrecision(18, 2);

        builder.Ignore(ci => ci.EffectivePrice);

        builder.HasOne(ci => ci.CatalogType)
            .WithMany()
            .HasForeignKey(ci => ci.CatalogTypeId);

        builder.HasMany(ci => ci.Customizations)
            .WithOne(c => c.CatalogItem)
            .HasForeignKey(c => c.CatalogItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(ci => ci.IsAvailable);
    }
}
