#nullable enable
namespace Ninja.Payroll.Domain.AggregatesModel.AttendanceAggregate;

public interface IAttendanceRepository : IRepository<AttendanceDay>
{
    AttendanceDay Add(AttendanceDay day);

    void Remove(AttendanceDay day);

    Task<AttendanceDay?> GetAsync(int employeeId, DateOnly date);

    /// <summary>Every day ever marked for one employee.</summary>
    Task<List<AttendanceDay>> GetForEmployeeAsync(int employeeId);

    Task<List<AttendanceDay>> GetRangeAsync(IEnumerable<int> employeeIds, DateOnly from, DateOnly to);
}
