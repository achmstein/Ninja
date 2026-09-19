using Ninja.Ordering.Infrastructure.Projections;

namespace Ninja.Ordering.Infrastructure.EntityConfigurations;

class BranchSettingsEntityTypeConfiguration : IEntityTypeConfiguration<BranchSettings>
{
    public void Configure(EntityTypeBuilder<BranchSettings> builder)
    {
        builder.ToTable("branchsettings");

        // Keyed by Branch.API's id — never generated here
        builder.HasKey(b => b.BranchId);
        builder.Property(b => b.BranchId).ValueGeneratedNever();
    }
}
