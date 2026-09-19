namespace Ninja.Payroll.UnitTests.Domain;

using Ninja.Payroll.Domain.AggregatesModel.AttendanceAggregate;
using Ninja.Payroll.Domain.AggregatesModel.EmployeeAggregate;
using Ninja.Payroll.Domain.AggregatesModel.LedgerAggregate;
using Ninja.Payroll.Domain.Exceptions;
using Ninja.Payroll.Domain.Services;

[TestClass]
public class PayCalculatorTest
{
    private static readonly DateOnly March1 = new(2026, 3, 1);
    private static readonly DateOnly March31 = new(2026, 3, 31);

    // A saved employee has an id; the calculator matches attendance and
    // ledger lines on it, so the test gives its transient one the id the
    // database would
    private static Employee Runner(PayScheme scheme, decimal rate, DateOnly? startedOn = null)
    {
        var employee = Employee.Hire("Ahmed", "Runner", null, 1, null, startedOn ?? new DateOnly(2026, 1, 1), scheme, rate);
        typeof(Employee).GetProperty(nameof(Employee.Id))!.SetValue(employee, 7);
        return employee;
    }

    private static AttendanceDay Day(Employee e, int day, AttendanceStatus status = AttendanceStatus.Present)
        => new(e.Id, new DateOnly(2026, 3, day), 1, status, null, "manager");

    [TestMethod]
    public void A_daily_worker_earns_days_worked_times_the_rate_and_a_half_day_is_half()
    {
        var ahmed = Runner(PayScheme.Daily, 150);

        var statement = PayCalculator.Build(ahmed, March1, March31,
            [Day(ahmed, 1), Day(ahmed, 2), Day(ahmed, 3, AttendanceStatus.HalfDay), Day(ahmed, 4, AttendanceStatus.Absent)],
            []);

        Assert.AreEqual(2.5m, statement.DaysWorked);
        Assert.AreEqual(375m, statement.Earned);
        Assert.AreEqual(375m, statement.AmountDue);
    }

    [TestMethod]
    public void Attendance_outside_the_period_does_not_count()
    {
        var ahmed = Runner(PayScheme.Daily, 100);
        var april = new AttendanceDay(ahmed.Id, new DateOnly(2026, 4, 1), 1, AttendanceStatus.Present, null, "manager");

        var statement = PayCalculator.Build(ahmed, March1, March31, [Day(ahmed, 10), april], []);

        Assert.AreEqual(1m, statement.DaysWorked);
    }

    [TestMethod]
    public void A_monthly_employee_gets_the_salary_whatever_the_attendance_prorated_only_by_employment()
    {
        var full = Runner(PayScheme.Monthly, 3100);
        Assert.AreEqual(3100m, PayCalculator.Build(full, March1, March31, [Day(full, 1)], []).Earned);

        // Started on the 16th: 16 of 31 days
        var joined = Runner(PayScheme.Monthly, 3100, new DateOnly(2026, 3, 16));
        Assert.AreEqual(1600m, PayCalculator.Build(joined, March1, March31, [], []).Earned);

        // Left on the 10th: 10 of 31 days
        var left = Runner(PayScheme.Monthly, 3100);
        left.Leave(new DateOnly(2026, 3, 10));
        Assert.AreEqual(1000m, PayCalculator.Build(left, March1, March31, [], []).Earned);
    }

    [TestMethod]
    public void Advances_in_the_period_come_off_and_everything_else_is_carried_over()
    {
        var ahmed = Runner(PayScheme.Daily, 100);
        var ledger = new List<LedgerEntry>
        {
            // February: earned 2000, paid 1900 — 100 still owed
            new(ahmed.Id, LedgerEntryType.Earned, 2000, new DateOnly(2026, 2, 28), null, "sys"),
            new(ahmed.Id, LedgerEntryType.Payment, 1900, new DateOnly(2026, 3, 2), null, "manager"),
            // March: an advance, a bonus, a deduction
            new(ahmed.Id, LedgerEntryType.Advance, 300, new DateOnly(2026, 3, 12), "سلفة", "manager"),
            new(ahmed.Id, LedgerEntryType.Bonus, 50, new DateOnly(2026, 3, 20), null, "manager"),
            new(ahmed.Id, LedgerEntryType.Deduction, 20, new DateOnly(2026, 3, 21), null, "manager"),
        };

        var statement = PayCalculator.Build(ahmed, March1, March31, [Day(ahmed, 1), Day(ahmed, 2)], ledger);

        Assert.AreEqual(200m, statement.Earned);
        Assert.AreEqual(300m, statement.Advances);
        Assert.AreEqual(50m, statement.Bonuses);
        Assert.AreEqual(20m, statement.Deductions);
        // The March 2 payment is this period's, not carried over
        Assert.AreEqual(1900m, statement.Payments);
        Assert.AreEqual(2000m, statement.CarriedOver);
        // 2000 + 200 + 50 − 20 − 300 − 1900
        Assert.AreEqual(30m, statement.AmountDue);
        // and it is exactly the ledger balance plus this period's earnings
        Assert.AreEqual(ledger.Sum(l => l.Signed) + statement.Earned, statement.AmountDue);
    }

