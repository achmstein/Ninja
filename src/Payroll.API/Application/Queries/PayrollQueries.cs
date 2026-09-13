#nullable enable
using Chillax.Payroll.Infrastructure;

namespace Chillax.Payroll.API.Application.Queries;

public interface IPayrollQueries
{
    Task<IReadOnlyList<EmployeeView>> GetEmployeesAsync(int branchId, bool includeInactive);
    Task<EmployeeView?> GetEmployeeAsync(int id);
    Task<IReadOnlyList<AttendanceView>> GetAttendanceAsync(int branchId, DateOnly from, DateOnly to);
    Task<LedgerView?> GetLedgerAsync(int employeeId, DateOnly? from, DateOnly? to);
    Task<IReadOnlyList<PayslipView>> GetPayslipsAsync(int branchId, DateOnly from, DateOnly to);
    Task<PayslipView?> GetPayslipAsync(int id);
    Task<IReadOnlyList<TillEmployeeView>> GetTillEmployeesAsync(int branchId);
}

/// <summary>
/// Read side, straight off the context with no tracking. Balances are sums
/// over the ledger: a few hundred lines per person, one GROUP BY for a list.
/// </summary>
public class PayrollQueries(PayrollContext context) : IPayrollQueries
{
    public async Task<IReadOnlyList<EmployeeView>> GetEmployeesAsync(int branchId, bool includeInactive)
    {
        var query = context.Employees.AsNoTracking().Where(e => e.BranchId == branchId);
        if (!includeInactive)
            query = query.Where(e => e.EndedOn == null);

        var employees = await query.OrderBy(e => e.EndedOn != null).ThenBy(e => e.Name).ToListAsync();
        var balances = await BalancesAsync(employees.Select(e => e.Id));

        return employees.Select(e => ToView(e, balances.GetValueOrDefault(e.Id))).ToList();
    }

    public async Task<EmployeeView?> GetEmployeeAsync(int id)
    {
        var employee = await context.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.Id == id);
        if (employee is null) return null;

