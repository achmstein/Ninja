namespace Ninja.Inventory.Infrastructure.EntityConfigurations;

class TransferEntityTypeConfiguration : IEntityTypeConfiguration<Transfer>
{
    public void Configure(EntityTypeBuilder<Transfer> builder)
    {
        builder.ToTable("transfers");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .UseHiLo("transferseq", "inventory");

        builder.Ignore(t => t.DomainEvents);

        builder.Property(t => t.Note).HasMaxLength(500);
        builder.Property(t => t.SentBy).HasMaxLength(64).IsRequired();

        builder.HasMany(t => t.Lines)
            .WithOne()
            .HasForeignKey("TransferId")
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(t => t.Lines).AutoInclude();

        builder.HasIndex(t => new { t.FromBranchId, t.SentAt });
        builder.HasIndex(t => new { t.ToBranchId, t.SentAt });
    }
}

class TransferLineEntityTypeConfiguration : IEntityTypeConfiguration<TransferLine>
{
    public void Configure(EntityTypeBuilder<TransferLine> builder)
    {
        builder.ToTable("transfer_lines");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id)
            .UseHiLo("transferlineseq", "inventory");

        builder.Ignore(l => l.DomainEvents);

        builder.Property(l => l.Quantity).HasPrecision(18, 3);

        builder.HasOne<StockItem>()
            .WithMany()
            .HasForeignKey(l => l.StockItemId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
