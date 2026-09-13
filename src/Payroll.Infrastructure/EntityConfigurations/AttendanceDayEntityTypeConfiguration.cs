namespace Chillax.Payroll.Infrastructure.EntityConfigurations;

class AttendanceDayEntityTypeConfiguration : IEntityTypeConfiguration<AttendanceDay>
{
    public void Configure(EntityTypeBuilder<AttendanceDay> builder)
    {
        builder.ToTable("attendance");

        // One mark per person per day; an unmarked day has no row
        builder.HasKey(a => new { a.EmployeeId, a.Date });

        builder.Ignore(a => a.DaysWorked);
        builder.Ignore(a => a.DaysAbsent);
        builder.Ignore(a => a.IsDayOff);

        builder.Property(a => a.OvertimeHours).HasPrecision(4, 1);
        builder.Property(a => a.Note).HasMaxLength(200);
        builder.Property(a => a.MarkedBy).HasMaxLength(200).IsRequired();

        builder.HasIndex(a => new { a.BranchId, a.Date });
    }
}
