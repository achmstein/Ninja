namespace Ninja.Sales.Infrastructure.EntityConfigurations;

class TicketEntityTypeConfiguration : IEntityTypeConfiguration<Ticket>
{
    public void Configure(EntityTypeBuilder<Ticket> builder)
    {
        builder.ToTable("tickets");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .UseHiLo("ticketseq", "sales");

        builder.Ignore(t => t.DomainEvents);

        // Postgres's own row version as the concurrency token: two tills
        // settling one ticket, or a settle racing a discard, make the second
        // writer fail instead of silently winning
        builder.Property<uint>("xmin").IsRowVersion();

        builder.Property(t => t.Type)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(t => t.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(t => t.BranchId).IsRequired();

        builder.OwnsOne(t => t.LocationName, b => b.ToJson());

        builder.Property(t => t.PlaceKind).HasMaxLength(20);
        builder.Ignore(t => t.HasSession);

        builder.Property(t => t.Label).HasMaxLength(200);
        // The customers who sat in the room, as a text array
        builder.Property(t => t.MemberIds);
        builder.Property(t => t.GuestPhone).HasMaxLength(30);
        builder.Property(t => t.SettledBy).HasMaxLength(64);
        builder.Property(t => t.ProvisionalReceiptNumber).HasMaxLength(32);
        builder.Property(t => t.VoidedBy).HasMaxLength(64);
        builder.Property(t => t.VoidReason).HasMaxLength(300);
        builder.Property(t => t.ChangeGiven).HasPrecision(18, 2);

        builder.Ignore(t => t.HasDiscount);

        builder.Property(t => t.Discount).HasPrecision(18, 2);
        builder.Property(t => t.DiscountRate).HasPrecision(5, 4);
        builder.Property(t => t.DiscountReason).HasMaxLength(300);
        builder.Property(t => t.DiscountBy).HasMaxLength(64);

        // The bill as settled — frozen figures and the rates behind them
        builder.Property(t => t.Subtotal).HasPrecision(18, 2);
        builder.Property(t => t.ServiceCharge).HasPrecision(18, 2);
        builder.Property(t => t.Vat).HasPrecision(18, 2);
        builder.Property(t => t.Total).HasPrecision(18, 2);
        builder.Property(t => t.VatRate).HasPrecision(5, 4);
        builder.Property(t => t.ServiceChargeRate).HasPrecision(5, 4);

        builder.HasMany(t => t.Lines)
            .WithOne()
            .HasForeignKey("TicketId")
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(t => t.Payments)
            .WithOne()
            .HasForeignKey("TicketId")
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(t => t.Lines).AutoInclude();
        builder.Navigation(t => t.Payments).AutoInclude();

        // The floor view lists a branch's open tickets; consumers look tickets
        // up by session or place to append to them
        builder.HasIndex(t => new { t.BranchId, t.Status });
        builder.HasIndex(t => t.SessionId);
        builder.HasIndex(t => new { t.PlaceId, t.Status });
    }
}
