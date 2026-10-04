using Ninja.Ordering.Infrastructure.Projections;

namespace Ninja.Ordering.Infrastructure.EntityConfigurations;

class RiderStatusEntityTypeConfiguration : IEntityTypeConfiguration<RiderStatus>
{
    public void Configure(EntityTypeBuilder<RiderStatus> builder)
    {
        builder.ToTable("riderstatuses");

        builder.HasKey(r => r.UserId);
        builder.Property(r => r.UserId).HasMaxLength(100);
        builder.Property(r => r.Name).HasMaxLength(200);

        builder.HasIndex(r => r.BranchId);
    }
}
