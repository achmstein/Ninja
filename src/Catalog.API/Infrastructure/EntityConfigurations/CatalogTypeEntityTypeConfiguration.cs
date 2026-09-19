namespace Ninja.Catalog.API.Infrastructure.EntityConfigurations;

class CatalogTypeEntityTypeConfiguration
    : IEntityTypeConfiguration<CatalogType>
{
    public void Configure(EntityTypeBuilder<CatalogType> builder)
    {
        builder.ToTable("CatalogType");

        // Configure Name as JSON column
        builder.OwnsOne(ct => ct.Name, b => b.ToJson());
    }
}
