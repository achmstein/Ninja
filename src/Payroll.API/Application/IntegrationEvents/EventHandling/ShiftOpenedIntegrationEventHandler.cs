#nullable enable
using Chillax.EventBus.Abstractions;
using Chillax.Payroll.API.Application.IntegrationEvents.Events;
using Chillax.Payroll.API.Application.Services;

namespace Chillax.Payroll.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// A cashier who opens the drawer is at work: their day is marked Present
/// unless the manager already marked it (a half day, say — the till never
/// overrides a person). Cashiers with no employee record, and shifts from
/// before Sales sent the user id, mark nobody. A day marked here changes
/// what the month is worth, so the month's draft is refreshed the same way
/// a manager's mark refreshes it (docs/payroll-plan.md D9).
/// </summary>
public class ShiftOpenedIntegrationEventHandler(
    IEmployeeRepository employees,
    IAttendanceRepository attendance,
    IPayslipGenerator generator,
    PayrollTransaction transaction,
    ILogger<ShiftOpenedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<ShiftOpenedIntegrationEvent>
{
    public Task Handle(ShiftOpenedIntegrationEvent @event)
        => transaction.RunAsync(nameof(ShiftOpenedIntegrationEvent), () => Mark(@event));

    private async Task Mark(ShiftOpenedIntegrationEvent @event)
    {
        if (string.IsNullOrWhiteSpace(@event.OpenedByUserId))
            return;

        var employee = await employees.FindByUserIdAsync(@event.OpenedByUserId);

        if (employee is null)
        {
            logger.LogInformation("Shift {ShiftId} opened by a login with no employee record - nobody marked", @event.ShiftId);
            return;
        }

        var day = BusinessDay.Of(@event.OpenedAt);

        if (!employee.EmployedOn(day))
            return;

        if (await attendance.GetAsync(employee.Id, day) is not null)
            return;

        attendance.Add(new AttendanceDay(employee.Id, day, @event.BranchId, AttendanceStatus.Present, $"shift:{@event.ShiftId}", "till"));
        await attendance.UnitOfWork.SaveEntitiesAsync();

        // The day's pay is earned now: the Earned line, the till picker's
        // balance and Finance's labour figure follow, not the next pay-out
        await generator.RefreshCurrentAsync([employee], day, "till");

        logger.LogInformation("{Employee} marked present on {Day} from shift {ShiftId}", employee.Name, day, @event.ShiftId);
    }
}
