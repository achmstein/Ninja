namespace Chillax.Inventory.Infrastructure.EntityConfigurations;

class StockItemEntityTypeConfiguration : IEntityTypeConfiguration<StockItem>
{
    public void Configure(EntityTypeBuilder<StockItem> builder)
    {
        builder.ToTable("stock_items");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .UseHiLo("stockitemseq", "inventory");

        builder.Ignore(s => s.DomainEvents);

        builder.OwnsOne(s => s.Name, name =>
        {
            name.Property(n => n.En).HasColumnName("NameEn").HasMaxLength(200).IsRequired();
            name.Property(n => n.Ar).HasColumnName("NameAr").HasMaxLength(200);
        });

        builder.Property(s => s.Unit).HasMaxLength(16).IsRequired();
        builder.Property(s => s.PackSize).HasPrecision(18, 3);
        builder.Property(s => s.PackName).HasMaxLength(50);

        builder.HasIndex(s => s.IsActive);
    }
}
