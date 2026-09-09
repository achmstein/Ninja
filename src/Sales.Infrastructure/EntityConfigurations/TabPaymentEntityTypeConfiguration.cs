using Chillax.Sales.Domain.AggregatesModel.TabPaymentAggregate;

namespace Chillax.Sales.Infrastructure.EntityConfigurations;

class TabPaymentEntityTypeConfiguration : IEntityTypeConfiguration<TabPayment>
{
    public void Configure(EntityTypeBuilder<TabPayment> builder)
    {
        builder.ToTable("tab_payments");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .UseHiLo("tabpaymentseq", "sales");

        builder.Ignore(p => p.DomainEvents);

        builder.Property(p => p.CustomerId).HasMaxLength(64).IsRequired();
        builder.Property(p => p.CustomerName).HasMaxLength(200);

        builder.Property(p => p.Tender)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(p => p.Amount).HasPrecision(18, 2);
        builder.Property(p => p.RecordedBy).HasMaxLength(64).IsRequired();

        // Slips number per branch like receipts do: the unique index is what
        // settles a numbering race, the loser retries. Insert-only rows, so
        // no concurrency token.
        builder.HasIndex(p => new { p.BranchId, p.Number }).IsUnique();
        builder.HasIndex(p => p.ShiftId);
        builder.HasIndex(p => new { p.BranchId, p.RecordedAt });
        builder.HasIndex(p => p.CustomerId);
    }
}
