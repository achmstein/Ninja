namespace Chillax.Ordering.Infrastructure.EntityConfigurations;

class OrderEntityTypeConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> orderConfiguration)
    {
        orderConfiguration.ToTable("orders");

        orderConfiguration.Ignore(b => b.DomainEvents);

        orderConfiguration.Property(o => o.Id)
            .UseHiLo("orderseq");

        orderConfiguration
            .Property(o => o.OrderStatus)
            .HasConversion<string>()
            .HasMaxLength(30);

        orderConfiguration
            .Property(o => o.Source)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(OrderSource.Customer);

        orderConfiguration
            .Property(o => o.Preparation)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(PreparationStatus.NotStarted);

        orderConfiguration
            .Property(o => o.Description)
            .HasMaxLength(500);

        orderConfiguration
            .Property(o => o.CustomerNote)
            .HasMaxLength(500);

        orderConfiguration
            .Property(o => o.GuestId)
            .HasMaxLength(64);

        orderConfiguration
            .Property(o => o.GuestName)
            .HasMaxLength(200);

        orderConfiguration
            .Property(o => o.GuestPhone)
            .HasMaxLength(30);

        // Configure RoomName as JSON column (localized text)
        orderConfiguration.OwnsOne(o => o.RoomName, b => b.ToJson());

        // Configure TableName as JSON column (localized text)
        orderConfiguration.OwnsOne(o => o.TableName, b => b.ToJson());

        orderConfiguration.HasOne(o => o.Buyer)
            .WithMany()
            .HasForeignKey(o => o.BuyerId);

        orderConfiguration.Property(o => o.BranchId)
            .IsRequired()
            .HasDefaultValue(1);

        orderConfiguration.Property(o => o.ReminderCount)
            .IsRequired()
            .HasDefaultValue(0);

        orderConfiguration.Property(o => o.LastReminderSentAt);

        orderConfiguration.HasIndex(o => o.BranchId);
        orderConfiguration.HasIndex(o => o.OrderStatus);
        orderConfiguration.HasIndex(o => o.OrderDate);

        // A guest's own order list is looked up by this and nothing else
        orderConfiguration.HasIndex(o => o.GuestId);

        // Sales assembles a session's bill by this
        orderConfiguration.HasIndex(o => o.SessionId);
    }
}
