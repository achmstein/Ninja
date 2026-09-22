using Ninja.Spaces.Infrastructure.Projections;

namespace Ninja.Spaces.Infrastructure.EntityConfigurations;

class TenantFeaturesEntityTypeConfiguration : IEntityTypeConfiguration<TenantFeatures>
{
    public void Configure(EntityTypeBuilder<TenantFeatures> builder)
    {
        builder.ToTable("tenantfeatures");

        // One row, keyed by a constant — never generated here
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();
    }
}
