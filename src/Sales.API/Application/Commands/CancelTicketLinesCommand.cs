#nullable enable
using Ninja.Sales.Infrastructure.Idempotency;
namespace Ninja.Sales.API.Application.Commands;

/// <summary>Cancel items of an open bill the kitchen already has.</summary>
/// <param name="StockDisposition">"Waste" (it was made) or "Restock" (it never was); null leaves it to Ordering.</param>
public record CancelTicketLinesCommand(
    int TicketId,
    IReadOnlyCollection<LineCancel> Lines,
    string Reason,
    string CancelledBy,
    string? StockDisposition = null) : IRequest<bool>;

public class CancelTicketLinesCommandHandler(
    ITicketRepository ticketRepository,
    Ninja.Sales.Domain.AggregatesModel.PartPaymentAggregate.IPartPaymentRepository partPayments,
    ILogger<CancelTicketLinesCommandHandler> logger) : IRequestHandler<CancelTicketLinesCommand, bool>
{
    public async Task<bool> Handle(CancelTicketLinesCommand command, CancellationToken cancellationToken)
    {
        var ticket = await ticketRepository.GetAsync(command.TicketId)
            ?? throw new SalesDomainException($"Ticket {command.TicketId} does not exist.");

        // What was paid for was paid for: its money goes back first, as for a move or a void
        var paid = Ninja.Sales.Domain.AggregatesModel.PartPaymentAggregate.PartPaid.Of(await partPayments.ListActiveForTicketAsync(ticket.Id));
        if (command.Lines.Any(l => paid.LineIds.Contains(l.LineId)))
            throw new SalesDomainException(PartPaymentRules.GiveBackFirst);

        ticket.CancelLines(command.Lines, command.Reason, command.CancelledBy, command.StockDisposition);

        if (paid.Amount > 0 && ticket.GetBill(await ticketRepository.GetPricingRulesAsync(ticket.BranchId)).Total < paid.Amount)
            throw new SalesDomainException($"That would leave the bill below what was already paid on it ({paid.Amount:0.00}).");

        await ticketRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogWarning(
            "Ticket {TicketId}: {Count} line(s) CANCELLED by {By}: {Reason}",
            ticket.Id, command.Lines.Count, command.CancelledBy, command.Reason);

        return true;
    }
}

/// <summary>Idempotent wrapper for <see cref="CancelTicketLinesCommand"/> keyed on the client's request id.</summary>
public class CancelTicketLinesIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<CancelTicketLinesCommand, bool>> logger)
    : IdentifiedCommandHandler<CancelTicketLinesCommand, bool>(mediator, requestManager, logger)
{
    protected override Task<bool> CreateResultForDuplicateRequestAsync(CancelTicketLinesCommand command, CancellationToken cancellationToken)
        => Task.FromResult(true);
}
