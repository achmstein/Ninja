namespace Chillax.Inventory.Infrastructure.EntityConfigurations;

class StockLevelEntityTypeConfiguration : IEntityTypeConfiguration<StockLevel>
{
    public void Configure(EntityTypeBuilder<StockLevel> builder)
    {
        builder.ToTable("stock_levels");

        // One row per branch and item, created on first use by the ledger
        // (INSERT ... ON CONFLICT DO NOTHING) and moved under a row lock; no
        // sequence, no concurrency token, never written through the tracker
        builder.HasKey(l => new { l.BranchId, l.StockItemId });

        builder.Property(l => l.OnHand).HasPrecision(18, 3);
        builder.Property(l => l.ReorderLevel).HasPrecision(18, 3);
        builder.Property(l => l.AvgUnitCost).HasPrecision(18, 4);

        builder.HasOne<StockItem>()
            .WithMany()
            .HasForeignKey(l => l.StockItemId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

class StockMovementEntityTypeConfiguration : IEntityTypeConfiguration<StockMovement>
{
    public void Configure(EntityTypeBuilder<StockMovement> builder)
    {
        builder.ToTable("stock_movements");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.Id)
            .UseHiLo("stockmovementseq", "inventory");

        builder.Ignore(m => m.DomainEvents);

        builder.Property(m => m.Type)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(m => m.Quantity).HasPrecision(18, 3);
        builder.Property(m => m.UnitCost).HasPrecision(18, 4);
        builder.Property(m => m.Reference).HasMaxLength(64);
        builder.Property(m => m.Reason).HasMaxLength(500);
        builder.Property(m => m.RecordedBy).HasMaxLength(64).IsRequired();

        builder.HasOne<StockItem>()
            .WithMany()
            .HasForeignKey(m => m.StockItemId)
            .OnDelete(DeleteBehavior.Restrict);

        // A document lands once per stock item: the redelivered order, the
        // retried receipt, the double-posted count all stop here
        builder.HasIndex(m => new { m.Reference, m.StockItemId })
            .IsUnique()
            .HasFilter("\"Reference\" IS NOT NULL");

        builder.HasIndex(m => new { m.BranchId, m.StockItemId, m.RecordedAt });
        builder.HasIndex(m => new { m.BranchId, m.RecordedAt });
    }
}

class MenuItemStockStatusEntityTypeConfiguration : IEntityTypeConfiguration<MenuItemStockStatus>
{
    public void Configure(EntityTypeBuilder<MenuItemStockStatus> builder)
    {
        builder.ToTable("menu_item_stock_statuses");

        builder.HasKey(s => new { s.BranchId, s.CatalogItemId });
    }
}

class MenuOptionStockStatusEntityTypeConfiguration : IEntityTypeConfiguration<MenuOptionStockStatus>
{
    public void Configure(EntityTypeBuilder<MenuOptionStockStatus> builder)
    {
        builder.ToTable("menu_option_stock_statuses");

        builder.HasKey(s => new { s.BranchId, s.OptionId });
    }
}
