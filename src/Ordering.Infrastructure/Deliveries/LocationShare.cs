#nullable enable
namespace Ninja.Ordering.Infrastructure.Deliveries;

/// <summary>
/// A link the till sent a caller to share their phone's location: made while the call is on, opened on
/// the caller's phone, and answered with where they are. The till's form reads it as it comes; an order
/// placed with the link takes the pin when it comes later. A link works for a day.
/// </summary>
public class LocationShare
{
    public int Id { get; set; }

    /// <summary>What the link carries: 32 random hex characters, the only way to it.</summary>
    public string Token { get; set; } = string.Empty;

    /// <summary>The till's branch, whose own reads are the only ones answered.</summary>
    public int BranchId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime ExpiresAt { get; set; }

    /// <summary>Where the caller's phone said it was; null until they share.</summary>
    public double? Latitude { get; set; }

    public double? Longitude { get; set; }

    /// <summary>How close the phone said it was, in metres, when it said.</summary>
    public double? AccuracyMeters { get; set; }

    public DateTime? SharedAt { get; set; }
}

class LocationShareEntityTypeConfiguration : IEntityTypeConfiguration<LocationShare>
{
    public void Configure(EntityTypeBuilder<LocationShare> builder)
    {
        builder.ToTable("locationshares", DeliverySchema.Name);

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Token).HasMaxLength(DeliveryLimits.LocationShareToken).IsRequired();
        builder.HasIndex(s => s.Token).IsUnique();
    }
}
