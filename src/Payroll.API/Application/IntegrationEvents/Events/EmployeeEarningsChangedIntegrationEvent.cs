using Chillax.EventBus.Events;

namespace Chillax.Payroll.API.Application.IntegrationEvents.Events;

/// <summary>
/// What a period cost in wages for one employee, net of absence, as of
/// the latest draft or the paid payslip — labour cost, for Finance's
/// profit and loss. Sent whenever the payslip is (re)generated, and as
/// zero when a draft is deleted; the latest value for (employee, period)
/// wins.
/// </summary>
public record EmployeeEarningsChangedIntegrationEvent(
    int BranchId,
    int EmployeeId,
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    decimal NetEarned) : IntegrationEvent;
