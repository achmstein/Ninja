#nullable enable
using Chillax.EventBus.Abstractions;
using Chillax.Payroll.API.Application.IntegrationEvents.Events;
using Chillax.Payroll.API.Application.Services;

namespace Chillax.Payroll.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// Money the till handed to an employee lands on their account: a wage
/// as a Payment, an advance as an Advance, dated to the shift's business
/// day. Idempotent on the shift and movement (the bus delivers at least
/// once, and the ledger's reference index is the backstop). An employee
/// the register does not know is logged and skipped — the drawer already
/// has the money leaving; nothing here can put it back.
/// </summary>
public class CashPaidOutIntegrationEventHandler(
    IEmployeeRepository employees,
    ILedgerRepository ledger,
    IPayslipGenerator generator,
    PayrollTransaction transaction,
    ILogger<CashPaidOutIntegrationEventHandler> logger)
    : IIntegrationEventHandler<CashPaidOutIntegrationEvent>
{
    public static string ReferenceFor(int shiftId, int movementId) => $"shift:{shiftId}:movement:{movementId}";

    public Task Handle(CashPaidOutIntegrationEvent @event)
        => transaction.RunAsync(nameof(CashPaidOutIntegrationEvent), () => Post(@event));

    private async Task Post(CashPaidOutIntegrationEvent @event)
    {
        var reference = ReferenceFor(@event.ShiftId, @event.MovementId);

        if (await ledger.FindByReferenceAsync(reference) is not null)
        {
            logger.LogInformation("Pay-out {Reference} already on the ledger - redelivery ignored", reference);
            return;
        }

        var employee = await employees.GetAsync(@event.EmployeeId);

        if (employee is null)
        {
            logger.LogWarning("Pay-out {Reference} names employee {EmployeeId}, who is not on the register - skipped", reference, @event.EmployeeId);
            return;
        }

        var type = @event.Kind switch
        {
            "Advance" => LedgerEntryType.Advance,
            "Wage" => LedgerEntryType.Payment,
            _ => (LedgerEntryType?)null,
        };

        if (type is null)
        {
            logger.LogWarning("Pay-out {Reference} has kind {Kind}, which is not staff money - skipped", reference, @event.Kind);
            return;
        }

        ledger.Add(new LedgerEntry(
            employee.Id,
            type.Value,
            @event.Amount,
            BusinessDay.Of(@event.ShiftOpenedAt),
            @event.Reason,
            @event.RecordedBy,
            LedgerSource.TillPayOut,
            reference));

        await ledger.UnitOfWork.SaveEntitiesAsync();

        // The month's statement lists what was paid out
        await generator.RefreshCurrentAsync([employee], BusinessDay.Of(@event.ShiftOpenedAt), @event.RecordedBy);

        logger.LogInformation(
            "{Type} of {Amount} posted for {Employee} from shift {ShiftId}",
            type, @event.Amount, employee.Name, @event.ShiftId);
    }
}
