namespace Ninja.Spaces.Infrastructure.EntityConfigurations;

class StaySegmentEntityTypeConfiguration : IEntityTypeConfiguration<StaySegment>
{
    public void Configure(EntityTypeBuilder<StaySegment> builder)
    {
        builder.ToTable("stay_segments");

        builder.HasKey(g => g.Id);

        builder.Property(g => g.Id)
            .UseHiLo("staysegmentseq", "spaces");

        builder.Ignore(g => g.DomainEvents);
        builder.Ignore(g => g.Minutes);

        builder.Property(g => g.StayId)
            .IsRequired();

        builder.Property(g => g.OptionCode)
            .HasMaxLength(40)
            .IsRequired();

        builder.Property(g => g.HourlyRate)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(g => g.StartTime)
            .IsRequired();

        builder.Property(g => g.EndTime);

        builder.HasIndex(g => g.StayId);
    }
}
