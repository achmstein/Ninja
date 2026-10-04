using Ninja.Ordering.Infrastructure.Projections;

namespace Ninja.Ordering.Infrastructure.EntityConfigurations;

class BranchSettingsEntityTypeConfiguration : IEntityTypeConfiguration<BranchSettings>
{
    public void Configure(EntityTypeBuilder<BranchSettings> builder)
    {
        builder.ToTable("branchsettings");

        // Keyed by Tenant.API's id — never generated here
        builder.HasKey(b => b.BranchId);
        builder.Property(b => b.BranchId).ValueGeneratedNever();

        // Money and the radius as the order's own fee is kept: two places
        builder.Property(b => b.DeliveryFee).HasPrecision(18, 2);
        builder.Property(b => b.DeliveryMinimumOrder).HasPrecision(18, 2);
        builder.Property(b => b.DeliveryRadiusKm).HasPrecision(9, 2);
    }
}
