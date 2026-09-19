#nullable enable
namespace Ninja.Payroll.Domain.AggregatesModel.PayslipAggregate;

public interface IPayslipRepository : IRepository<Payslip>
{
    Payslip Add(Payslip payslip);

    void Remove(Payslip payslip);

    Task<Payslip?> GetAsync(int id);

    /// <summary>The payslip already covering a period start for an employee, if any.</summary>
    Task<Payslip?> FindAsync(int employeeId, DateOnly periodStart);

    /// <summary>The payslip whose period ends on a day, if any: the month before, for its carry-over.</summary>
    Task<Payslip?> FindEndingAsync(int employeeId, DateOnly periodEnd);
}
