namespace Ninja.Catalog.API.Infrastructure.EntityConfigurations;

class CustomizationOptionEntityTypeConfiguration
    : IEntityTypeConfiguration<CustomizationOption>
{
    public void Configure(EntityTypeBuilder<CustomizationOption> builder)
    {
        builder.ToTable("CustomizationOptions");

        // Configure Name as JSON column
        builder.OwnsOne(co => co.Name, b => b.ToJson());

        builder.Property(co => co.PriceAdjustment)
            .HasPrecision(18, 2);

        builder.HasIndex(co => new { co.ItemCustomizationId, co.DisplayOrder });
    }
}
