using System.ComponentModel;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;
using static Ninja.Assistant.API.Tools.ToolSupport;

namespace Ninja.Assistant.API.Tools;

/// <summary>
/// The staff register from chat: a hire, an edit of someone's details and the
/// day's attendance. Pay is set once, with the hire, as the back office's form
/// does; after that a rate, a scheme, a payslip or a ledger line stays with
/// the back office.
/// </summary>
[McpServerToolType]
public sealed class StaffWriteTools(TenantContext tenant, NinjaApiClient api, WriteFlow flow, TimeProvider clock)
{
    internal const string HireTool = "add_employee";
    internal const string UpdateTool = "update_employee";
    internal const string AttendanceTool = "mark_attendance";

    public sealed record AttendanceInput(
        [property: Description("The employee's name or id, or \"everyone\" for all active staff at the branch")] string Employee,
        [property: Description("present, half_day, absent or day_off")] string Status,
        [property: Description("A short note, e.g. late 30 minutes, sick")] string? Note = null);

    [McpServerTool(Name = HireTool, Title = "Add an employee", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Adds a new employee to a branch's staff register with their job title, phone, start date and the pay they were hired on (a daily or monthly rate), as the back office's Add employee form does. " +
        "Use for 'we hired Mona as a barista at 250 a day', 'add Karim, waiter, 6000 a month, starting Saturday'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> AddEmployee(
        [Description("Their full name")] string name,
        [Description("Pay at hire: daily or monthly")] string scheme,
        [Description("Pay at hire: the amount per day or per month")] decimal rate,
        [Description("Job title, e.g. Barista, Waiter, Cashier")] string? jobTitle = null,
        [Description("Phone number")] string? phone = null,
        [Description("Branch id or name they work at; required when the business has more than one active branch")] string? branch = null,
        [Description("First working day, yyyy-MM-dd; default today")] string? startDate = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(name)) return ToolResults.Fail("The employee needs a name.");
        if (rate <= 0) return ToolResults.Fail("The pay must be a positive amount.");
        var schemeCode = scheme.Trim().ToLowerInvariant() switch
        {
            "daily" or "day" or "per day" => 0,
            "monthly" or "month" or "per month" => 1,
            _ => -1,
        };
        if (schemeCode < 0) return ToolResults.Fail("scheme must be daily or monthly.");

        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;
        var one = BranchSelector.SelectOne(snap.Branches, branch);
        if (!one.IsOk) return ToolResults.Fail(one.Error!);
        var target = one.Value!;
        var (start, dateError) = BusinessWrite.Day(startDate, snap, target, clock);
        if (dateError is not null) return ToolResults.Fail(dateError.Replace("date", "startDate"));

        var staff = await api.GetAsync<List<EmployeeDetails>>("payroll-api", "/api/payroll/employees", target.Id, ct);
        if (!staff.IsOk) return ToolResults.Fail(staff.Error!);
        var namesake = BusinessWrite.SameName(staff.Value!, e => e.Named, new LocalizedText(name.Trim(), name.Trim()));

        var preview = $"Add {name.Trim()}" + (string.IsNullOrWhiteSpace(jobTitle) ? "" : $" as {jobTitle.Trim()}") + $" at {target.BothNames}, starting {Day(start)}, "
            + $"paid {snap.Currency} {ToolResults.Money(rate)} a {(schemeCode == 0 ? "day" : "month")}"
            + (string.IsNullOrWhiteSpace(phone) ? "" : $", phone {phone.Trim()}") + "."
            + (namesake is null ? "" : $" Note: {namesake.Name} (id {namesake.Id}) already works here; this adds a second person.");
        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var key = flow.StepKey(HireTool, requestId, "hire");
        var body = new HireEmployeeRequest(name.Trim(), BusinessWrite.Clean(jobTitle), BusinessWrite.Clean(phone), target.Id, null, start, schemeCode, rate);
        var result = await api.SendAsync<CreatedResponse>(HttpMethod.Post, "payroll-api", "/api/payroll/employees", target.Id, body, key, ct);
        flow.Audit(HireTool, new { name = body.Name, body.JobTitle, branch = target.Id, start = Day(start), scheme = schemeCode, rate, requestId, key },
            result.IsOk ? $"employee {result.Value!.Id}" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(result.Value!.Id == 0
            ? new { done = true, employeeId = (int?)null, preview, note = (string?)"This hire had already been recorded; nobody was added twice." }
            : new { done = true, employeeId = (int?)result.Value.Id, preview, note = (string?)null });
    }

    [McpServerTool(Name = UpdateTool, Title = "Change an employee's details", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Changes an employee's name, job title or phone, or moves them to another branch. Pay is not changed here: a new rate or scheme is set in the back office. " +
        "Use for 'Mona is now a shift supervisor', 'update Karim's phone', 'move Ali to the Maadi branch'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> UpdateEmployee(
        [Description("The employee's name or id")] string employee,
        [Description("Branch id or name to look for them in; leave out to look in every active branch")] string? branch = null,
        [Description("Their new name")] string? newName = null,
        [Description("Their new job title")] string? jobTitle = null,
        [Description("Their new phone number")] string? phone = null,
        [Description("Branch id or name to move them to")] string? moveToBranch = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (newName is null && jobTitle is null && phone is null && moveToBranch is null)
            return ToolResults.Fail("Say what to change: their name, job title, phone, or the branch they work at.");
        if (newName is not null && string.IsNullOrWhiteSpace(newName)) return ToolResults.Fail("The new name cannot be empty.");

        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;
        var where = BranchSelector.Select(snap.Branches, branch);
        if (!where.IsOk) return ToolResults.Fail(where.Error!);

        var staff = await StaffAsync(where.Value!, ct);
        if (staff.Error is not null) return ToolResults.Fail(staff.Error);
        var (found, error) = NameResolver.Pick(staff.People, employee, e => e.Id, e => e.Named, "employee");
        if (found is null) return ToolResults.Fail(error!);

        BranchResponse? moveTo = null;
        if (moveToBranch is not null)
        {
            var to = BranchSelector.SelectOne(snap.Branches, moveToBranch);
            if (!to.IsOk) return ToolResults.Fail(to.Error!);
            moveTo = to.Value!;
        }
        var home = snap.Branches.FirstOrDefault(b => b.Id == found.BranchId);
        var homeName = home?.BothNames ?? $"branch {found.BranchId}";

        var changes = new List<string>();
        if (newName is not null) changes.Add($"name → {newName.Trim()}");
        if (jobTitle is not null) changes.Add($"job title {found.JobTitle ?? "none"} → {BusinessWrite.Clean(jobTitle) ?? "none"}");
        if (phone is not null) changes.Add($"phone {found.Phone ?? "none"} → {BusinessWrite.Clean(phone) ?? "none"}");
        if (moveTo is not null) changes.Add($"works at {homeName} → {moveTo.BothNames}");
        var preview = $"Change {found.Name} (id {found.Id}, {homeName}): {string.Join("; ", changes)}. Their pay stays as it is.";

        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        // Payroll writes the whole record: what the owner did not name, including their sign-in and paid days off, goes back as it was
        var body = new UpdateEmployeeRequest(
            newName?.Trim() ?? found.Name ?? "",
            jobTitle is null ? found.JobTitle : BusinessWrite.Clean(jobTitle),
            phone is null ? found.Phone : BusinessWrite.Clean(phone),
            moveTo?.Id ?? found.BranchId,
            found.UserId,
            found.PaidDaysOff);
        var result = await api.SendAsync<Unit>(HttpMethod.Put, "payroll-api", $"/api/payroll/employees/{found.Id}", found.BranchId, body, null, ct);
        flow.Audit(UpdateTool, new { employeeId = found.Id, body.Name, body.JobTitle, body.Phone, body.BranchId, requestId }, result.IsOk ? "employee updated" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, employeeId = found.Id, preview });
    }

    [McpServerTool(Name = AttendanceTool, Title = "Mark attendance", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Marks a day's attendance at one branch for the people named: present, half day, absent or a day off, with an optional note; marking someone again replaces their mark for that day. " +
        "Use for 'everyone came in today except Ali who was sick', 'mark Mona absent yesterday', 'Karim had his day off on Friday'. " + WriteFlow.ConfirmDescription)]
    public async Task<CallToolResult> MarkAttendance(
        [Description("Who and how: one line per person, or \"everyone\" first and then the exceptions")] List<AttendanceInput> marks,
        [Description("The business date, yyyy-MM-dd; default today")] string? date = null,
        [Description("Branch id or name; required when the business has more than one active branch")] string? branch = null,
        [Description(WriteFlow.RequestIdDescription)] string? requestId = null,
        [Description(WriteFlow.ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (marks is not { Count: > 0 }) return ToolResults.Fail("Say who to mark and how.");

        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;
        var one = BranchSelector.SelectOne(snap.Branches, branch);
        if (!one.IsOk) return ToolResults.Fail(one.Error!);
        var target = one.Value!;
        var (day, dateError) = BusinessWrite.Day(date, snap, target, clock);
        if (dateError is not null) return ToolResults.Fail(dateError);

        var staff = await api.GetAsync<List<EmployeeDetails>>("payroll-api", "/api/payroll/employees", target.Id, ct);
        if (!staff.IsOk) return ToolResults.Fail(staff.Error!);
        var people = staff.Value!.Where(e => e.IsActive).ToList();

        // In order, so "everyone present" and then "Ali absent" leaves Ali absent
        var wanted = new Dictionary<int, (EmployeeDetails Who, int Status, string? Note)>();
        foreach (var mark in marks)
        {
            var status = Status(mark.Status);
            if (status < 0) return ToolResults.Fail($"'{mark.Status}' is not a mark: use present, half_day, absent or day_off.");
            if (mark.Employee.Trim().ToLowerInvariant() is "everyone" or "all" or "الكل")
            {
                foreach (var person in people) wanted[person.Id] = (person, status, BusinessWrite.Clean(mark.Note));
                continue;
            }
            var (found, error) = NameResolver.Pick(people, mark.Employee, e => e.Id, e => e.Named, "employee");
            if (found is null) return ToolResults.Fail($"{error} The staff at {target.BothNames}: {string.Join(", ", people.Select(p => p.Name))}.");
            wanted[found.Id] = (found, status, BusinessWrite.Clean(mark.Note));
        }
        if (wanted.Count == 0) return ToolResults.Fail($"{target.BothNames} has no active staff to mark.");

        var marked = await api.GetAsync<List<AttendanceView>>("payroll-api", $"/api/payroll/attendance?from={Day(day)}&to={Day(day)}", target.Id, ct);
        var before = (marked.Value ?? []).Where(a => a.Date == day).ToDictionary(a => a.EmployeeId, a => a.Status);
        var lines = wanted.Values.Select(w => $"{w.Who.Name}: {Label(w.Status)}"
            + (w.Note is null ? "" : $" ({w.Note})")
            + (before.TryGetValue(w.Who.Id, out var was) ? (was == w.Status ? " (already marked so)" : $" (was {Label(was)})") : ""));
        var preview = $"Mark {Day(day)} at {target.BothNames}:\n- {string.Join("\n- ", lines)}";

        requestId ??= WriteFlow.NewRequestId();
        if (!confirm) return ToolResults.Ok(new { preview, requestId, nextStep = WriteFlow.NextStep });
        if (flow.Limit() is { } limited) return ToolResults.Fail(limited);

        var body = new MarkAttendanceRequest(wanted.Values.Select(w => new AttendanceMark(w.Who.Id, w.Status, w.Note)).ToList());
        var result = await api.SendAsync<Unit>(HttpMethod.Put, "payroll-api", $"/api/payroll/attendance/{Day(day)}", target.Id, body, null, ct);
        flow.Audit(AttendanceTool, new { day = Day(day), branch = target.Id, marks = body.Marks.Select(m => new { m.EmployeeId, m.Status }), requestId },
            result.IsOk ? $"{body.Marks.Count} marked" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);
        return ToolResults.Ok(new { done = true, marked = body.Marks.Count, preview });
    }

    private async Task<(List<EmployeeDetails> People, string? Error)> StaffAsync(IReadOnlyList<BranchResponse> branches, CancellationToken ct)
    {
        var people = new List<EmployeeDetails>();
        foreach (var b in branches)
        {
            var staff = await api.GetAsync<List<EmployeeDetails>>("payroll-api", "/api/payroll/employees", b.Id, ct);
            if (!staff.IsOk) return ([], staff.Error);
            people.AddRange(staff.Value!.Where(e => people.All(p => p.Id != e.Id)));
        }
        return (people, null);
    }

    /// <summary>Payroll's AttendanceStatus: Present 0, HalfDay 1, Absent 2, DayOff 3</summary>
    internal static int Status(string text) => text.Trim().ToLowerInvariant().Replace(' ', '_').Replace('-', '_') switch
    {
        "present" or "in" or "came" or "worked" => 0,
        "half_day" or "half" or "halfday" => 1,
        "absent" or "away" or "sick" or "missing" => 2,
        "day_off" or "off" or "dayoff" or "rest" => 3,
        _ => -1,
    };

    private static string Label(int status) => status switch
    {
        0 => "present",
        1 => "half day",
        2 => "absent",
        3 => "day off",
        _ => $"status {status}",
    };
}
