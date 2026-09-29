using Ninja.Ordering.Infrastructure.Projections;

namespace Ninja.Ordering.Infrastructure.EntityConfigurations;

class PlatformUpdateEntityTypeConfiguration : IEntityTypeConfiguration<PlatformUpdate>
{
    public void Configure(EntityTypeBuilder<PlatformUpdate> builder)
    {
        builder.ToTable("platformupdates");

        builder.HasKey(u => u.Id);
        builder.Property(u => u.Id).UseHiLo("platformupdateseq");

        builder.Property(u => u.Platform).IsRequired().HasMaxLength(20);
        builder.Property(u => u.Token).IsRequired().HasMaxLength(100);
        builder.Property(u => u.Kind).HasConversion<string>().HasMaxLength(20);
        builder.Property(u => u.Url).IsRequired().HasMaxLength(500);
        builder.Property(u => u.Reason).HasMaxLength(40);
        builder.Property(u => u.LastError).HasMaxLength(1000);

        // The sender asks for what is due and not yet settled either way
        builder.HasIndex(u => new { u.SentAt, u.AbandonedAt, u.NextAttemptAt });
        builder.HasIndex(u => u.OrderId);
    }
}