    [TestMethod]
    public void A_daily_worker_paid_every_evening_from_the_till_ends_the_month_at_zero()
    {
        var ahmed = Runner(PayScheme.Daily, 150);
        var ledger = new List<LedgerEntry>();
        var days = new List<AttendanceDay>();

        // Three days: lunch money at noon, the rest in the evening
        for (var day = 1; day <= 3; day++)
        {
            days.Add(Day(ahmed, day));
            ledger.Add(new(ahmed.Id, LedgerEntryType.Advance, 50, new DateOnly(2026, 3, day), "أكل", "till", LedgerSource.TillPayOut, $"shift:{day}:movement:1"));
            ledger.Add(new(ahmed.Id, LedgerEntryType.Payment, 100, new DateOnly(2026, 3, day), "يومية", "till", LedgerSource.TillPayOut, $"shift:{day}:movement:2"));
        }

        var statement = PayCalculator.Build(ahmed, March1, March31, days, ledger);

        Assert.AreEqual(450m, statement.Earned);
        Assert.AreEqual(150m, statement.Advances);
        Assert.AreEqual(300m, statement.Payments);
        Assert.AreEqual(0m, statement.AmountDue);
    }

    [TestMethod]
    public void A_daily_workers_agreed_days_off_are_paid_within_the_allowance_and_absences_never()
    {
        var ahmed = Runner(PayScheme.Daily, 100);

        // 20 worked, 5 days off, 2 absences, allowance 4 → 24 paid days
        var marks = Enumerable.Range(1, 20).Select(d => Day(ahmed, d)).ToList();
        marks.AddRange(Enumerable.Range(21, 5).Select(d => Day(ahmed, d, AttendanceStatus.DayOff)));
        marks.AddRange(Enumerable.Range(26, 2).Select(d => Day(ahmed, d, AttendanceStatus.Absent)));

        var statement = PayCalculator.Build(ahmed, March1, March31, marks, []);

        Assert.AreEqual(20m, statement.DaysWorked);
        Assert.AreEqual(4m, statement.PaidOffDays);
        Assert.AreEqual(2400m, statement.Earned);
        Assert.AreEqual(0m, statement.AbsenceDeduction);

        // A monthly employee's day off takes from the allowance like an absence
        var mona = Runner(PayScheme.Monthly, 3000);
        var away = Enumerable.Range(1, 5).Select(d => Day(mona, d, AttendanceStatus.DayOff)).ToList();
        Assert.AreEqual(100m, PayCalculator.Build(mona, March1, March31, away, []).AbsenceDeduction);
    }

