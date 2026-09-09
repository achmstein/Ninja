#nullable enable
using Chillax.Sales.Infrastructure.Idempotency;
using Chillax.Sales.API.Application.IntegrationEvents.Events;
using Chillax.Sales.Domain.AggregatesModel.ShiftAggregate;
using Chillax.Sales.Domain.AggregatesModel.TabPaymentAggregate;

namespace Chillax.Sales.API.Application.Commands;

public record TabPaymentResult(int Id, int Number);

/// <summary>
/// Take money against a customer's tab at the till. Its own numbered slip,
/// stamped with the branch's open shift so the drawer and the Z report stay
/// honest; Accounts lowers the balance owed off the recorded event.
/// </summary>
public record RecordTabPaymentCommand(
    int BranchId,
    string CustomerId,
    string? CustomerName,
    PaymentTender Tender,
    decimal Amount,
    string RecordedBy) : IRequest<TabPaymentResult>;

public class RecordTabPaymentCommandHandler(
    ITabPaymentRepository tabPayments,
    IShiftRepository shiftRepository,
    ISalesIntegrationEventService integrationEvents,
    ILogger<RecordTabPaymentCommandHandler> logger) : IRequestHandler<RecordTabPaymentCommand, TabPaymentResult>
{
    /// <summary>Same numbering race as receipts, settled the same way.</summary>
    private const int NumberAttempts = 3;

    public async Task<TabPaymentResult> Handle(RecordTabPaymentCommand command, CancellationToken cancellationToken)
    {
        // Whatever the tender, the slip belongs to the shift on duty: cash
        // raises the drawer expectation, card and InstaPay reconcile against
        // the terminal. No shift open — the slip goes unattributed.
        var shift = await shiftRepository.FindOpenByBranchAsync(command.BranchId);

        for (var attempt = 1; ; attempt++)
        {
            var number = await tabPayments.GetLastNumberAsync(command.BranchId) + 1;

            var payment = TabPayment.Record(
                number,
                command.BranchId,
                command.CustomerId,
                command.CustomerName,
                command.Tender,
                command.Amount,
                command.RecordedBy,
                shift?.Id);

            tabPayments.Add(payment);

            try
            {
                await tabPayments.UnitOfWork.SaveEntitiesAsync(cancellationToken);

                logger.LogInformation(
                    "Tab payment #{Number} of {Amount} via {Tender} taken from {CustomerId} by {RecordedBy} (shift {ShiftId})",
                    payment.Number, payment.Amount, payment.Tender, payment.CustomerId, command.RecordedBy, shift?.Id);

                await integrationEvents.AddAndSaveEventAsync(new TabPaymentRecordedIntegrationEvent(
                    payment.Id,
                    payment.Number,
                    payment.BranchId,
                    payment.CustomerId,
                    payment.CustomerName,
                    payment.Tender.ToString(),
                    payment.Amount,
                    payment.RecordedBy,
                    payment.RecordedAt));

                return new TabPaymentResult(payment.Id, payment.Number);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw;
            }
            catch (DbUpdateException) when (attempt < NumberAttempts)
            {
                tabPayments.Remove(payment);
            }
        }
    }
}


/// <summary>Idempotent wrapper for <see cref="RecordTabPaymentCommand"/> keyed on the client's request id.</summary>
public class RecordTabPaymentIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<RecordTabPaymentCommand, TabPaymentResult>> logger)
    : IdentifiedCommandHandler<RecordTabPaymentCommand, TabPaymentResult>(mediator, requestManager, logger)
{
    // The slip was issued by the first attempt; the till re-reads its list
    protected override Task<TabPaymentResult> CreateResultForDuplicateRequestAsync(RecordTabPaymentCommand command, CancellationToken cancellationToken)
        => Task.FromResult(new TabPaymentResult(0, 0));
}
