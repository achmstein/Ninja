namespace Ninja.Ordering.Infrastructure.EntityConfigurations;

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
            .Property(o => o.Description)
            .HasMaxLength(500);

        orderConfiguration
            .Property(o => o.CustomerNote)
            .HasMaxLength(500);

        orderConfiguration
            .Property(o => o.PromoCode)
            .HasMaxLength(20);

        orderConfiguration
            .Property(o => o.PromoDiscount)
            .HasPrecision(18, 2);

        orderConfiguration
            .Property(o => o.GuestId)
            .HasMaxLength(64);

        orderConfiguration
            .Property(o => o.GuestName)
            .HasMaxLength(200);

        orderConfiguration
            .Property(o => o.GuestPhone)
            .HasMaxLength(30);

        // The Spaces place the order goes to
        orderConfiguration.Property(o => o.PlaceKind).HasMaxLength(20);
        orderConfiguration.OwnsOne(o => o.PlaceName, b => b.ToJson());
        orderConfiguration.Ignore(o => o.Destination);

        // A delivery platform's order: its details beside the order's own
        // columns, the token indexed because every status update names it
        orderConfiguration.OwnsOne(o => o.Platform, p =>
        {
            p.Property(x => x.Name).HasMaxLength(20).IsRequired();
            p.Property(x => x.Token).HasMaxLength(100).IsRequired();
            p.Property(x => x.Code).HasMaxLength(100).IsRequired();
            p.Property(x => x.ShortCode).HasMaxLength(20);
            p.Property(x => x.Expedition).HasConversion<string>().HasMaxLength(20);
            p.Property(x => x.DeliveryAddress).HasMaxLength(500);
            p.Property(x => x.CollectFromCustomer).HasPrecision(18, 2);
            p.Property(x => x.AcceptedUrl).HasMaxLength(500);
            p.Property(x => x.RejectedUrl).HasMaxLength(500);
            p.Property(x => x.PreparedUrl).HasMaxLength(500);
            p.Property(x => x.PickedUpUrl).HasMaxLength(500);
            p.Property(x => x.RejectReason).HasMaxLength(40);
            p.HasIndex(x => x.Token).IsUnique();
        });

        // The business's own delivery: the address as the customer gave it,
        // the fee, and the rider's progress; riders find theirs by the index
        orderConfiguration.OwnsOne(o => o.Delivery, d =>
        {
            d.Property(x => x.Address).HasMaxLength(300).IsRequired();
            d.Property(x => x.Building).HasMaxLength(100);
            d.Property(x => x.Floor).HasMaxLength(50);
            d.Property(x => x.Apartment).HasMaxLength(50);
            d.Property(x => x.Directions).HasMaxLength(500);
            d.Property(x => x.Phone).HasMaxLength(30).IsRequired();
            d.Property(x => x.Fee).HasPrecision(18, 2);
            d.Property(x => x.RiderUserId).HasMaxLength(100);
            d.Property(x => x.RiderName).HasMaxLength(200);
            d.Ignore(x => x.Stage);
            d.HasIndex(x => x.RiderUserId);
        });
        orderConfiguration.Ignore(o => o.IsDelivery);

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

        // Projected from Sales' receipt: what the customer's list shows as paid
        orderConfiguration.Property(o => o.PaidAt);
        orderConfiguration.Property(o => o.VoidedAt);
        orderConfiguration.Property(o => o.ReceiptNumber);
        orderConfiguration.Property(o => o.PaidWith)
            .HasMaxLength(20);
        orderConfiguration.Property(o => o.RefundedAmount)
            .HasPrecision(18, 2)
            .HasDefaultValue(0m);

        orderConfiguration.HasIndex(o => o.BranchId);
        orderConfiguration.HasIndex(o => o.OrderStatus);
        orderConfiguration.HasIndex(o => o.OrderDate);

        // A guest's own order list is looked up by this and nothing else
        orderConfiguration.HasIndex(o => o.GuestId);

        // Sales assembles a session's bill by this
        orderConfiguration.HasIndex(o => o.SessionId);

        // Open orders are counted per place
        orderConfiguration.HasIndex(o => o.PlaceId);
    }
}