    [TestMethod]
    public void A_monthly_employee_loses_a_thirtieth_per_absence_beyond_the_paid_days_off()
    {
        var mona = Runner(PayScheme.Monthly, 3000);

        // Four absences: within the allowance, nothing comes off
        var four = Enumerable.Range(1, 4).Select(d => Day(mona, d, AttendanceStatus.Absent)).ToList();
        var within = PayCalculator.Build(mona, March1, March31, four, []);
        Assert.AreEqual(4m, within.AbsentDays);
        Assert.AreEqual(0m, within.AbsenceDeduction);
        Assert.AreEqual(3000m, within.AmountDue);

        // Six and a half: 2.5 beyond → 2.5 × 100
        var more = four.Concat([Day(mona, 5, AttendanceStatus.Absent), Day(mona, 6, AttendanceStatus.Absent), Day(mona, 7, AttendanceStatus.HalfDay)]).ToList();
        var beyond = PayCalculator.Build(mona, March1, March31, more, []);
        Assert.AreEqual(6.5m, beyond.AbsentDays);
        Assert.AreEqual(250m, beyond.AbsenceDeduction);
        Assert.AreEqual(2750m, beyond.NetEarned);
        Assert.AreEqual(2750m, beyond.AmountDue);

        // Marking a monthly employee present costs nothing
        Assert.AreEqual(0m, PayCalculator.Build(mona, March1, March31, [Day(mona, 1)], []).AbsenceDeduction);

        // A daily worker is simply not paid for the day: never a deduction
        var ahmed = Runner(PayScheme.Daily, 100);
        Assert.AreEqual(0m, PayCalculator.Build(ahmed, March1, March31, four, []).AbsenceDeduction);

        // An allowance of 31 switches it off
        var lenient = Employee.Hire("Sara", null, null, 1, null, new DateOnly(2026, 1, 1), PayScheme.Monthly, 3000, paidDaysOff: 31);
        typeof(Employee).GetProperty(nameof(Employee.Id))!.SetValue(lenient, 7);
        Assert.AreEqual(0m, PayCalculator.Build(lenient, March1, March31, more, []).AbsenceDeduction);
    }

    [TestMethod]
    public void Days_off_not_taken_carry_to_the_next_month_once_and_are_spent_first()
    {
        var ahmed = Runner(PayScheme.Daily, 100);

        // September: 2 of 4 days off taken → 2 carry
        var september = PayCalculator.Build(ahmed, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 30),
            [new(ahmed.Id, new DateOnly(2026, 9, 5), 1, AttendanceStatus.DayOff, null, "m"), new(ahmed.Id, new DateOnly(2026, 9, 6), 1, AttendanceStatus.DayOff, null, "m")], []);
        Assert.AreEqual(4m, september.DaysOffAllowance);
        Assert.AreEqual(2m, september.DaysOffUnused);

