using System.ComponentModel;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;
using static Ninja.Assistant.API.Tools.ToolSupport;

namespace Ninja.Assistant.API.Tools;

[McpServerToolType]
public sealed class StaffTools(TenantContext tenant, NinjaApiClient api, TimeProvider clock)
{
    [McpServerTool(Name = "get_staff", Title = "Staff", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("The employees per branch with job title, start date and balance: a positive balance is what the cafe still owes them (unpaid wages), a negative one an advance they took. Use for 'who works at', 'how much do we owe staff', 'who has an advance'.")]
    public async Task<CallToolResult> GetStaff(
        [Description(BranchDescription)] string? branch = null,
        [Description("Include employees who have left")] bool includeInactive = false,
        CancellationToken ct = default)
    {
        var (snap, branches, fail) = await Resolve(branch, ct);
        if (fail is not null) return fail;

        var fan = await FanOut.PerBranchAsync(branches!,
            b => api.GetAsync<List<EmployeeView>>("payroll-api", $"/api/payroll/employees?includeInactive={(includeInactive ? "true" : "false")}", b.Id, ct));
        if (!fan.AnyOk) return ToolResults.Fail(string.Join("\n", fan.Errors));

        return ToolResults.Ok(new
        {
            currency = snap!.Currency,
            employees = fan.Ok.Sum(x => x.Value.Count),
            owedToStaff = fan.Ok.SelectMany(x => x.Value).Where(e => e.Balance > 0).Sum(e => e.Balance),
            advancesOut = fan.Ok.SelectMany(x => x.Value).Where(e => e.Balance < 0).Sum(e => -e.Balance),
            branches = fan.Ok.Select(x => new
            {
                id = x.Branch.Id,
                name = x.Branch.DisplayName,
                employees = x.Value.OrderBy(e => e.Name).Select(e => new
                {
                    e.Id,
                    e.Name,
                    e.JobTitle,
                    startedOn = Day(e.StartedOn),
                    e.IsActive,
                    e.Balance,
                }),
            }),
            errors = ErrorsOrNull(fan.Errors),
        });
    }

    [McpServerTool(Name = "get_attendance", Title = "Attendance", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("Attendance per employee in a period: days present, half days, absent, days off, and overtime hours. Use for 'who was absent', 'attendance this month', 'overtime'.")]
    public async Task<CallToolResult> GetAttendance(
        [Description(PeriodDescription)] string period = "this_month",
        [Description(FromDescription)] string? from = null,
        [Description(ToDescription)] string? to = null,
        [Description(BranchDescription)] string? branch = null,
        CancellationToken ct = default)
    {
        var (snap, branches, fail) = await Resolve(branch, ct);
        if (fail is not null) return fail;

        var employees = await FanOut.PerBranchAsync(branches!,
            b => api.GetAsync<List<EmployeeView>>("payroll-api", "/api/payroll/employees?includeInactive=true", b.Id, ct));
        var names = employees.Ok.SelectMany(x => x.Value).GroupBy(e => e.Id).ToDictionary(g => g.Key, g => g.First().Name ?? $"Employee {g.Key}");

        var fan = await PerBranchWithPeriodAsync(snap!, branches!, period, from, to, clock.GetUtcNow(),
            (b, p) => api.GetAsync<List<AttendanceView>>("payroll-api", $"/api/payroll/attendance?from={Day(p.FromDate)}&to={Day(p.ToDate)}", b.Id, ct));
        if (!fan.AnyOk) return ToolResults.Fail(string.Join("\n", fan.Errors.Concat(employees.Errors)));

        return ToolResults.Ok(new
        {
            period = fan.Ok[0].Value.Period.Label,
            days = fan.Ok[0].Value.Period.Days,
            employees = fan.Ok.SelectMany(x => x.Value.Value.Select(a => (branch: x.Branch.DisplayName, a)))
                .GroupBy(t => t.a.EmployeeId)
                .Select(g => new
                {
                    employeeId = g.Key,
                    name = names.GetValueOrDefault(g.Key, $"Employee {g.Key}"),
                    branch = g.First().branch,
                    present = g.Count(t => t.a.Status == 0),
                    halfDays = g.Count(t => t.a.Status == 1),
                    absent = g.Count(t => t.a.Status == 2),
                    daysOff = g.Count(t => t.a.Status == 3),
                    overtimeHours = g.Sum(t => t.a.OvertimeHours),
                })
                .OrderByDescending(e => e.absent).ThenBy(e => e.name),
            errors = ErrorsOrNull(fan.Errors.Concat(employees.Errors).ToList()),
        });
    }

    private async Task<(TenantSnapshot? Snapshot, IReadOnlyList<BranchResponse>? Branches, CallToolResult? Fail)> Resolve(string? branch, CancellationToken ct)
    {
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return (null, null, ToolResults.Fail(snapshot.Error!));
        var branches = BranchSelector.Select(snapshot.Value!.Branches, branch);
        if (!branches.IsOk) return (null, null, ToolResults.Fail(branches.Error!));
        return (snapshot.Value, branches.Value, null);
    }
}
