using Ninja.Spaces.Infrastructure.Projections;

namespace Ninja.Spaces.Infrastructure.EntityConfigurations;

class BranchSettingsEntityTypeConfiguration : IEntityTypeConfiguration<BranchSettings>
{
    public void Configure(EntityTypeBuilder<BranchSettings> builder)
    {
        builder.ToTable("branchsettings");

        // Keyed by Tenant.API's id — never generated here
        builder.HasKey(b => b.BranchId);
        builder.Property(b => b.BranchId).ValueGeneratedNever();
    }
}
