namespace Ninja.Finance.Infrastructure.EntityConfigurations;

class SalesFactEntityTypeConfiguration : IEntityTypeConfiguration<SalesFact>
{
    public void Configure(EntityTypeBuilder<SalesFact> builder)
    {
        builder.ToTable("sales_facts");
        builder.HasKey(f => f.Id);
        builder.Property(f => f.Id).UseHiLo("salesfactseq", "finance");
        builder.Ignore(f => f.DomainEvents);
        builder.Property(f => f.Amount).HasPrecision(18, 2);
        builder.Property(f => f.Vat).HasPrecision(18, 2);
        builder.Property(f => f.Reference).HasMaxLength(100).IsRequired();
        builder.HasIndex(f => new { f.BranchId, f.Date });
        // A redelivered settle or refund changes nothing
        builder.HasIndex(f => f.Reference).IsUnique();
        // A sale finds the refunds that arrived before it
        builder.HasIndex(f => f.TicketId);
    }
}

class CostFactEntityTypeConfiguration : IEntityTypeConfiguration<CostFact>
{
    public void Configure(EntityTypeBuilder<CostFact> builder)
    {
        builder.ToTable("cost_facts");
        builder.HasKey(f => f.Id);
        builder.Property(f => f.Id).UseHiLo("costfactseq", "finance");
        builder.Ignore(f => f.DomainEvents);
        builder.Property(f => f.Amount).HasPrecision(18, 2);
        builder.Property(f => f.Reference).HasMaxLength(100).IsRequired();
        builder.HasIndex(f => new { f.BranchId, f.Date });
        builder.HasIndex(f => f.Reference).IsUnique();
    }
}

class LabourFactEntityTypeConfiguration : IEntityTypeConfiguration<LabourFact>
{
    public void Configure(EntityTypeBuilder<LabourFact> builder)
    {
        builder.ToTable("labour_facts");
        builder.HasKey(f => f.Id);
        builder.Property(f => f.Id).UseHiLo("labourfactseq", "finance");
        builder.Ignore(f => f.DomainEvents);
        builder.Property(f => f.Amount).HasPrecision(18, 2);
        // One figure per payslip, the newest from Payroll; facts from before
        // Payroll named the payslip (0) stay one per employee and period start
        builder.HasIndex(f => new { f.PayslipId, f.EmployeeId, f.PeriodStart }).IsUnique();
        builder.HasIndex(f => new { f.BranchId, f.PeriodStart });
    }
}

class BranchDayStartEntityTypeConfiguration : IEntityTypeConfiguration<BranchDayStart>
{
    public void Configure(EntityTypeBuilder<BranchDayStart> builder)
    {
        builder.ToTable("branch_day_starts");
        builder.HasKey(d => d.BranchId);
        builder.Property(d => d.BranchId).ValueGeneratedNever();
    }
}
