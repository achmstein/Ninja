namespace Ninja.Catalog.API.Infrastructure.EntityConfigurations;

class CatalogItemPairingEntityTypeConfiguration : IEntityTypeConfiguration<CatalogItemPairing>
{
    public void Configure(EntityTypeBuilder<CatalogItemPairing> builder)
    {
        builder.ToTable("CatalogItemPairings");

        builder.HasKey(p => p.Id);

        // Deleting either item drops the pairing: a dish that is gone is not suggested
        builder.HasOne(p => p.CatalogItem)
            .WithMany(i => i.Pairings)
            .HasForeignKey(p => p.CatalogItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(p => p.PairedItem)
            .WithMany()
            .HasForeignKey(p => p.PairedItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(p => new { p.CatalogItemId, p.PairedItemId }).IsUnique();
        builder.HasIndex(p => new { p.CatalogItemId, p.DisplayOrder });
    }
}
