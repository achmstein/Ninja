#nullable enable

namespace Ninja.Ordering.Infrastructure.Deliveries;

class CourierStatusCallEntityTypeConfiguration : IEntityTypeConfiguration<CourierStatusCall>
{
    public void Configure(EntityTypeBuilder<CourierStatusCall> builder)
    {
        builder.ToTable("courierstatuscalls", DeliverySchema.Name);

        builder.HasKey(c => c.Id);
        builder.Property(c => c.JobId).HasMaxLength(DeliveryLimits.CourierJobId);
        builder.Property(c => c.Status).HasMaxLength(30);
        builder.Property(c => c.Detail).HasMaxLength(300);
        // The company's page reads its newest
        builder.HasIndex(c => new { c.CompanyId, c.ReceivedAt });
    }
}
