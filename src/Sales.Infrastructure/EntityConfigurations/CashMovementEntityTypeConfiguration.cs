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

        builder.Ignore(m => m.IsStaffPayOut);

        builder.Property(m => m.Kind)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(CashMovementKind.Other)
            .IsRequired();

        builder.Property(m => m.EmployeeName).HasMaxLength(200);
        builder.Property(m => m.SupplierName).HasMaxLength(200);
        builder.Property(m => m.PartnerName).HasMaxLength(200);
        builder.Ignore(m => m.IsFinanceMovement);
    }
}
