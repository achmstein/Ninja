#nullable enable
using Chillax.Sales.API.Application.IntegrationEvents.Events;
using Chillax.Sales.Domain.Events;

namespace Chillax.Sales.API.Application.DomainEventHandlers;

/// <summary>
/// A staff pay-out rides the outbox with the movement that recorded it, so
/// Payroll hears of it only once the drawer row is committed.
/// </summary>
public class CashPaidOutToStaffDomainEventHandler(
    ISalesIntegrationEventService integrationEvents,
    ILogger<CashPaidOutToStaffDomainEventHandler> logger) : INotificationHandler<CashPaidOutToStaffDomainEvent>
{
    public async Task Handle(CashPaidOutToStaffDomainEvent notification, CancellationToken cancellationToken)
    {
        var (shift, movement) = notification;

        logger.LogInformation(
            "{Kind} of {Amount} to employee {EmployeeId} on shift {ShiftId} - queueing for Payroll",
            movement.Kind, movement.Amount, movement.EmployeeId, shift.Id);

        await integrationEvents.AddAndSaveEventAsync(new CashPaidOutIntegrationEvent(
            shift.Id,
            movement.Id,
            shift.BranchId,
            movement.Kind.ToString(),
            movement.EmployeeId!.Value,
            movement.EmployeeName,
            movement.Amount,
            movement.Reason,
            shift.OpenedAt,
            movement.RecordedAt,
            movement.RecordedBy));
    }
}
