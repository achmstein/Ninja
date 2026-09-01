namespace Chillax.Spaces.Infrastructure.EntityConfigurations;

class SessionMemberEntityTypeConfiguration : IEntityTypeConfiguration<SessionMember>
{
    public void Configure(EntityTypeBuilder<SessionMember> builder)
    {
        builder.ToTable("session_members");

        builder.HasKey(sm => sm.Id);

        builder.Property(sm => sm.Id)
            .UseHiLo("sessionmemberseq", "spaces");

        builder.Ignore(sm => sm.DomainEvents);

        builder.Property(sm => sm.ReservationId)
            .IsRequired();

        builder.Property(sm => sm.CustomerId)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(sm => sm.CustomerName)
            .HasMaxLength(200);

        builder.Property(sm => sm.JoinedAt)
            .IsRequired();

        builder.Property(sm => sm.Role)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        // Indexes
        builder.HasIndex(sm => sm.ReservationId);
        builder.HasIndex(sm => sm.CustomerId);
        builder.HasIndex(sm => new { sm.ReservationId, sm.CustomerId }).IsUnique();
    }
}
