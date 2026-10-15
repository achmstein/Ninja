using Ninja.EventBus.Events;

namespace Ninja.Payroll.API.Application.IntegrationEvents.Events;

/// <summary>
/// What one payslip's period cost in wages, as of the latest draft or the
/// paid payslip — labour cost, for Finance's profit and loss. Sent whenever
/// the payslip is (re)generated, and as zero when a draft is deleted; the
/// latest value for the payslip wins (Finance orders them by CreationDate).
/// </summary>
/// <param name="NetEarned">The pay net of absence, overtime included: what the Earned line says.</param>
/// <param name="PayslipId">The payslip the figure is for.</param>
/// <param name="LabourCost">
/// What the period cost the business: <see cref="NetEarned"/> plus the
/// period's bonuses, less its deductions (<see cref="Domain.Services.PayStatement.LabourCost"/>).
/// </param>
public record EmployeeEarningsChangedIntegrationEvent(
    int BranchId,
    int EmployeeId,
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    decimal NetEarned,
    int PayslipId = 0,
    decimal? LabourCost = null) : IntegrationEvent;
