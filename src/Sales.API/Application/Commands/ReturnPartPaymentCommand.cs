#nullable enable
using Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate;
using Ninja.Sales.Domain.AggregatesModel.PartPaymentAggregate;
using Ninja.Sales.Domain.AggregatesModel.ShiftAggregate;
using Ninja.Sales.Infrastructure.Idempotency;

namespace Ninja.Sales.API.Application.Commands;

/// <summary>
/// Give a part payment back while its bill is still open: taken by mistake,
/// or the bill is to be voided. The bill owes it again, and cash leaves the
/// drawer of the shift open now, whichever shift took it.
/// </summary>
public record ReturnPartPaymentCommand(int TicketId, int PartPaymentId, string By, int? ShiftId = null) : IRequest<PartPaymentResult>;

public class ReturnPartPaymentCommandHandler(
    ITicketRepository tickets,
    IPartPaymentRepository partPayments,
    IOnlinePaymentRepository onlinePayments,
    IShiftRepository shifts,
    TimeProvider clock,
    ILogger<ReturnPartPaymentCommandHandler> logger) : IRequestHandler<ReturnPartPaymentCommand, PartPaymentResult>
{
    public async Task<PartPaymentResult> Handle(ReturnPartPaymentCommand command, CancellationToken cancellationToken)
    {
        // Held like a part payment being taken: a settle counting this one in waits, or is told to reload
        await onlinePayments.LockTicketAsync(command.TicketId);

        var ticket = await tickets.GetAsync(command.TicketId)
            ?? throw new SalesDomainException($"Ticket {command.TicketId} does not exist.");

        if (ticket.Status != TicketStatus.Open)
            throw new SalesDomainException("This bill is already closed: money goes back as a refund from its receipt.");

        var payment = await partPayments.GetAsync(command.PartPaymentId);
        if (payment is null || payment.TicketId != ticket.Id)
            throw new SalesDomainException("That part payment is not on this bill.");

        var now = clock.GetUtcNow().UtcDateTime;
        var shiftId = await ShiftAttribution.NowAsync(shifts, ticket.BranchId, command.ShiftId);

        payment.Return(command.By, shiftId, now);
        ticket.NotePartPayment();

        await partPayments.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogWarning(
            "Part payment {PartPaymentId} of {Amount} ({Tender}) on ticket {TicketId} given back by {By} (shift {ShiftId})",
            payment.Id, payment.Amount, payment.Tender, ticket.Id, command.By, shiftId);

        var standing = await PartPaymentRules.StandingAsync(ticket.Id, tickets, partPayments, onlinePayments, now);
        return standing with { PartPaymentIds = [payment.Id] };
    }
}

/// <summary>Idempotent wrapper for <see cref="ReturnPartPaymentCommand"/> keyed on the client's request id.</summary>
public class ReturnPartPaymentIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ITicketRepository tickets,
    IPartPaymentRepository partPayments,
    IOnlinePaymentRepository onlinePayments,
    TimeProvider clock,
    ILogger<IdentifiedCommandHandler<ReturnPartPaymentCommand, PartPaymentResult>> logger)
    : IdentifiedCommandHandler<ReturnPartPaymentCommand, PartPaymentResult>(mediator, requestManager, logger)
{
    // The first attempt gave it back; the bill says what stands now
    protected override Task<PartPaymentResult> CreateResultForDuplicateRequestAsync(ReturnPartPaymentCommand command, CancellationToken cancellationToken)
        => PartPaymentRules.StandingAsync(command.TicketId, tickets, partPayments, onlinePayments, clock.GetUtcNow().UtcDateTime);
}
