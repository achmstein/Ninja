using Ninja.Ordering.Infrastructure.Projections;

namespace Ninja.Ordering.Infrastructure.EntityConfigurations;

class CustomerAddressEntityTypeConfiguration : IEntityTypeConfiguration<CustomerAddress>
{
    public void Configure(EntityTypeBuilder<CustomerAddress> builder)
    {
        builder.ToTable("customeraddresses");

        builder.HasKey(a => a.Id);
        builder.Property(a => a.UserId).HasMaxLength(100).IsRequired();
        builder.Property(a => a.Label).HasMaxLength(50);
        builder.Property(a => a.Address).HasMaxLength(300).IsRequired();
        builder.Property(a => a.Building).HasMaxLength(100);
        builder.Property(a => a.Floor).HasMaxLength(50);
        builder.Property(a => a.Apartment).HasMaxLength(50);
        builder.Property(a => a.Directions).HasMaxLength(500);
        builder.Property(a => a.Phone).HasMaxLength(30);

        builder.HasIndex(a => a.UserId);
    }
}
