using Ninja.Ordering.Infrastructure.Projections;

namespace Ninja.Ordering.Infrastructure.EntityConfigurations;

class TenantSettingsEntityTypeConfiguration : IEntityTypeConfiguration<TenantSettings>
{
    public void Configure(EntityTypeBuilder<TenantSettings> builder)
    {
        builder.ToTable("tenantsettings");

        // The one row, always the same id
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();
    }
}
