using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// Money left the drawer for an employee: a daily worker's wage, or an
/// advance. Payroll posts it on the person's account, keyed on the shift
/// and movement so a redelivery never posts twice. The shift's opening
/// time is the business day the money belongs to — a wage handed over at
/// 02:00 is the evening shift's.
/// </summary>
public record CashPaidOutIntegrationEvent(
    int ShiftId,
    int MovementId,
    int BranchId,
    string Kind,
    int EmployeeId,
    string? EmployeeName,
    decimal Amount,
    string Reason,
    DateTime ShiftOpenedAt,
    DateTime PaidAt,
    string RecordedBy) : IntegrationEvent;
