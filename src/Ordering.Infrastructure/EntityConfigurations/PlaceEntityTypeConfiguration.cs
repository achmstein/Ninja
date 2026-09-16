using Chillax.Ordering.Infrastructure.Projections;

namespace Chillax.Ordering.Infrastructure.EntityConfigurations;

class PlaceEntityTypeConfiguration : IEntityTypeConfiguration<Place>
{
    public void Configure(EntityTypeBuilder<Place> builder)
    {
        builder.ToTable("places");

        // Keyed by Spaces' id — never generated here
        builder.HasKey(p => p.PlaceId);
        builder.Property(p => p.PlaceId).ValueGeneratedNever();

        builder.Property(p => p.Kind).HasMaxLength(20).IsRequired();
        builder.OwnsOne(p => p.Name, b => b.ToJson());

        builder.HasIndex(p => p.LegacyRoomId);
        builder.HasIndex(p => p.LegacyTableId);
    }
}
