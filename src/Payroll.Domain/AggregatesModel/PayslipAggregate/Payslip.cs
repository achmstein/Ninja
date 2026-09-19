#nullable enable
using Ninja.Payroll.Domain.AggregatesModel.EmployeeAggregate;
using Ninja.Payroll.Domain.Services;

namespace Ninja.Payroll.Domain.AggregatesModel.PayslipAggregate;

/// <summary>
/// A period's statement for one employee, frozen from the ledger and the
/// attendance when generated. A draft can be regenerated as attendance is
/// corrected, or dropped; once paid it never changes. The ledger stays the
/// truth: the payslip posts one Earned line under its reference and, when
/// paid, one Payment.
/// </summary>
public class Payslip : Entity, IAggregateRoot
{
    public int EmployeeId { get; private set; }

    public int BranchId { get; private set; }

    public DateOnly PeriodStart { get; private set; }

    public DateOnly PeriodEnd { get; private set; }

    /// <summary>The terms at the period's end.</summary>
    public PayScheme Scheme { get; private set; }

    public decimal Rate { get; private set; }

    /// <summary>When the pay changed inside the period, if it did: the days before were paid at the old terms.</summary>
    public DateOnly? TermsChangedOn { get; private set; }

    public decimal DaysWorked { get; private set; }

    /// <summary>Daily workers: agreed days off paid within the allowance.</summary>
    public decimal PaidOffDays { get; private set; }

    public decimal Earned { get; private set; }

    /// <summary>Hours worked past the shift over the period.</summary>
    public decimal OvertimeHours { get; private set; }

    /// <summary>What those hours pay, on top of <see cref="Earned"/>.</summary>
    public decimal OvertimePay { get; private set; }

    /// <summary>Monthly staff: absent days in the period, half days counting half.</summary>
    public decimal AbsentDays { get; private set; }

    /// <summary>What absence beyond the paid days off cost: salary ÷ 30 per day.</summary>
    public decimal AbsenceDeduction { get; private set; }

    /// <summary>Days off brought in from the month before, not taken there.</summary>
    public decimal DaysOffCarriedIn { get; private set; }

    /// <summary>The month's paid days off in all: the person's own plus what was carried in.</summary>
    public decimal DaysOffAllowance { get; private set; }

    /// <summary>The month's own days off not taken: next month's carry-in.</summary>
    public decimal DaysOffUnused { get; private set; }

    public decimal Bonuses { get; private set; }

    public decimal Deductions { get; private set; }

    public decimal Advances { get; private set; }

    /// <summary>Wages already paid out in the period, from the drawer or by hand.</summary>
    public decimal Payments { get; private set; }

    /// <summary>What was owed (or owing, if negative) coming into the period.</summary>
    public decimal CarriedOver { get; private set; }

    /// <summary>The whole balance after this period: what to hand over.</summary>
    public decimal AmountDue { get; private set; }

    public PayslipStatus Status { get; private set; }

    public decimal? PaidAmount { get; private set; }

    public DateTime? PaidAt { get; private set; }

    public string? PaidBy { get; private set; }

    public string? Note { get; private set; }

    public string GeneratedBy { get; private set; } = string.Empty;

    public DateTime GeneratedAt { get; private set; }

    protected Payslip() { }

    public Payslip(int employeeId, int branchId, DateOnly periodStart, DateOnly periodEnd, PayStatement statement, string generatedBy)
    {
        if (employeeId <= 0)
            throw new PayrollDomainException("A payslip needs the employee it is for.");

        if (periodEnd < periodStart)
            throw new PayrollDomainException("A pay period cannot end before it starts.");

        EmployeeId = employeeId;
        BranchId = branchId;
        PeriodStart = periodStart;
        PeriodEnd = periodEnd;
        Status = PayslipStatus.Draft;
        Apply(statement, generatedBy);
    }

    /// <summary>The ledger reference of this payslip's Earned line.</summary>
    public string Reference => ReferenceFor(Id);

    public static string ReferenceFor(int payslipId) => $"payslip:{payslipId}";

    public bool IsPaid => Status == PayslipStatus.Paid;

    /// <summary>A draft picks up corrected attendance or a new advance.</summary>
    public void Regenerate(PayStatement statement, string by)
    {
        if (IsPaid)
            throw new PayrollDomainException("A paid payslip is frozen; post a correction on the ledger instead.");

        Apply(statement, by);
    }

    private void Apply(PayStatement statement, string by)
    {
        Scheme = statement.Scheme;
        Rate = statement.Rate;
        TermsChangedOn = statement.TermsChangedOn;
        DaysWorked = statement.DaysWorked;
        PaidOffDays = statement.PaidOffDays;
        Earned = statement.Earned;
        OvertimeHours = statement.OvertimeHours;
        OvertimePay = statement.OvertimePay;
        AbsentDays = statement.AbsentDays;
        AbsenceDeduction = statement.AbsenceDeduction;
        DaysOffCarriedIn = statement.DaysOffCarriedIn;
        DaysOffAllowance = statement.DaysOffAllowance;
        DaysOffUnused = statement.DaysOffUnused;
        Bonuses = statement.Bonuses;
        Deductions = statement.Deductions;
        Advances = statement.Advances;
        Payments = statement.Payments;
        CarriedOver = statement.CarriedOver;
        AmountDue = statement.AmountDue;
        GeneratedBy = by;
        GeneratedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Mark it paid. <paramref name="amount"/> is what was handed over — the
    /// amount due unless the manager paid part of it or rounded; zero is
    /// allowed when nothing was due.
    /// </summary>
    public void Pay(decimal amount, string? note, string by)
    {
        if (IsPaid)
            throw new PayrollDomainException("This payslip is already paid.");

        if (amount < 0)
            throw new PayrollDomainException("A payment cannot be negative.");

        Status = PayslipStatus.Paid;
        PaidAmount = amount;
        PaidAt = DateTime.UtcNow;
        PaidBy = by;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
    }
}
