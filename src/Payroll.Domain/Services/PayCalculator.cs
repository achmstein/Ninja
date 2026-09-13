#nullable enable
using Chillax.Payroll.Domain.AggregatesModel.AttendanceAggregate;
using Chillax.Payroll.Domain.AggregatesModel.EmployeeAggregate;
using Chillax.Payroll.Domain.AggregatesModel.LedgerAggregate;

namespace Chillax.Payroll.Domain.Services;

/// <summary>
/// What a payslip says, as numbers. <see cref="AmountDue"/> is the whole
/// balance after this period's earnings: what is owed before the period,
/// plus what the period earned net of absence, plus its bonuses, less its
/// deductions, the advances handed over and the wages already paid out — a
/// daily worker paid every evening from the drawer ends the month near
/// zero. <see cref="Scheme"/> and <see cref="Rate"/> are the terms at the
/// period's end; <see cref="TermsChangedOn"/> says when they changed inside
/// it, if they did.
/// </summary>
public record PayStatement(
    PayScheme Scheme,
    decimal Rate,
    DateOnly? TermsChangedOn,
    decimal DaysWorked,
    decimal PaidOffDays,
    decimal Earned,
    decimal OvertimeHours,
    decimal OvertimePay,
    decimal AbsentDays,
    decimal AbsenceDeduction,
    decimal DaysOffCarriedIn,
    decimal DaysOffAllowance,
    decimal DaysOffUnused,
    decimal Bonuses,
    decimal Deductions,
    decimal Advances,
    decimal Payments,
    decimal CarriedOver)
{
    /// <summary>What the period actually earned: the pay plus overtime, less what absence cost.</summary>
    public decimal NetEarned => Earned + OvertimePay - AbsenceDeduction;

    public decimal AmountDue => CarriedOver + NetEarned + Bonuses - Deductions - Advances - Payments;
}

/// <summary>
/// Turns attendance, pay terms and the ledger into a period's statement.
/// Pure, so it can be tested; the command hands it what it loaded.
///
/// Every day is paid at the terms in force that day, so a change of pay
/// inside the period simply splits it: the days before at the old pay, the
/// days after at the new. A daily worker earns the rate per day worked
/// (half for a half day) and for an agreed day off within the allowance; a
/// monthly employee earns the salary prorated by the days the terms
/// covered, less a thirtieth for each day away beyond the allowance. One
/// allowance serves the whole period, used up in date order: what was
/// carried in from the month before first, then the month's own days;
/// the month's own days not taken carry to the next month and expire
/// after it, so the balance never exceeds two months' worth. Overtime
/// hours are paid on top at the day's hourly rate (a day is
/// <see cref="HoursPerDay"/> hours; a monthly salary is thirty days) times
/// <see cref="OvertimeMultiplier"/>.
/// </summary>
public static class PayCalculator
{
    public const decimal HoursPerDay = 8m;

    public const decimal OvertimeMultiplier = 1.5m;

    /// <summary>What an hour of overtime pays under these terms.</summary>
    public static decimal OvertimeHourRate(PayTerms terms)
        => (terms.Scheme == PayScheme.Daily ? terms.Rate : terms.Rate / 30m) / HoursPerDay * OvertimeMultiplier;

