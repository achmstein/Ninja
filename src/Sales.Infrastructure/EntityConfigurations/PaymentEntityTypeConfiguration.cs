namespace Ninja.Sales.Infrastructure.EntityConfigurations;

class PaymentEntityTypeConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("payments");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .UseHiLo("paymentseq", "sales");

        builder.Ignore(p => p.DomainEvents);

        builder.Property(p => p.Tender)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(p => p.Amount).HasPrecision(18, 2);

        // Whose tab an account payment charges
        builder.Property(p => p.CustomerId).HasMaxLength(64);
        builder.Property(p => p.CustomerName).HasMaxLength(128);

        builder.Property(p => p.RecordedBy)
            .HasMaxLength(64)
            .IsRequired();
    }
}
