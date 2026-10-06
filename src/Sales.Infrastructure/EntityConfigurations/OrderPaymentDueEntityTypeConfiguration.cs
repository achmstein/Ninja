using Ninja.Sales.Infrastructure.Projections;

namespace Ninja.Sales.Infrastructure.EntityConfigurations;

class OrderPaymentDueEntityTypeConfiguration : IEntityTypeConfiguration<OrderPaymentDue>
{
    public void Configure(EntityTypeBuilder<OrderPaymentDue> builder)
    {
        builder.ToTable("orderpaymentsdue");

        // One per order, keyed by Ordering's id: a redelivered event finds the row it made
        builder.HasKey(d => d.OrderId);
        builder.Property(d => d.OrderId).ValueGeneratedNever();
        builder.Property(d => d.Amount).HasPrecision(18, 2);
        builder.Property(d => d.PayerUserId).HasMaxLength(64);
        builder.Property(d => d.PayerGuestId).HasMaxLength(64);
        builder.Property(d => d.PayerName).HasMaxLength(200);
        builder.Property(d => d.Phone).HasMaxLength(30);
        builder.Property(d => d.Status).HasConversion<string>().HasMaxLength(12);
    }
}
