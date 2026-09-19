namespace Ninja.Inventory.Infrastructure.EntityConfigurations;

class PurchaseEntityTypeConfiguration : IEntityTypeConfiguration<Purchase>
{
    public void Configure(EntityTypeBuilder<Purchase> builder)
    {
        builder.ToTable("purchases");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .UseHiLo("purchaseseq", "inventory");

        builder.Ignore(p => p.DomainEvents);
        builder.Ignore(p => p.Total);

        builder.Property(p => p.Supplier).HasMaxLength(200);
        builder.Property(p => p.InvoiceRef).HasMaxLength(100);
        builder.Property(p => p.ReceivedBy).HasMaxLength(64).IsRequired();

        builder.HasMany(p => p.Lines)
            .WithOne()
            .HasForeignKey("PurchaseId")
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(p => p.Lines).AutoInclude();

        builder.HasIndex(p => new { p.BranchId, p.ReceivedAt });
    }
}

class PurchaseLineEntityTypeConfiguration : IEntityTypeConfiguration<PurchaseLine>
{
    public void Configure(EntityTypeBuilder<PurchaseLine> builder)
    {
        builder.ToTable("purchase_lines");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id)
            .UseHiLo("purchaselineseq", "inventory");

        builder.Ignore(l => l.DomainEvents);
        builder.Ignore(l => l.Total);

        builder.Property(l => l.Quantity).HasPrecision(18, 3);
        builder.Property(l => l.UnitCost).HasPrecision(18, 4);

        builder.HasOne<StockItem>()
            .WithMany()
            .HasForeignKey(l => l.StockItemId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
