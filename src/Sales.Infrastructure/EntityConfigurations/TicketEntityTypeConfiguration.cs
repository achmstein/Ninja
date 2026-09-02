namespace Chillax.Sales.Infrastructure.EntityConfigurations;

class TicketEntityTypeConfiguration : IEntityTypeConfiguration<Ticket>
{
    public void Configure(EntityTypeBuilder<Ticket> builder)
    {
        builder.ToTable("tickets");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .UseHiLo("ticketseq", "sales");

        builder.Ignore(t => t.DomainEvents);

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

        builder.Property(t => t.CustomerId).HasMaxLength(64);
        builder.Property(t => t.CustomerName).HasMaxLength(200);
        builder.Property(t => t.GuestPhone).HasMaxLength(30);
        builder.Property(t => t.SettledBy).HasMaxLength(64);
        builder.Property(t => t.VoidedBy).HasMaxLength(64);
        builder.Property(t => t.VoidReason).HasMaxLength(300);
        builder.Property(t => t.ChangeGiven).HasPrecision(18, 2);

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
        // up by session or table to append to them
        builder.HasIndex(t => new { t.BranchId, t.Status });
        builder.HasIndex(t => t.SessionId);
        builder.HasIndex(t => new { t.TableId, t.Status });
    }
}
