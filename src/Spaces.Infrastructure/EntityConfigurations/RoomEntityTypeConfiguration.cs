namespace Chillax.Spaces.Infrastructure.EntityConfigurations;

class RoomEntityTypeConfiguration : IEntityTypeConfiguration<Room>
{
    public void Configure(EntityTypeBuilder<Room> builder)
    {
        builder.ToTable("rooms");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id)
            .UseHiLo("roomseq", "spaces");

        builder.Ignore(r => r.DomainEvents);

        // Configure Name as JSON column
        builder.OwnsOne(r => r.Name, b => b.ToJson());

        // Configure Description as JSON column
        builder.OwnsOne(r => r.Description, b => b.ToJson());

        builder.Property(r => r.SingleRate)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(r => r.MultiRate)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(r => r.PhysicalStatus)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(r => r.BranchId)
            .IsRequired()
            .HasDefaultValue(1);

        // Indexes
        builder.HasIndex(r => r.BranchId);
        builder.HasIndex(r => r.PhysicalStatus);
    }
}
