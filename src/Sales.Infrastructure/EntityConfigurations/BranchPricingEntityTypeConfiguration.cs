namespace Chillax.Sales.Infrastructure.EntityConfigurations;

class BranchPricingEntityTypeConfiguration : IEntityTypeConfiguration<BranchPricing>
{
    public void Configure(EntityTypeBuilder<BranchPricing> builder)
    {
        builder.ToTable("branch_pricing");

        // One row per branch, keyed by the branch itself
        builder.HasKey(p => p.BranchId);
        builder.Property(p => p.BranchId).ValueGeneratedNever();

        builder.Ignore(p => p.Rules);

        builder.Property(p => p.VatRate).HasPrecision(5, 4);
        builder.Property(p => p.ServiceChargeRate).HasPrecision(5, 4);
        builder.Property(p => p.UpdatedBy).HasMaxLength(64).IsRequired();
    }
}
