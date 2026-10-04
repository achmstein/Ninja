#nullable enable
using Ninja.Ordering.Infrastructure.Projections;

namespace Ninja.Ordering.Infrastructure.EntityConfigurations;

class RiderAccountEntityTypeConfiguration : IEntityTypeConfiguration<RiderAccount>
{
    public void Configure(EntityTypeBuilder<RiderAccount> builder)
    {
        builder.ToTable("rideraccounts");

        builder.HasKey(r => r.UserId);
        builder.Property(r => r.UserId).HasMaxLength(DeliveryLimits.RiderUserId);
        builder.Property(r => r.Name).HasMaxLength(DeliveryLimits.RiderName);
    }
}
