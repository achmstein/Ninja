namespace Ninja.Payroll.Domain.AggregatesModel.AttendanceAggregate;

/// <summary>
/// How a day was marked. <see cref="DayOff"/> is an agreed rest day; it is
/// paid within the employee's allowance. <see cref="Absent"/> is a no-show
/// and never paid. Both count against a monthly employee's allowance.
/// </summary>
public enum AttendanceStatus
{
    Present = 0,
    HalfDay = 1,
    Absent = 2,
    DayOff = 3,
}
