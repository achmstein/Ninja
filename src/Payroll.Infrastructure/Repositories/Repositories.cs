#nullable enable
namespace Chillax.Payroll.Infrastructure.Repositories;

public class EmployeeRepository(PayrollContext context) : IEmployeeRepository
{
    public IUnitOfWork UnitOfWork => context;

    public Employee Add(Employee employee) => context.Employees.Add(employee).Entity;

    public Task<Employee?> GetAsync(int id)
        => context.Employees.FirstOrDefaultAsync(e => e.Id == id);

    public Task<List<Employee>> GetManyAsync(IEnumerable<int> ids)
    {
        var list = ids.Distinct().ToList();
        return context.Employees.Where(e => list.Contains(e.Id)).ToListAsync();
    }

    public Task<List<Employee>> GetAtBranchDuringAsync(int branchId, DateOnly from, DateOnly to)
        => context.Employees
            .Where(e => e.BranchId == branchId && e.StartedOn <= to && (e.EndedOn == null || e.EndedOn >= from))
            .OrderBy(e => e.Name)
            .ToListAsync();

    public Task<bool> UserLinkedElsewhereAsync(string userId, int? exceptEmployeeId)
        => context.Employees.AnyAsync(e => e.UserId == userId && e.Id != exceptEmployeeId);

    public Task<Employee?> FindByUserIdAsync(string userId)
        => context.Employees.FirstOrDefaultAsync(e => e.UserId == userId);
}

public class AttendanceRepository(PayrollContext context) : IAttendanceRepository
{
    public IUnitOfWork UnitOfWork => context;

    public AttendanceDay Add(AttendanceDay day) => context.Attendance.Add(day).Entity;

    public void Remove(AttendanceDay day) => context.Attendance.Remove(day);

    public Task<AttendanceDay?> GetAsync(int employeeId, DateOnly date)
        => context.Attendance.FirstOrDefaultAsync(a => a.EmployeeId == employeeId && a.Date == date);

    public Task<List<AttendanceDay>> GetRangeAsync(IEnumerable<int> employeeIds, DateOnly from, DateOnly to)
    {
        var list = employeeIds.Distinct().ToList();
        return context.Attendance
            .Where(a => list.Contains(a.EmployeeId) && a.Date >= from && a.Date <= to)
            .ToListAsync();
    }
}

public class LedgerRepository(PayrollContext context) : ILedgerRepository
{
    public IUnitOfWork UnitOfWork => context;

    public LedgerEntry Add(LedgerEntry entry) => context.Ledger.Add(entry).Entity;

    public Task<List<LedgerEntry>> GetForEmployeeAsync(int employeeId)
        => context.Ledger.Where(l => l.EmployeeId == employeeId).OrderBy(l => l.Date).ThenBy(l => l.Id).ToListAsync();

    public Task<LedgerEntry?> FindByReferenceAsync(string reference)
        => context.Ledger.FirstOrDefaultAsync(l => l.Reference == reference);

    public void Remove(LedgerEntry entry) => context.Ledger.Remove(entry);
}

public class PayslipRepository(PayrollContext context) : IPayslipRepository
{
    public IUnitOfWork UnitOfWork => context;

    public Payslip Add(Payslip payslip) => context.Payslips.Add(payslip).Entity;

    public void Remove(Payslip payslip) => context.Payslips.Remove(payslip);

    public Task<Payslip?> GetAsync(int id)
        => context.Payslips.FirstOrDefaultAsync(p => p.Id == id);

    public Task<Payslip?> FindAsync(int employeeId, DateOnly periodStart)
        => context.Payslips.FirstOrDefaultAsync(p => p.EmployeeId == employeeId && p.PeriodStart == periodStart);

    public Task<Payslip?> FindEndingAsync(int employeeId, DateOnly periodEnd)
        => context.Payslips.FirstOrDefaultAsync(p => p.EmployeeId == employeeId && p.PeriodEnd == periodEnd);
}
