using Chillax.Sales.Domain.AggregatesModel.ShiftAggregate;

namespace Chillax.Sales.Infrastructure.EntityConfigurations;

class CashMovementEntityTypeConfiguration : IEntityTypeConfiguration<CashMovement>
{
    public void Configure(EntityTypeBuilder<CashMovement> builder)
    {
        builder.ToTable("cash_movements");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.Id)
            .UseHiLo("cashmovementseq", "sales");

        builder.Ignore(m => m.DomainEvents);

        builder.Property(m => m.Type)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(m => m.Amount).HasPrecision(18, 2);

        builder.Property(m => m.Reason)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(m => m.RecordedBy)
            .HasMaxLength(64)
            .IsRequired();
    }
}
