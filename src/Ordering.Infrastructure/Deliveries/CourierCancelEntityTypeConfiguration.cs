#nullable enable

namespace Ninja.Ordering.Infrastructure.Deliveries;

class CourierCancelEntityTypeConfiguration : IEntityTypeConfiguration<CourierCancel>
{
    public void Configure(EntityTypeBuilder<CourierCancel> builder)
    {
        builder.ToTable("couriercancels", DeliverySchema.Name);

        builder.HasKey(c => c.Id);
        builder.Property(c => c.JobId).HasMaxLength(DeliveryLimits.CourierJobId).IsRequired();
        builder.Property(c => c.Reason).HasMaxLength(30).IsRequired();
        builder.Property(c => c.LastError).HasMaxLength(500);
        // The sender's question: what is due and not yet done
        builder.HasIndex(c => c.NextAttemptAt).HasFilter("\"SentAt\" IS NULL AND \"AbandonedAt\" IS NULL");
    }
}
