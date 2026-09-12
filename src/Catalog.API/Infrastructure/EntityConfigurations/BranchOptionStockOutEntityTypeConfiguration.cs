namespace Chillax.Catalog.API.Infrastructure.EntityConfigurations;

class BranchOptionStockOutEntityTypeConfiguration : IEntityTypeConfiguration<BranchOptionStockOut>
{
    public void Configure(EntityTypeBuilder<BranchOptionStockOut> builder)
    {
        builder.ToTable("BranchOptionStockOuts");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.BranchId).IsRequired();
        builder.Property(s => s.CustomizationOptionId).IsRequired();

        builder.HasOne(s => s.CustomizationOption)
            .WithMany()
            .HasForeignKey(s => s.CustomizationOptionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => new { s.BranchId, s.CustomizationOptionId }).IsUnique();
    }
}
