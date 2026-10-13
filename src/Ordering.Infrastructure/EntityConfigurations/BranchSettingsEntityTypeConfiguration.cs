using System.Text.Json;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Ninja.Ordering.Infrastructure.Projections;

namespace Ninja.Ordering.Infrastructure.EntityConfigurations;

class BranchSettingsEntityTypeConfiguration : IEntityTypeConfiguration<BranchSettings>
{
    public void Configure(EntityTypeBuilder<BranchSettings> builder)
    {
        builder.ToTable("branchsettings");

        // Keyed by Tenant.API's id — never generated here
        builder.HasKey(b => b.BranchId);
        builder.Property(b => b.BranchId).ValueGeneratedNever();

        // Money and the radius as the order's own fee is kept: two places
        builder.Property(b => b.DeliveryFee).HasPrecision(18, 2);
        builder.Property(b => b.DeliveryMinimumOrder).HasPrecision(18, 2);
        builder.Property(b => b.DeliveryRadiusKm).HasPrecision(9, 2);

        // The drawn area: one jsonb document of [lat, lng] pairs, read whole
        builder.Property(b => b.DeliveryArea)
            .HasColumnType("jsonb")
            .HasConversion(
                area => JsonSerializer.Serialize(area, (JsonSerializerOptions)null),
                json => JsonSerializer.Deserialize<double[][]>(json, (JsonSerializerOptions)null),
                new ValueComparer<double[][]>(
                    (a, b) => JsonSerializer.Serialize(a, (JsonSerializerOptions)null) == JsonSerializer.Serialize(b, (JsonSerializerOptions)null),
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions)null).GetHashCode(),
                    v => v == null ? null : v.Select(p => p.ToArray()).ToArray()));
    }
}