    /// <param name="attendance">The employee's marked days; those outside the period are ignored.</param>
    /// <param name="ledger">Every line on the employee's ledger except this payslip's own Earned line.</param>
    /// <param name="daysOffCarriedIn">The previous month's days off not taken, if it had a payslip.</param>
    public static PayStatement Build(
        Employee employee,
        DateOnly periodStart,
        DateOnly periodEnd,
        IEnumerable<AttendanceDay> attendance,
        IEnumerable<LedgerEntry> ledger,
        decimal daysOffCarriedIn = 0m)
    {
        if (periodEnd < periodStart)
            throw new PayrollDomainException("A pay period cannot end before it starts.");

        var atEnd = employee.TermsOn(periodEnd)
            ?? throw new PayrollDomainException($"{employee.Name} has no pay terms for this period.");

        var segments = Segments(employee, periodStart, periodEnd);
        var periodDays = periodEnd.DayNumber - periodStart.DayNumber + 1;

        decimal earned = 0, daysWorked = 0, paidOffDays = 0, absentDays = 0, absenceDeduction = 0, overtimeHours = 0, overtimePay = 0;

        // A monthly salary covers its segment whether or not days were marked
        foreach (var segment in segments.Where(s => s.Terms.Scheme == PayScheme.Monthly))
            earned += Salary(employee, segment.Terms, segment.Start, segment.End, periodDays);

        // The marked days, oldest first, sharing one allowance of paid days off
        var carriedIn = Math.Max(0m, daysOffCarriedIn);
        var allowance = employee.PaidDaysOff + carriedIn;
        var allowanceLeft = allowance;

        var marked = attendance
            .Where(a => a.EmployeeId == employee.Id && a.Date >= periodStart && a.Date <= periodEnd)
            .OrderBy(a => a.Date);

        foreach (var day in marked)
        {
            var segment = segments.FirstOrDefault(s => day.Date >= s.Start && day.Date <= s.End);
            if (segment.Terms is null)
                continue;

            daysWorked += day.DaysWorked;

            if (day.OvertimeHours > 0)
            {
                overtimeHours += day.OvertimeHours;
                overtimePay += OvertimeHourRate(segment.Terms) * day.OvertimeHours;
            }

            if (segment.Terms.Scheme == PayScheme.Daily)
            {
                if (day.DaysWorked > 0)
                {
                    earned += segment.Terms.Rate * day.DaysWorked;
                }
                else if (day.IsDayOff && allowanceLeft >= 1)
                {
                    earned += segment.Terms.Rate;
                    allowanceLeft -= 1;
                    paidOffDays += 1;
                }
            }
            else
            {
                var away = day.DaysAbsent;
                if (away <= 0)
                    continue;

                absentDays += away;
                var covered = Math.Min(away, allowanceLeft);
                allowanceLeft -= covered;
                absenceDeduction += segment.Terms.Rate / 30m * (away - covered);
            }
        }

        var lines = ledger.Where(l => l.EmployeeId == employee.Id).ToList();
        var inPeriod = lines.Where(l => l.Date >= periodStart && l.Date <= periodEnd).ToList();

        var bonuses = inPeriod.Where(l => l.Type == LedgerEntryType.Bonus).Sum(l => l.Amount);
        var deductions = inPeriod.Where(l => l.Type == LedgerEntryType.Deduction).Sum(l => l.Amount);
        var advances = inPeriod.Where(l => l.Type == LedgerEntryType.Advance).Sum(l => l.Amount);
        var payments = inPeriod.Where(l => l.Type == LedgerEntryType.Payment).Sum(l => l.Amount);

        // Everything else on the ledger — earlier periods and what was paid
        // against them — is what was owed coming into this period
        var carriedOver = lines.Sum(l => l.Signed) - bonuses + deductions + advances + payments;

        var changedOn = segments.Count > 1 ? segments[1].Start : (DateOnly?)null;

        // Carried-in days are spent first; what is left of the month's own
        // days moves on, once
        var used = allowance - allowanceLeft;
        var unused = Math.Max(0m, employee.PaidDaysOff - Math.Max(0m, used - carriedIn));

        return new PayStatement(
            atEnd.Scheme, atEnd.Rate, changedOn,
            daysWorked, paidOffDays, Math.Round(earned, 2), overtimeHours, Math.Round(overtimePay, 2), absentDays, Math.Round(absenceDeduction, 2),
            carriedIn, allowance, unused,
            bonuses, deductions, advances, payments, carriedOver);
    }

    /// <summary>
    /// The period cut at every change of terms inside it, each piece with
    /// the terms in force from its first day. Days before any terms exist
    /// (before the hire) are left out.
    /// </summary>
    public static List<(DateOnly Start, DateOnly End, PayTerms Terms)> Segments(Employee employee, DateOnly periodStart, DateOnly periodEnd)
    {
        var starts = new List<DateOnly> { periodStart };
        starts.AddRange(employee.Terms
            .Select(t => t.EffectiveFrom)
            .Where(d => d > periodStart && d <= periodEnd)
            .Distinct()
            .OrderBy(d => d));

        var segments = new List<(DateOnly, DateOnly, PayTerms)>();

        for (var i = 0; i < starts.Count; i++)
        {
            var end = i + 1 < starts.Count ? starts[i + 1].AddDays(-1) : periodEnd;
            var terms = employee.TermsOn(starts[i]);
            if (terms is not null)
                segments.Add((starts[i], end, terms));
        }

        return segments;
    }

    /// <summary>
    /// A monthly salary for the part of the period these terms covered,
    /// prorated by the days the person was employed for out of the period's
    /// days (someone who started on the 16th gets half) — never by
    /// attendance; absence comes off separately.
    /// </summary>
    public static decimal Salary(Employee employee, PayTerms terms, DateOnly from, DateOnly to, int periodDays)
    {
        var employedDays = employee.DaysEmployed(from, to);

        if (employedDays >= periodDays)
            return terms.Rate;

        return terms.Rate * employedDays / periodDays;
    }
}
