namespace Chillax.Spaces.Infrastructure.EntityConfigurations;

class StayEntityTypeConfiguration : IEntityTypeConfiguration<Stay>
{
    public void Configure(EntityTypeBuilder<Stay> builder)
    {
        builder.ToTable("stays");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .UseHiLo("stayseq", "spaces");

        builder.Ignore(s => s.DomainEvents);
        builder.Ignore(s => s.CurrentOption);
        builder.Ignore(s => s.IsOpen);

        builder.Property(s => s.CustomerId)
            .HasMaxLength(100);

        builder.Property(s => s.CustomerName)
            .HasMaxLength(200);

        builder.Property(s => s.CreatedAt)
            .IsRequired();

        builder.Property(s => s.ExpiresAt);
        builder.Property(s => s.StartOnConfirm)
            .IsRequired()
            .HasDefaultValue(false);
        builder.Property(s => s.RequestedOptionCode)
            .HasMaxLength(50);
        builder.Property(s => s.StartedAt);
        builder.Property(s => s.EndedAt);

        // The tariff as it was when the stay began: one JSON document
        builder.OwnsOne(s => s.Tariff, t =>
        {
            t.ToJson();
            t.OwnsMany(x => x.Options, o => o.OwnsOne(x => x.Name));
        });
        builder.Navigation(s => s.Tariff).IsRequired();

        builder.Property(s => s.CurrentOptionCode)
            .HasMaxLength(40);

        builder.Property(s => s.TotalCost)
            .HasPrecision(18, 2);

        // Projected from Sales' receipt: what the customer's list shows as paid
        builder.Property(s => s.ReceiptNumber);
        builder.Property(s => s.TicketId);
        builder.Property(s => s.PaidAt);
        builder.Property(s => s.PaidWith)
            .HasMaxLength(20);

        builder.Property(s => s.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(s => s.Notes)
            .HasMaxLength(500);

        builder.HasOne(s => s.Place)
            .WithMany()
            .HasForeignKey(s => s.PlaceId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(s => s.Members)
            .WithOne()
            .HasForeignKey(m => m.StayId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(s => s.Members)
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasMany(s => s.Segments)
            .WithOne()
            .HasForeignKey(g => g.StayId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(s => s.Segments)
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(s => s.CustomerId);
        builder.HasIndex(s => s.Status);
        builder.HasIndex(s => s.CreatedAt);
        builder.HasIndex(s => new { s.PlaceId, s.Status });
        builder.HasIndex(s => new { s.CustomerId, s.Status });
        builder.HasIndex(s => new { s.Status, s.ExpiresAt });
    }
}
