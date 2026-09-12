namespace Chillax.Inventory.Infrastructure.EntityConfigurations;

class StockCountEntityTypeConfiguration : IEntityTypeConfiguration<StockCount>
{
    public void Configure(EntityTypeBuilder<StockCount> builder)
    {
        builder.ToTable("stock_counts");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .UseHiLo("stockcountseq", "inventory");

        builder.Ignore(c => c.DomainEvents);
        builder.Ignore(c => c.Differences);

        builder.Property(c => c.Note).HasMaxLength(500);
        builder.Property(c => c.CountedBy).HasMaxLength(64).IsRequired();

        builder.HasMany(c => c.Lines)
            .WithOne()
            .HasForeignKey("StockCountId")
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(c => c.Lines).AutoInclude();

        builder.HasIndex(c => new { c.BranchId, c.CountedAt });
    }
}

class StockCountLineEntityTypeConfiguration : IEntityTypeConfiguration<StockCountLine>
{
    public void Configure(EntityTypeBuilder<StockCountLine> builder)
    {
        builder.ToTable("stock_count_lines");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id)
            .UseHiLo("stockcountlineseq", "inventory");

        builder.Ignore(l => l.DomainEvents);
        builder.Ignore(l => l.Variance);

        builder.Property(l => l.Expected).HasPrecision(18, 3);
        builder.Property(l => l.Counted).HasPrecision(18, 3);

        builder.HasOne<StockItem>()
            .WithMany()
            .HasForeignKey(l => l.StockItemId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
