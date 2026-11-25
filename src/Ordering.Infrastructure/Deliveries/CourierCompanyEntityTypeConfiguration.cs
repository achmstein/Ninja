#nullable enable

namespace Ninja.Ordering.Infrastructure.Deliveries;

class CourierCompanyEntityTypeConfiguration : IEntityTypeConfiguration<CourierCompany>
{
    public void Configure(EntityTypeBuilder<CourierCompany> builder)
    {
        builder.ToTable("couriercompanies", DeliverySchema.Name);

        builder.HasKey(c => c.Id);
        builder.Property(c => c.Name).HasMaxLength(DeliveryLimits.CourierProvider).IsRequired();
        builder.Property(c => c.Phone).HasMaxLength(DeliveryLimits.Phone);
        builder.Property(c => c.DefaultFee).HasPrecision(18, 2);
    }
}
