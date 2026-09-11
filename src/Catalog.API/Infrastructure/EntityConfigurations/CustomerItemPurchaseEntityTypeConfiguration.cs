namespace Chillax.Catalog.API.Infrastructure.EntityConfigurations;

class CustomerItemPurchaseEntityTypeConfiguration
    : IEntityTypeConfiguration<CustomerItemPurchase>
{
    public void Configure(EntityTypeBuilder<CustomerItemPurchase> builder)
    {
        builder.ToTable("CustomerItemPurchases");

        builder.HasKey(p => p.Id);

        // One row per item per order: makes event redelivery / re-confirmation
        // idempotent, and lets a customer's "usuals" be COUNT(*) of orders.
        builder.HasIndex(p => new { p.UserId, p.CatalogItemId, p.OrderId })
            .IsUnique();

        // The ranking query filters by UserId then groups by item.
        builder.HasIndex(p => p.UserId);

        builder.Property(p => p.UserId)
            .IsRequired()
            .HasMaxLength(256);

        builder.HasOne(p => p.CatalogItem)
            .WithMany()
            .HasForeignKey(p => p.CatalogItemId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
