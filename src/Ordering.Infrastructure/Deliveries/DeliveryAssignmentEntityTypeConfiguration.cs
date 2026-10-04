namespace Ninja.Ordering.Infrastructure.Deliveries;

class DeliveryAssignmentEntityTypeConfiguration : IEntityTypeConfiguration<DeliveryAssignment>
{
    public void Configure(EntityTypeBuilder<DeliveryAssignment> builder)
    {
        builder.ToTable("deliveryassignments", DeliverySchema.Name);

        builder.HasKey(a => a.Id);
        builder.Property(a => a.RiderUserId).HasMaxLength(100);
        builder.Property(a => a.RiderName).HasMaxLength(200);
        builder.Property(a => a.PreviousRiderUserId).HasMaxLength(100);
        builder.Property(a => a.Action).HasConversion<string>().HasMaxLength(20);
        builder.Property(a => a.ActorUserId).HasMaxLength(100);
        builder.Property(a => a.ActorName).HasMaxLength(200);
        builder.Property(a => a.ActorRole).HasMaxLength(20);
        builder.Property(a => a.CashCollected).HasPrecision(18, 2);
        builder.Property(a => a.Reason).HasMaxLength(DeliveryLimits.FailureReason);

        // A rider's history, and one order's timeline
        builder.HasIndex(a => new { a.RiderUserId, a.At });
        builder.HasIndex(a => new { a.PreviousRiderUserId, a.At });
        builder.HasIndex(a => new { a.OrderId, a.At });
    }
}
