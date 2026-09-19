#nullable enable
namespace Ninja.Payroll.Domain.AggregatesModel.AttendanceAggregate;

/// <summary>
/// One person, one day, as the manager marked it. Keyed by employee and
/// date; an unmarked day has no row, and clearing a mark deletes it. For a
/// daily worker this is the pay: days worked × rate.
/// </summary>
public class AttendanceDay : IAggregateRoot
{
    public int EmployeeId { get; private set; }

    public DateOnly Date { get; private set; }

    /// <summary>Where the day was worked; a cover shift at another branch is marked there.</summary>
    public int BranchId { get; private set; }

    public AttendanceStatus Status { get; private set; }

    /// <summary>Hours worked past the day's shift, paid on top at the overtime rate.</summary>
    public decimal OvertimeHours { get; private set; }

    public string? Note { get; private set; }

    public string MarkedBy { get; private set; } = string.Empty;

    public DateTime MarkedAt { get; private set; }

    protected AttendanceDay() { }

    public AttendanceDay(int employeeId, DateOnly date, int branchId, AttendanceStatus status, string? note, string markedBy, decimal overtimeHours = 0m)
    {
        if (employeeId <= 0)
            throw new PayrollDomainException("Attendance needs the employee it is for.");

        if (branchId <= 0)
            throw new PayrollDomainException("Attendance needs the branch it was worked at.");

        EmployeeId = employeeId;
        Date = date;
        BranchId = branchId;
        Mark(status, note, markedBy, overtimeHours);
    }

    /// <param name="overtimeHours">Null leaves the hours as they are, so a status click never wipes them.</param>
    public void Mark(AttendanceStatus status, string? note, string markedBy, decimal? overtimeHours = null)
    {
        if (overtimeHours is { } hours)
        {
            if (hours < 0 || hours > 16)
                throw new PayrollDomainException("Overtime is between 0 and 16 hours.");

            OvertimeHours = hours;
        }

        // Overtime is worked; a day away has none
        if (DaysWorkedFor(status) == 0)
            OvertimeHours = 0;

        Status = status;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        MarkedBy = markedBy;
        MarkedAt = DateTime.UtcNow;
    }

    /// <summary>What the day counts for as work: a full day, half, or nothing.</summary>
    public decimal DaysWorked => DaysWorkedFor(Status);

    /// <summary>What the day takes from a monthly employee's allowance: a whole day off or absence, half, or nothing.</summary>
    public decimal DaysAbsent => 1m - DaysWorkedFor(Status);

    /// <summary>An agreed rest day, paid to a daily worker within their allowance.</summary>
    public bool IsDayOff => Status == AttendanceStatus.DayOff;

    public static decimal DaysWorkedFor(AttendanceStatus status) => status switch
    {
        AttendanceStatus.Present => 1m,
        AttendanceStatus.HalfDay => 0.5m,
        _ => 0m,
    };
}
