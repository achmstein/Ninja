namespace Ninja.Spaces.Infrastructure.EntityConfigurations;

class ReservationEntityTypeConfiguration : IEntityTypeConfiguration<Reservation>
{
    public void Configure(EntityTypeBuilder<Reservation> builder)
    {
        builder.ToTable("reservations");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id)
            .UseHiLo("reservationseq", "spaces");

        builder.Ignore(r => r.DomainEvents);
        builder.Ignore(r => r.IsOpen);
        builder.Ignore(r => r.EffectiveFor);

        builder.Property(r => r.BranchId)
            .IsRequired();

        builder.Property(r => r.CustomerId)
            .HasMaxLength(100);

        builder.Property(r => r.CustomerName)
            .HasMaxLength(200);

        builder.Property(r => r.PartySize);
        builder.Property(r => r.For);

        builder.Property(r => r.CreatedAt)
            .IsRequired();

        builder.Property(r => r.ExpiresAt);

        builder.Property(r => r.StartOnConfirm)
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(r => r.RequestedOptionCode)
            .HasMaxLength(50);

        builder.Property(r => r.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(r => r.Notes)
            .HasMaxLength(500);

        // The stay it handed over to: a plain column, not a navigation —
        // the two aggregates are loaded and saved on their own
        builder.Property(r => r.StayId);
        builder.Property(r => r.SeatedAt);
        builder.Property(r => r.ClosedAt);

        builder.HasOne(r => r.Place)
            .WithMany()
            .HasForeignKey(r => r.PlaceId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(r => r.CustomerId);
        builder.HasIndex(r => new { r.PlaceId, r.Status });
        builder.HasIndex(r => new { r.CustomerId, r.Status });
        builder.HasIndex(r => new { r.BranchId, r.Status });
        builder.HasIndex(r => new { r.Status, r.ExpiresAt });
    }
}
