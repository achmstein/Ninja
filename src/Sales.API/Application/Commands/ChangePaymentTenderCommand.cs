#nullable enable
using Ninja.Sales.Domain.AggregatesModel.ShiftAggregate;
using Ninja.Sales.Infrastructure.Idempotency;
namespace Ninja.Sales.API.Application.Commands;

/// <summary>Put right how a paid bill's payment was taken (Cash pressed, InstaPay sent).</summary>
public record ChangePaymentTenderCommand(int TicketId, int PaymentId, PaymentTender Tender, string ChangedBy) : IRequest<bool>;

/// <summary>
/// Changes one payment's method while the bill's shift is still open: the
/// drawer count is then still to be done and comes out right. Once the shift
/// is closed its count is final and the change is refused, as it is on a bill
/// with a refund (the refund was paid back by the method it had).
/// </summary>
public class ChangePaymentTenderCommandHandler(
    ITicketRepository tickets,
    IShiftRepository shifts,
    ILogger<ChangePaymentTenderCommandHandler> logger) : IRequestHandler<ChangePaymentTenderCommand, bool>
{
    public async Task<bool> Handle(ChangePaymentTenderCommand command, CancellationToken cancellationToken)
    {
        var ticket = await tickets.GetAsync(command.TicketId)
            ?? throw new SalesDomainException($"Bill {command.TicketId} does not exist.");

        if (ticket.ShiftId is int shiftId && await shifts.GetAsync(shiftId) is { Status: not ShiftStatus.Open })
            throw new SalesDomainException("That bill's shift is closed and its drawer counted, so its payment method can't be changed.");

        if ((await tickets.GetRefundsForTicketAsync(ticket.Id)).Count > 0)
            throw new SalesDomainException("That bill has a refund, so its payment method can't be changed.");

        var before = ticket.Payments.FirstOrDefault(p => p.Id == command.PaymentId)?.Tender;
        ticket.CorrectPaymentTender(command.PaymentId, command.Tender, command.ChangedBy);
        await tickets.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogWarning(
            "Bill {TicketId} payment {PaymentId} changed from {From} to {To} by {By}",
            ticket.Id, command.PaymentId, before, command.Tender, command.ChangedBy);
        return true;
    }
}

/// <summary>Idempotent wrapper for <see cref="ChangePaymentTenderCommand"/> keyed on the client's request id.</summary>
public class ChangePaymentTenderIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<ChangePaymentTenderCommand, bool>> logger)
    : IdentifiedCommandHandler<ChangePaymentTenderCommand, bool>(mediator, requestManager, logger)
{
    protected override Task<bool> CreateResultForDuplicateRequestAsync(ChangePaymentTenderCommand command, CancellationToken cancellationToken)
        => Task.FromResult(true);
}
