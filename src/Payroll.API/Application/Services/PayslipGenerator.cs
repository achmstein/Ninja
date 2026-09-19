#nullable enable
using Ninja.Payroll.API.Application.IntegrationEvents.Events;

namespace Ninja.Payroll.API.Application.Services;

/// <summary>
/// Makes or refreshes one employee's payslip for a period: the statement
/// from attendance, terms and the ledger, and the Earned line under the
/// payslip's reference (replaced on every refresh). Used by the explicit
/// "generate" and, through <see cref="RefreshCurrentAsync"/>, by everything
/// that changes what the current month is worth — a marked day, a pay-out
/// from the till, a line keyed in by hand, a hire, a change of pay — so
/// the account always shows the month's earnings beside what was paid.
/// </summary>
public interface IPayslipGenerator
{
    /// <summary>Answers the payslip, or null when the period is already paid and <paramref name="throwIfPaid"/> is false.</summary>
    Task<Payslip?> GenerateAsync(Employee employee, int branchId, DateOnly periodStart, DateOnly periodEnd, string by, bool throwIfPaid);

    /// <summary>Refresh (or create) the calendar month's draft covering <paramref name="date"/> for these employees; a paid month is left alone.</summary>
    Task RefreshCurrentAsync(IEnumerable<Employee> employees, DateOnly date, string by);
}

public class PayslipGenerator(
    IAttendanceRepository attendance,
    ILedgerRepository ledger,
    IPayslipRepository payslips,
    IPayrollIntegrationEventService integrationEvents) : IPayslipGenerator
{
    public async Task<Payslip?> GenerateAsync(Employee employee, int branchId, DateOnly periodStart, DateOnly periodEnd, string by, bool throwIfPaid)
    {
        var existing = await payslips.FindAsync(employee.Id, periodStart);

        if (existing is not null && existing.IsPaid)
        {
            if (throwIfPaid)
                throw new PayrollDomainException("This period is already paid; post a correction on the ledger instead.");
            return null;
        }

        if (existing is not null && existing.PeriodEnd != periodEnd)
            throw new PayrollDomainException($"{employee.Name} already has a draft for a period starting {periodStart:yyyy-MM-dd} that ends on {existing.PeriodEnd:yyyy-MM-dd}. Delete it first.");

        var days = await attendance.GetRangeAsync([employee.Id], periodStart, periodEnd);

        // The draft's own Earned line is replaced, so it must not count as
        // carried over
        var lines = await ledger.GetForEmployeeAsync(employee.Id);
        if (existing is not null)
        {
            var old = lines.FirstOrDefault(l => l.Reference == existing.Reference);
            if (old is not null)
            {
                ledger.Remove(old);
                lines.Remove(old);
            }
        }

        // Days off the month before left untaken come along, once
        var previous = await payslips.FindEndingAsync(employee.Id, periodStart.AddDays(-1));
        var statement = PayCalculator.Build(employee, periodStart, periodEnd, days, lines, previous?.DaysOffUnused ?? 0m);

        Payslip payslip;
        if (existing is null)
        {
            payslip = payslips.Add(new Payslip(employee.Id, branchId, periodStart, periodEnd, statement, by));
            // The Earned line carries the payslip's id in its reference
            await payslips.UnitOfWork.SaveEntitiesAsync();
        }
        else
        {
            payslip = existing;
            payslip.Regenerate(statement, by);
        }

        // Net of absence: the ledger line is what the period was worth
        if (statement.NetEarned > 0)
        {
            ledger.Add(new LedgerEntry(employee.Id, LedgerEntryType.Earned, statement.NetEarned, periodEnd,
                EarnedNote(employee, statement, periodStart, periodEnd), by,
                LedgerSource.Payslip, payslip.Reference));
        }

        await payslips.UnitOfWork.SaveEntitiesAsync();

        // Finance puts the period's wages beside the sales
        await integrationEvents.AddAndSaveEventAsync(new EmployeeEarningsChangedIntegrationEvent(
            branchId, employee.Id, periodStart, periodEnd, Math.Max(0, statement.NetEarned)));

        return payslip;
    }

    public async Task RefreshCurrentAsync(IEnumerable<Employee> employees, DateOnly date, string by)
    {
        var periodStart = new DateOnly(date.Year, date.Month, 1);
        var periodEnd = periodStart.AddMonths(1).AddDays(-1);

        foreach (var employee in employees)
        {
            // Nothing to say about a month the person was not employed in
            if (employee.DaysEmployed(periodStart, periodEnd) == 0 || employee.TermsOn(periodEnd) is null)
                continue;

            await GenerateAsync(employee, employee.BranchId, periodStart, periodEnd, by, throwIfPaid: false);
        }
    }

    /// <summary>
    /// The line's note shows its arithmetic in numbers alone, so it reads in
    /// either language: "22 × 120" for a daily worker, "18/30 × 4500" for a
    /// salary prorated to the days employed, the absence taken off after.
    /// </summary>
    public static string EarnedNote(Employee employee, PayStatement statement, DateOnly periodStart, DateOnly periodEnd)
    {
        var period = $"{periodStart:yyyy-MM-dd} – {periodEnd:yyyy-MM-dd}";

        if (statement.TermsChangedOn is not null)
            return period;

        string maths;
        if (statement.Scheme == PayScheme.Daily)
        {
            maths = $"{statement.DaysWorked + statement.PaidOffDays:0.#} × {statement.Rate:0.##}";
        }
        else
        {
            var periodDays = periodEnd.DayNumber - periodStart.DayNumber + 1;
            var employedDays = employee.DaysEmployed(periodStart, periodEnd);
            maths = employedDays < periodDays
                ? $"{employedDays}/{periodDays} × {statement.Rate:0.##}"
                : $"{statement.Rate:0.##}";
        }

        if (statement.OvertimePay > 0)
            maths += $" + {statement.OvertimeHours:0.#}h";

        if (statement.AbsenceDeduction > 0)
            maths += $" − {statement.AbsenceDeduction:0.##}";

        return $"{period} · {maths}";
    }
}