        var balances = await BalancesAsync([id]);
        return ToView(employee, balances.GetValueOrDefault(id));
    }

    public async Task<IReadOnlyList<AttendanceView>> GetAttendanceAsync(int branchId, DateOnly from, DateOnly to)
    {
        // Days worked at this branch, plus the branch's own people's days
        // anywhere: a cover shift elsewhere still shows on their row here
        var own = context.Employees.Where(e => e.BranchId == branchId).Select(e => e.Id);

        var rows = await context.Attendance.AsNoTracking()
            .Where(a => a.Date >= from && a.Date <= to && (a.BranchId == branchId || own.Contains(a.EmployeeId)))
            .OrderBy(a => a.Date)
            .ToListAsync();

        return rows.Select(a => new AttendanceView(a.EmployeeId, a.Date, a.BranchId, a.Status, a.OvertimeHours, a.Note, a.MarkedBy, a.MarkedAt)).ToList();
    }

    public async Task<LedgerView?> GetLedgerAsync(int employeeId, DateOnly? from, DateOnly? to)
    {
        if (!await context.Employees.AnyAsync(e => e.Id == employeeId))
            return null;

        var all = context.Ledger.AsNoTracking().Where(l => l.EmployeeId == employeeId);

        // The balance is always the whole ledger; the range only trims the list
        var balance = await all.SumAsync(l => l.Type == LedgerEntryType.Earned || l.Type == LedgerEntryType.Bonus ? l.Amount : -l.Amount);

        var ranged = all;
        if (from is { } f) ranged = ranged.Where(l => l.Date >= f);
        if (to is { } t) ranged = ranged.Where(l => l.Date <= t);

        var entries = await ranged.OrderByDescending(l => l.Date).ThenByDescending(l => l.Id).ToListAsync();

        return new LedgerView(employeeId, balance, entries.Select(ToView).ToList());
    }

    public async Task<IReadOnlyList<PayslipView>> GetPayslipsAsync(int branchId, DateOnly from, DateOnly to)
    {
        var rows = await context.Payslips.AsNoTracking()
            .Where(p => p.BranchId == branchId && p.PeriodStart <= to && p.PeriodEnd >= from)
            .OrderBy(p => p.PeriodStart)
            .ToListAsync();

        var names = await NamesAsync(rows.Select(p => p.EmployeeId));
        var balances = await BalancesAsync(rows.Select(p => p.EmployeeId));

        return rows
            .Select(p => ToView(p, names.GetValueOrDefault(p.EmployeeId, ""), balances.GetValueOrDefault(p.EmployeeId)))
            .OrderBy(p => p.EmployeeName)
            .ToList();
    }

    public async Task<PayslipView?> GetPayslipAsync(int id)
    {
        var payslip = await context.Payslips.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
        if (payslip is null) return null;

        var names = await NamesAsync([payslip.EmployeeId]);
        var balances = await BalancesAsync([payslip.EmployeeId]);
        return ToView(payslip, names.GetValueOrDefault(payslip.EmployeeId, ""), balances.GetValueOrDefault(payslip.EmployeeId));
    }

    public async Task<IReadOnlyList<TillEmployeeView>> GetTillEmployeesAsync(int branchId)
    {
        var employees = await context.Employees.AsNoTracking()
            .Where(e => e.BranchId == branchId && e.EndedOn == null)
            .OrderBy(e => e.Name)
            .ToListAsync();

        return employees
            .Select(e => new TillEmployeeView(e.Id, e.Name, e.JobTitle, e.CurrentTerms?.Scheme ?? PayScheme.Daily))
            .ToList();
    }

    private async Task<Dictionary<int, decimal>> BalancesAsync(IEnumerable<int> employeeIds)
    {
        var ids = employeeIds.Distinct().ToList();
        if (ids.Count == 0) return new();

        var rows = await context.Ledger.AsNoTracking()
            .Where(l => ids.Contains(l.EmployeeId))
            .GroupBy(l => l.EmployeeId)
            .Select(g => new { EmployeeId = g.Key, Balance = g.Sum(l => l.Type == LedgerEntryType.Earned || l.Type == LedgerEntryType.Bonus ? l.Amount : -l.Amount) })
            .ToListAsync();

        return rows.ToDictionary(r => r.EmployeeId, r => r.Balance);
    }

    private async Task<Dictionary<int, string>> NamesAsync(IEnumerable<int> employeeIds)
    {
        var ids = employeeIds.Distinct().ToList();
        if (ids.Count == 0) return new();

        return await context.Employees.AsNoTracking()
            .Where(e => ids.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, e => e.Name);
    }

    private static EmployeeView ToView(Employee e, decimal balance)
    {
        var current = e.CurrentTerms;
        return new EmployeeView(
            e.Id, e.Name, e.JobTitle, e.Phone, e.BranchId, e.UserId, e.StartedOn, e.EndedOn, e.IsActive, e.PaidDaysOff,
            current is null ? null : ToView(current),
            balance,
            e.Terms.OrderByDescending(t => t.EffectiveFrom).Select(ToView).ToList());
    }

    private static PayTermsView ToView(PayTerms t) => new(t.EffectiveFrom, t.Scheme, t.Rate);

    private static LedgerEntryView ToView(LedgerEntry l)
        => new(l.Id, l.EmployeeId, l.Type, l.Amount, l.Signed, l.Date, l.Note, l.Reference, l.Source, l.RecordedBy, l.RecordedAt);

    private static PayslipView ToView(Payslip p, string employeeName, decimal balance)
        => new(p.Id, p.EmployeeId, employeeName, p.BranchId, p.PeriodStart, p.PeriodEnd, p.Scheme, p.Rate, p.TermsChangedOn, p.DaysWorked, p.PaidOffDays,
            p.Earned, p.OvertimeHours, p.OvertimePay, p.AbsentDays, p.AbsenceDeduction, p.DaysOffCarriedIn, p.DaysOffAllowance, p.DaysOffUnused, p.Bonuses, p.Deductions, p.Advances, p.Payments, p.CarriedOver, p.AmountDue,
            // A paid payslip's remaining is history: what it handed over
            p.IsPaid ? p.PaidAmount ?? 0 : balance,
            p.Status, p.PaidAmount, p.PaidAt, p.PaidBy, p.Note, p.GeneratedBy, p.GeneratedAt);
}
