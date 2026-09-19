namespace Ninja.Spaces.Infrastructure.EntityConfigurations;

class PlaceEntityTypeConfiguration : IEntityTypeConfiguration<Place>
{
    public void Configure(EntityTypeBuilder<Place> builder)
    {
        builder.ToTable("places");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .UseHiLo("placeseq", "spaces");

        builder.Ignore(p => p.DomainEvents);
        builder.Ignore(p => p.IsTimed);
        builder.Ignore(p => p.HasOptions);
        builder.Ignore(p => p.CanReserve);
        builder.Ignore(p => p.TakesControllerRequests);

        builder.Property(p => p.Kind)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.OwnsOne(p => p.Name, b => b.ToJson());
        builder.OwnsOne(p => p.Description, b => b.ToJson());

        // The tariff is one JSON document: its options and the rounding
        builder.OwnsOne(p => p.Tariff, t =>
        {
            t.ToJson();
            t.OwnsMany(x => x.Options, o => o.OwnsOne(x => x.Name));
        });

        builder.Property(p => p.PhysicalStatus)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(p => p.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(p => p.BranchId)
            .IsRequired()
            .HasDefaultValue(1);

        builder.HasIndex(p => p.BranchId);
        builder.HasIndex(p => p.Kind);
        builder.HasIndex(p => p.PhysicalStatus);
    }
}
