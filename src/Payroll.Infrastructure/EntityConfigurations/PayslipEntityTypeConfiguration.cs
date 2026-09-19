namespace Ninja.Payroll.Infrastructure.EntityConfigurations;

class PayslipEntityTypeConfiguration : IEntityTypeConfiguration<Payslip>
{
    public void Configure(EntityTypeBuilder<Payslip> builder)
    {
        builder.ToTable("payslips");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .UseHiLo("payslipseq", "payroll");

        builder.Ignore(p => p.DomainEvents);
        builder.Ignore(p => p.Reference);
        builder.Ignore(p => p.IsPaid);

        foreach (var money in new[] { nameof(Payslip.Rate), nameof(Payslip.Earned), nameof(Payslip.OvertimePay), nameof(Payslip.AbsenceDeduction), nameof(Payslip.Bonuses),
            nameof(Payslip.Deductions), nameof(Payslip.Advances), nameof(Payslip.Payments), nameof(Payslip.CarriedOver), nameof(Payslip.AmountDue), nameof(Payslip.PaidAmount) })
        {
            builder.Property(money).HasPrecision(18, 2);
        }

        builder.Property(p => p.DaysWorked).HasPrecision(6, 1);
        builder.Property(p => p.OvertimeHours).HasPrecision(6, 1);
        builder.Property(p => p.AbsentDays).HasPrecision(6, 1);
        builder.Property(p => p.PaidOffDays).HasPrecision(6, 1);
        builder.Property(p => p.DaysOffCarriedIn).HasPrecision(6, 1);
        builder.Property(p => p.DaysOffAllowance).HasPrecision(6, 1);
        builder.Property(p => p.DaysOffUnused).HasPrecision(6, 1);
        builder.Property(p => p.Note).HasMaxLength(500);
        builder.Property(p => p.PaidBy).HasMaxLength(200);
        builder.Property(p => p.GeneratedBy).HasMaxLength(200).IsRequired();

        // One payslip per employee per period start
        builder.HasIndex(p => new { p.EmployeeId, p.PeriodStart }).IsUnique();
        builder.HasIndex(p => new { p.BranchId, p.PeriodStart });
    }
}
