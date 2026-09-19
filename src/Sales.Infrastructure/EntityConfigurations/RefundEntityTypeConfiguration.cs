namespace Ninja.Sales.Infrastructure.EntityConfigurations;

class RefundEntityTypeConfiguration : IEntityTypeConfiguration<Refund>
{
    public void Configure(EntityTypeBuilder<Refund> builder)
    {
        builder.ToTable("refunds");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id)
            .UseHiLo("refundseq", "sales");

        builder.Ignore(r => r.DomainEvents);

        builder.Property(r => r.Reason).HasMaxLength(300).IsRequired();

        builder.Property(r => r.Tender)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(r => r.CustomerId).HasMaxLength(64);
        builder.Property(r => r.CustomerName).HasMaxLength(200);
        builder.Property(r => r.RefundedBy).HasMaxLength(64).IsRequired();
        builder.Property(r => r.Amount).HasPrecision(18, 2);

        builder.HasMany(r => r.Lines)
            .WithOne()
            .HasForeignKey("RefundId")
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(r => r.Lines).AutoInclude();

        // Credit notes number per branch like receipts do: the unique index
        // is what settles a numbering race, the loser retries
        builder.HasIndex(r => new { r.BranchId, r.Number }).IsUnique();
        builder.HasIndex(r => r.TicketId);
        builder.HasIndex(r => r.ShiftId);
    }
}

class RefundLineEntityTypeConfiguration : IEntityTypeConfiguration<RefundLine>
{
    public void Configure(EntityTypeBuilder<RefundLine> builder)
    {
        builder.ToTable("refund_lines");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id)
            .UseHiLo("refundlineseq", "sales");

        builder.Ignore(l => l.DomainEvents);

        builder.OwnsOne(l => l.Description, b => b.ToJson());

        builder.Property(l => l.Qty).HasPrecision(18, 2);
        builder.Property(l => l.Amount).HasPrecision(18, 2);
        builder.Property(l => l.MenuAmount).HasPrecision(18, 2);
    }
}
