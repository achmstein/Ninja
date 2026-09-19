namespace Ninja.Ordering.Infrastructure.EntityConfigurations;

class OrderItemEntityTypeConfiguration
    : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> orderItemConfiguration)
    {
        orderItemConfiguration.ToTable("orderItems");

        orderItemConfiguration.Ignore(b => b.DomainEvents);

        orderItemConfiguration.Property(o => o.Id)
            .UseHiLo("orderitemseq");

        orderItemConfiguration.Property<int>("OrderId");

        // Configure ProductName as JSON column
        orderItemConfiguration.OwnsOne(oi => oi.ProductName, b => b.ToJson());

        // Configure CustomizationsDescription as JSON column
        orderItemConfiguration.OwnsOne(oi => oi.CustomizationsDescription, b => b.ToJson());
    }
}