        // October: 4 + 2 = 6; 3 taken and paid, the carried-in ones spent first, so 3 of October's own remain
        var octoberOff = Enumerable.Range(1, 3).Select(d => new AttendanceDay(ahmed.Id, new DateOnly(2026, 10, d), 1, AttendanceStatus.DayOff, null, "m")).ToList();
        var october = PayCalculator.Build(ahmed, new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 31), octoberOff, [], september.DaysOffUnused);
        Assert.AreEqual(2m, october.DaysOffCarriedIn);
        Assert.AreEqual(6m, october.DaysOffAllowance);
        Assert.AreEqual(3m, october.PaidOffDays);
        Assert.AreEqual(300m, october.Earned);
        Assert.AreEqual(3m, october.DaysOffUnused);

        // Six taken: all paid, nothing left to carry
        var sixOff = Enumerable.Range(1, 6).Select(d => new AttendanceDay(ahmed.Id, new DateOnly(2026, 10, d), 1, AttendanceStatus.DayOff, null, "m")).ToList();
        var busy = PayCalculator.Build(ahmed, new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 31), sixOff, [], 2m);
        Assert.AreEqual(6m, busy.PaidOffDays);
        Assert.AreEqual(0m, busy.DaysOffUnused);

        // Never more than a month's own days carry, however many came in
        var idle = PayCalculator.Build(ahmed, new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 31), [], [], 4m);
        Assert.AreEqual(4m, idle.DaysOffUnused);
    }

    [TestMethod]
    public void A_change_of_pay_inside_the_period_pays_each_day_at_that_days_terms()
    {
        // A raise for a daily worker on March 1: February days at 100, March days at 120
        var ahmed = Runner(PayScheme.Daily, 100);
        ahmed.SetPayTerms(PayScheme.Daily, 120, new DateOnly(2026, 3, 1));

        var feb20 = new AttendanceDay(ahmed.Id, new DateOnly(2026, 2, 20), 1, AttendanceStatus.Present, null, "m");
        var mar5 = new AttendanceDay(ahmed.Id, new DateOnly(2026, 3, 5), 1, AttendanceStatus.Present, null, "m");
        var straddling = PayCalculator.Build(ahmed, new DateOnly(2026, 2, 15), new DateOnly(2026, 3, 15), [feb20, mar5], []);

        Assert.AreEqual(220m, straddling.Earned);
        Assert.AreEqual(120m, straddling.Rate);
        Assert.AreEqual(new DateOnly(2026, 3, 1), straddling.TermsChangedOn);
        Assert.IsNull(PayCalculator.Build(ahmed, March1, March31, [], []).TermsChangedOn);

        // Monthly 6000 until the 12th, then daily 120: 12/30 of the salary plus the days worked after
        var sara = Runner(PayScheme.Monthly, 6000, new DateOnly(2026, 9, 1));
        sara.SetPayTerms(PayScheme.Daily, 120, new DateOnly(2026, 9, 13));
        var worked = Enumerable.Range(13, 5).Select(d => new AttendanceDay(sara.Id, new DateOnly(2026, 9, d), 1, AttendanceStatus.Present, null, "m")).ToList();
        var september = PayCalculator.Build(sara, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 30), worked, []);

        Assert.AreEqual(2400m + 600m, september.Earned);
        Assert.AreEqual(5m, september.DaysWorked);
        Assert.AreEqual(PayScheme.Daily, september.Scheme);
        Assert.AreEqual(new DateOnly(2026, 9, 13), september.TermsChangedOn);
    }

    [TestMethod]
    public void Overtime_hours_pay_on_top_at_the_days_hourly_rate_and_a_half()
    {
        // 160 a day → 20 an hour → 30 an overtime hour
        var ahmed = Runner(PayScheme.Daily, 160);
        var late = new AttendanceDay(ahmed.Id, new DateOnly(2026, 3, 2), 1, AttendanceStatus.Present, null, "manager", overtimeHours: 2);

        var statement = PayCalculator.Build(ahmed, March1, March31, [Day(ahmed, 1), late], []);

        Assert.AreEqual(2m, statement.OvertimeHours);
        Assert.AreEqual(60m, statement.OvertimePay);
        Assert.AreEqual(320m, statement.Earned);
        Assert.AreEqual(380m, statement.NetEarned);

        // 4800 a month → 160 a day → 20 an hour → 30 an overtime hour
        var sara = Runner(PayScheme.Monthly, 4800);
        var salaried = PayCalculator.Build(sara, March1, March31,
            [new AttendanceDay(sara.Id, new DateOnly(2026, 3, 5), 1, AttendanceStatus.Present, null, "manager", overtimeHours: 1.5m)], []);
        Assert.AreEqual(45m, salaried.OvertimePay);
        Assert.AreEqual(4845m, salaried.AmountDue);

        // A status click without hours keeps them; a day away has none
        late.Mark(AttendanceStatus.HalfDay, null, "manager");
        Assert.AreEqual(2m, late.OvertimeHours);
        late.Mark(AttendanceStatus.Absent, null, "manager");
        Assert.AreEqual(0m, late.OvertimeHours);
        Assert.ThrowsExactly<PayrollDomainException>(() => late.Mark(AttendanceStatus.Present, null, "manager", 20));
    }

    [TestMethod]
    public void Same_day_terms_replace_and_an_employee_needs_a_name_and_positive_pay()
    {
        var ahmed = Runner(PayScheme.Daily, 100);
        ahmed.SetPayTerms(PayScheme.Daily, 110, new DateOnly(2026, 1, 1));

        Assert.AreEqual(1, ahmed.Terms.Count);
        Assert.AreEqual(110m, ahmed.TermsOn(new DateOnly(2026, 1, 1))!.Rate);
        Assert.IsNull(ahmed.TermsOn(new DateOnly(2025, 12, 31)));

        Assert.ThrowsExactly<PayrollDomainException>(() => Runner(PayScheme.Daily, 0));
        Assert.ThrowsExactly<PayrollDomainException>(() =>
            Employee.Hire(" ", null, null, 1, null, new DateOnly(2026, 1, 1), PayScheme.Daily, 100));
        Assert.ThrowsExactly<PayrollDomainException>(() => ahmed.Leave(new DateOnly(2025, 1, 1)));
    }
}

[TestClass]
public class BusinessDayTest
{
    [TestMethod]
    public void The_small_hours_belong_to_the_evening_before()
    {
        // 02:00 Cairo on the 14th (00:00 UTC in summer time) is still the 13th's shift
        Assert.AreEqual(new DateOnly(2026, 9, 13), BusinessDay.Of(new DateTime(2026, 9, 14, 0, 0, 0, DateTimeKind.Utc)));
        // 17:00 Cairo on the 13th is the 13th
        Assert.AreEqual(new DateOnly(2026, 9, 13), BusinessDay.Of(new DateTime(2026, 9, 13, 14, 0, 0, DateTimeKind.Utc)));
    }
}
