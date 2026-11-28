namespace Ninja.Ordering.Infrastructure.Deliveries;

class RiderSpotEntityTypeConfiguration : IEntityTypeConfiguration<RiderSpot>
{
    public void Configure(EntityTypeBuilder<RiderSpot> builder)
    {
        builder.ToTable("riderspots", DeliverySchema.Name);

        builder.HasKey(r => r.RiderUserId);
        builder.Property(r => r.RiderUserId).HasMaxLength(DeliveryLimits.RiderUserId);
        // A rider has a handful out at once: a few dozen characters, with room
        builder.Property(r => r.Told).HasMaxLength(2000);
    }
}
