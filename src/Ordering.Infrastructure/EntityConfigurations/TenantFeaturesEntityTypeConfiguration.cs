using Ninja.Ordering.Infrastructure.Projections;

namespace Ninja.Ordering.Infrastructure.EntityConfigurations;

class TenantFeaturesEntityTypeConfiguration : IEntityTypeConfiguration<TenantFeatures>
{
    public void Configure(EntityTypeBuilder<TenantFeatures> builder)
    {
        builder.ToTable("tenantfeatures");

        builder.HasKey(f => f.Id);
        builder.Property(f => f.Id).ValueGeneratedNever();
    }
}
