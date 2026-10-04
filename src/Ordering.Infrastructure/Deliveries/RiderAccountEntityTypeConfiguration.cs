#nullable enable

namespace Ninja.Ordering.Infrastructure.Deliveries;

class RiderAccountEntityTypeConfiguration : IEntityTypeConfiguration<RiderAccount>
{
    public void Configure(EntityTypeBuilder<RiderAccount> builder)
    {
        builder.ToTable("rideraccounts", DeliverySchema.Name);

        builder.HasKey(r => r.UserId);
        builder.Property(r => r.UserId).HasMaxLength(DeliveryLimits.RiderUserId);
        builder.Property(r => r.Name).HasMaxLength(DeliveryLimits.RiderName);
    }
}
