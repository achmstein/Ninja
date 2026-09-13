#nullable enable
namespace Chillax.Payroll.API.Application.Queries;

public record PayTermsView(DateOnly EffectiveFrom, PayScheme Scheme, decimal Rate);

/// <summary>An employee as the register lists them: current terms and what they are owed.</summary>
public record EmployeeView(
    int Id,
    string Name,
    string? JobTitle,
    string? Phone,
    int BranchId,
    string? UserId,
    DateOnly StartedOn,
    DateOnly? EndedOn,
    bool IsActive,
    int PaidDaysOff,
    PayTermsView? CurrentTerms,
    decimal Balance,
    IReadOnlyList<PayTermsView> Terms);

public record AttendanceView(int EmployeeId, DateOnly Date, int BranchId, AttendanceStatus Status, decimal OvertimeHours, string? Note, string MarkedBy, DateTime MarkedAt);

public record LedgerEntryView(
    int Id,
    int EmployeeId,
    LedgerEntryType Type,
    decimal Amount,
    decimal Signed,
    DateOnly Date,
    string? Note,
    string? Reference,
    LedgerSource Source,
    string RecordedBy,
    DateTime RecordedAt);

public record LedgerView(int EmployeeId, decimal Balance, IReadOnlyList<LedgerEntryView> Entries);

public record PayslipView(
    int Id,
    int EmployeeId,
    string EmployeeName,
    int BranchId,
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
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
    decimal CarriedOver,
    decimal AmountDue,
    /// <summary>What the person is owed right now, every line counted: what paying this payslip would hand over.</summary>
    decimal Remaining,
    PayslipStatus Status,
    decimal? PaidAmount,
    DateTime? PaidAt,
    string? PaidBy,
    string? Note,
    string GeneratedBy,
    DateTime GeneratedAt);

/// <summary>An employee as the till picks them for a wage or an advance.</summary>
public record TillEmployeeView(int Id, string Name, string? JobTitle, PayScheme Scheme);
