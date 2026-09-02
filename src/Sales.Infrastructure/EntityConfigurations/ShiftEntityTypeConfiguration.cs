using Chillax.Sales.Domain.AggregatesModel.ShiftAggregate;

namespace Chillax.Sales.Infrastructure.EntityConfigurations;

class ShiftEntityTypeConfiguration : IEntityTypeConfiguration<Shift>
{
    public void Configure(EntityTypeBuilder<Shift> builder)
    {
        builder.ToTable("shifts");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .UseHiLo("shiftseq", "sales");

        builder.Ignore(s => s.DomainEvents);

        builder.Property(s => s.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(s => s.OpeningFloat).HasPrecision(18, 2);
        builder.Property(s => s.ClosingCount).HasPrecision(18, 2);
        builder.Property(s => s.ExpectedCash).HasPrecision(18, 2);
        builder.Property(s => s.OverShort).HasPrecision(18, 2);

        builder.Property(s => s.OpenedBy).HasMaxLength(64).IsRequired();
        builder.Property(s => s.ClosedBy).HasMaxLength(64);

        builder.HasMany(s => s.Movements)
            .WithOne()
            .HasForeignKey("ShiftId")
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(s => s.Movements).AutoInclude();

        // One live drawer per branch — the DB enforces what the open command
        // checks, so a race can't open two
        builder.HasIndex(s => s.BranchId)
            .IsUnique()
            .HasFilter("\"Status\" = 'Open'");

        builder.HasIndex(s => new { s.BranchId, s.OpenedAt });
    }
}
