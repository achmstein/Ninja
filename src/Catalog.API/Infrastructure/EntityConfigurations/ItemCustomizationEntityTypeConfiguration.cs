namespace Ninja.Catalog.API.Infrastructure.EntityConfigurations;

class ItemCustomizationEntityTypeConfiguration
    : IEntityTypeConfiguration<ItemCustomization>
{
    public void Configure(EntityTypeBuilder<ItemCustomization> builder)
    {
        builder.ToTable("ItemCustomizations");

        // Configure Name as JSON column
        builder.OwnsOne(ic => ic.Name, b => b.ToJson());

        builder.HasMany(ic => ic.Options)
            .WithOne(o => o.ItemCustomization)
            .HasForeignKey(o => o.ItemCustomizationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(ic => new { ic.CatalogItemId, ic.DisplayOrder });
    }
}
