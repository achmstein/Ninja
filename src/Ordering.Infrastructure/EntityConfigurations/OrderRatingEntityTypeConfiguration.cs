namespace Ninja.Ordering.Infrastructure.EntityConfigurations;

class OrderRatingEntityTypeConfiguration : IEntityTypeConfiguration<OrderRating>
{
    public void Configure(EntityTypeBuilder<OrderRating> ratingConfiguration)
    {
        ratingConfiguration.ToTable("orderratings");

        ratingConfiguration.Ignore(b => b.DomainEvents);

        ratingConfiguration.Property(r => r.Id)
            .UseHiLo("orderratingseq");

        ratingConfiguration
            .Property(r => r.RatingValue)
            .IsRequired();

        ratingConfiguration
            .Property(r => r.Comment)
            .HasMaxLength(500);

        ratingConfiguration
            .Property(r => r.CreatedAt)
            .IsRequired();

        // One-to-one relationship: each order can have only one rating
        ratingConfiguration
            .HasOne(r => r.Order)
            .WithOne(o => o.Rating)
            .HasForeignKey<OrderRating>(r => r.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        // Unique index on OrderId - ensures one rating per order
        ratingConfiguration.HasIndex(r => r.OrderId)
            .IsUnique();

        // Index on CreatedAt for potential analytics queries
        ratingConfiguration.HasIndex(r => r.CreatedAt);
    }
}
