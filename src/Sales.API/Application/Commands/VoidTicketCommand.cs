#nullable enable
using Ninja.Sales.Infrastructure.Idempotency;
namespace Ninja.Sales.API.Application.Commands;

public record VoidTicketCommand(int TicketId, string Reason, string VoidedBy) : IRequest<bool>;

public class VoidTicketCommandHandler(
    ITicketRepository ticketRepository,
    ILogger<VoidTicketCommandHandler> logger) : IRequestHandler<VoidTicketCommand, bool>
{
    public async Task<bool> Handle(VoidTicketCommand command, CancellationToken cancellationToken)
    {
        var ticket = await ticketRepository.GetAsync(command.TicketId)
            ?? throw new SalesDomainException($"Ticket {command.TicketId} does not exist.");

        ticket.Void(command.Reason, command.VoidedBy);

        await ticketRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogWarning(
            "Ticket {TicketId} ({Total}) VOIDED by {VoidedBy}: {Reason}",
            ticket.Id, ticket.GetSubtotal(), command.VoidedBy, command.Reason);

        return true;
    }
}


/// <summary>Idempotent wrapper for <see cref="VoidTicketCommand"/> keyed on the client's request id.</summary>
public class VoidTicketIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<VoidTicketCommand, bool>> logger)
    : IdentifiedCommandHandler<VoidTicketCommand, bool>(mediator, requestManager, logger)
{
    protected override Task<bool> CreateResultForDuplicateRequestAsync(VoidTicketCommand command, CancellationToken cancellationToken)
        => Task.FromResult(true);
}
