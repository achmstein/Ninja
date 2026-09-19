using Ninja.Ordering.Infrastructure.Projections;

namespace Ninja.Ordering.Infrastructure.EntityConfigurations;

class GuestBlockEntityTypeConfiguration : IEntityTypeConfiguration<GuestBlock>
{
    public void Configure(EntityTypeBuilder<GuestBlock> builder)
    {
        builder.ToTable("guestblocks");

        builder.HasKey(b => b.Id);
        builder.Property(b => b.Id).UseHiLo("guestblockseq");

        builder.Property(b => b.GuestId).IsRequired().HasMaxLength(64);
        builder.Property(b => b.BlockedBy).HasMaxLength(200);

        // CreateOrder asks "is this guest blocked at this branch right now"
        builder.HasIndex(b => new { b.GuestId, b.BranchId, b.BlockedUntil });
    }
}
