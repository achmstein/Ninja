namespace Chillax.Spaces.Infrastructure.EntityConfigurations;

class TableEntityTypeConfiguration : IEntityTypeConfiguration<Table>
{
    public void Configure(EntityTypeBuilder<Table> builder)
    {
        builder.ToTable("tables");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .UseHiLo("tableseq", "spaces");

        builder.Ignore(t => t.DomainEvents);

        // Configure Name as JSON column
        builder.OwnsOne(t => t.Name, b => b.ToJson());

        builder.Property(t => t.BranchId)
            .IsRequired()
            .HasDefaultValue(1);

        builder.Property(t => t.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        // Indexes
        builder.HasIndex(t => t.BranchId);
    }
}
