namespace Ninja.Inventory.Infrastructure.EntityConfigurations;

class StockItemEntityTypeConfiguration : IEntityTypeConfiguration<StockItem>
{
    public void Configure(EntityTypeBuilder<StockItem> builder)
    {
        builder.ToTable("stock_items");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .UseHiLo("stockitemseq", "inventory");

        builder.Ignore(s => s.DomainEvents);

        // Either language may be the only one written; the name itself is always there
        builder.OwnsOne(s => s.Name, name =>
        {
            name.Property(n => n.En).HasColumnName("NameEn").HasMaxLength(200);
            name.Property(n => n.Ar).HasColumnName("NameAr").HasMaxLength(200);
        });
        builder.Navigation(s => s.Name).IsRequired();

        builder.Property(s => s.Unit).HasMaxLength(16).IsRequired();
        builder.Property(s => s.PackSize).HasPrecision(18, 3);
        // Optional: both columns null is no pack name
        builder.OwnsOne(s => s.PackName, pack =>
        {
            pack.Property(n => n.En).HasColumnName("PackNameEn").HasMaxLength(50);
            pack.Property(n => n.Ar).HasColumnName("PackNameAr").HasMaxLength(50);
        });

        builder.HasIndex(s => s.IsActive);
    }
}
