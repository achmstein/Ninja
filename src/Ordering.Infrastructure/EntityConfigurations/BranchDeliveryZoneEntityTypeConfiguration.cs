using System.Text.Json;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Ninja.Ordering.Infrastructure.Projections;

namespace Ninja.Ordering.Infrastructure.EntityConfigurations;

class BranchDeliveryZoneEntityTypeConfiguration : IEntityTypeConfiguration<BranchDeliveryZone>
{
    public void Configure(EntityTypeBuilder<BranchDeliveryZone> builder)
    {
        builder.ToTable("branchdeliveryzones");

        // Keyed by Tenant.API's id — never generated here
        builder.HasKey(z => z.Id);
        builder.Property(z => z.Id).ValueGeneratedNever();

        builder.Property(z => z.NameEn).HasMaxLength(80);
        builder.Property(z => z.NameAr).HasMaxLength(80);
        builder.Property(z => z.Fee).HasPrecision(18, 2);
        builder.Property(z => z.MinimumOrder).HasPrecision(18, 2);

        // Drawn like the branch's own area: one jsonb document of [lat, lng] pairs, read whole
        builder.Property(z => z.Shape)
            .HasColumnType("jsonb")
            .HasConversion(
                area => JsonSerializer.Serialize(area, (JsonSerializerOptions)null),
                json => JsonSerializer.Deserialize<double[][]>(json, (JsonSerializerOptions)null),
                new ValueComparer<double[][]>(
                    (a, b) => JsonSerializer.Serialize(a, (JsonSerializerOptions)null) == JsonSerializer.Serialize(b, (JsonSerializerOptions)null),
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions)null).GetHashCode(),
                    v => v == null ? null : v.Select(p => p.ToArray()).ToArray()));

        builder.HasIndex(z => new { z.BranchId, z.SortOrder });
    }
}
