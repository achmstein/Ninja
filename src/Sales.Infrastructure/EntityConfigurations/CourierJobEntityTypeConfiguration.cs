using Ninja.Sales.Infrastructure.Projections;

namespace Ninja.Sales.Infrastructure.EntityConfigurations;

class CourierJobEntityTypeConfiguration : IEntityTypeConfiguration<CourierJob>
{
    public void Configure(EntityTypeBuilder<CourierJob> builder)
    {
        builder.ToTable("courierjobs");

        // One per order, keyed by Ordering's id: a redelivered event finds the row it made
        builder.HasKey(j => j.OrderId);
        builder.Property(j => j.OrderId).ValueGeneratedNever();
        builder.Property(j => j.Provider).HasMaxLength(100);
        builder.Property(j => j.Collected).HasPrecision(18, 2);
        builder.Property(j => j.Fee).HasPrecision(18, 2);
        builder.Property(j => j.BillTotal).HasPrecision(18, 2);
        builder.Property(j => j.Outcome).HasConversion<string>().HasMaxLength(20);

        // A company's jobs, newest first
        builder.HasIndex(j => new { j.ProviderId, j.At });
    }
}

class CourierPayoutEntityTypeConfiguration : IEntityTypeConfiguration<CourierPayout>
{
    public void Configure(EntityTypeBuilder<CourierPayout> builder)
    {
        builder.ToTable("courierpayouts");

        builder.HasKey(p => p.Id);
        builder.Property(p => p.Provider).HasMaxLength(100);
        builder.Property(p => p.Amount).HasPrecision(18, 2);
        builder.Property(p => p.Note).HasMaxLength(300);
        builder.Property(p => p.RecordedBy).HasMaxLength(200);

        builder.HasIndex(p => new { p.ProviderId, p.PaidOn });
    }
}
