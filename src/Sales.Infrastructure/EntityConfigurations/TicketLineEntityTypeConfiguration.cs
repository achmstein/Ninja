namespace Chillax.Sales.Infrastructure.EntityConfigurations;

class TicketLineEntityTypeConfiguration : IEntityTypeConfiguration<TicketLine>
{
    public void Configure(EntityTypeBuilder<TicketLine> builder)
    {
        builder.ToTable("ticket_lines");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id)
            .UseHiLo("ticketlineseq", "sales");

        builder.Ignore(l => l.DomainEvents);

        builder.Property(l => l.Source)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.OwnsOne(l => l.Description, b => b.ToJson());
        builder.OwnsOne(l => l.Details, b => b.ToJson());

        builder.Property(l => l.Qty).HasPrecision(18, 2);
        builder.Property(l => l.UnitPrice).HasPrecision(18, 2);
        builder.Property(l => l.Discount).HasPrecision(18, 2);

        builder.Property(l => l.AddedBy).HasMaxLength(64);

        // AppendOrder's idempotency check walks a ticket's lines by order id
        builder.HasIndex(l => l.OrderId);
    }
}
