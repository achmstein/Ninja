#nullable enable
using Ninja.Payroll.API.Application.Services;

namespace Ninja.Payroll.API.Application.Commands;

/// <summary>One person's mark for a day; a null status clears it. Null overtime leaves the hours as they were.</summary>
public record AttendanceMark(int EmployeeId, AttendanceStatus? Status, string? Note = null, decimal? OvertimeHours = null);

/// <summary>
/// Mark a day for many people at once: the grid sends one cell, "everyone
/// present" sends the whole column. Upserts; a cleared mark deletes its row.
/// </summary>
public record MarkAttendanceCommand(int BranchId, DateOnly Date, IReadOnlyList<AttendanceMark> Marks, string MarkedBy) : IRequest<bool>;

public class MarkAttendanceCommandHandler(
    IEmployeeRepository employees,
    IAttendanceRepository attendance,
    IPayslipGenerator generator) : IRequestHandler<MarkAttendanceCommand, bool>
{
    public async Task<bool> Handle(MarkAttendanceCommand command, CancellationToken cancellationToken)
    {
        if (command.Date > DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1))
            throw new PayrollDomainException("Attendance cannot be marked for a day that has not come.");

        var people = (await employees.GetManyAsync(command.Marks.Select(m => m.EmployeeId))).ToDictionary(e => e.Id);

        foreach (var mark in command.Marks)
        {
            if (!people.TryGetValue(mark.EmployeeId, out var employee))
                throw new PayrollDomainException("Employee not found.");

            if (mark.Status is not null && !employee.EmployedOn(command.Date))
                throw new PayrollDomainException($"{employee.Name} was not employed on {command.Date:yyyy-MM-dd}.");

            var existing = await attendance.GetAsync(mark.EmployeeId, command.Date);

            if (mark.Status is null)
            {
                if (existing is not null)
                    attendance.Remove(existing);
                continue;
            }

            if (existing is null)
                attendance.Add(new AttendanceDay(mark.EmployeeId, command.Date, command.BranchId, mark.Status.Value, mark.Note, command.MarkedBy, mark.OvertimeHours ?? 0m));
            else
                existing.Mark(mark.Status.Value, mark.Note, command.MarkedBy, mark.OvertimeHours);
        }

        await attendance.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        // A marked day changes what the month is worth
        await generator.RefreshCurrentAsync(people.Values, command.Date, command.MarkedBy);
        return true;
    }
}
