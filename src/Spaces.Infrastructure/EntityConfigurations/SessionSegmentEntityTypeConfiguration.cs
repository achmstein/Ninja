using Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;

namespace Chillax.Spaces.Infrastructure.EntityConfigurations;

class SessionSegmentEntityTypeConfiguration : IEntityTypeConfiguration<SessionSegment>
{
    public void Configure(EntityTypeBuilder<SessionSegment> builder)
    {
        builder.ToTable("session_segments");

        builder.HasKey(ss => ss.Id);

        builder.Property(ss => ss.Id)
            .UseHiLo("sessionsegmentseq", "spaces");

        builder.Ignore(ss => ss.DomainEvents);

        builder.Property(ss => ss.ReservationId)
            .IsRequired();

        builder.Property(ss => ss.PlayerMode)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(ss => ss.HourlyRate)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(ss => ss.StartTime)
            .IsRequired();

        builder.Property(ss => ss.EndTime);

        // Indexes
        builder.HasIndex(ss => ss.ReservationId);
    }
}
