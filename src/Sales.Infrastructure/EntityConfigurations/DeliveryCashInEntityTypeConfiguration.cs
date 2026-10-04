using Ninja.Sales.Infrastructure.Projections;

namespace Ninja.Sales.Infrastructure.EntityConfigurations;

class DeliveryCashInEntityTypeConfiguration : IEntityTypeConfiguration<DeliveryCashIn>
{
    public void Configure(EntityTypeBuilder<DeliveryCashIn> builder)
    {
        builder.ToTable("deliverycashins");

        // One per order, keyed by Ordering's id: a redelivered cash-in finds the row it made
        builder.HasKey(c => c.OrderId);
        builder.Property(c => c.OrderId).ValueGeneratedNever();
        builder.Property(c => c.Collected).HasPrecision(18, 2);
        builder.Property(c => c.BillTotal).HasPrecision(18, 2);
        builder.Property(c => c.RiderName).HasMaxLength(200);
        builder.Property(c => c.Outcome).HasConversion<string>().HasMaxLength(20);
        builder.Ignore(c => c.Difference);

        // The till's day: what came in, short or over, branch by branch
        builder.HasIndex(c => new { c.BranchId, c.ReceivedAt });
    }
}
