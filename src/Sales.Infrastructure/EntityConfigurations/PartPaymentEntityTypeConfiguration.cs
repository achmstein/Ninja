using Ninja.Sales.Domain.AggregatesModel.PartPaymentAggregate;

namespace Ninja.Sales.Infrastructure.EntityConfigurations;

class PartPaymentEntityTypeConfiguration : IEntityTypeConfiguration<PartPayment>
{
    public void Configure(EntityTypeBuilder<PartPayment> builder)
    {
        builder.ToTable("part_payments");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .UseHiLo("partpaymentseq", "sales");

        builder.Ignore(p => p.DomainEvents);
        builder.Ignore(p => p.IsActive);

        builder.Property(p => p.Tender)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(p => p.Amount).HasPrecision(18, 2);
        builder.Property(p => p.PayerName).HasMaxLength(PartPayment.PayerNameLength);
        builder.Property(p => p.RecordedBy).HasMaxLength(64).IsRequired();
        builder.Property(p => p.ReturnedBy).HasMaxLength(64);

        // A bill's part payments, and a shift's: the drawer counts what it
        // took and what it gave back
        builder.HasIndex(p => p.TicketId);
        builder.HasIndex(p => p.ShiftId);
        builder.HasIndex(p => p.ReturnedShiftId);

        // Two tills giving the same one back: the second is told to reload
        builder.Property<uint>("xmin").IsRowVersion();
    }
}
