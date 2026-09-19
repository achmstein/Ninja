namespace Ninja.Catalog.API.Infrastructure.EntityConfigurations;

class BranchItemOverrideEntityTypeConfiguration : IEntityTypeConfiguration<BranchItemOverride>
{
    public void Configure(EntityTypeBuilder<BranchItemOverride> builder)
    {
        builder.ToTable("BranchItemOverrides");

        builder.HasKey(o => o.Id);

        builder.Property(o => o.BranchId).IsRequired();
        builder.Property(o => o.CatalogItemId).IsRequired();
        builder.Property(o => o.IsAvailable).IsRequired();
        builder.Property(o => o.IsOutOfStock).IsRequired().HasDefaultValue(false);

        builder.Property(o => o.PriceOverride).HasPrecision(18, 2);
        builder.Property(o => o.OfferPriceOverride).HasPrecision(18, 2);

        builder.HasOne(o => o.CatalogItem)
            .WithMany()
            .HasForeignKey(o => o.CatalogItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(o => new { o.BranchId, o.CatalogItemId }).IsUnique();
    }
}
