#nullable enable
namespace Chillax.Sales.API.Application.Commands;

/// <summary>
/// Delete an open ticket nothing ever landed on. Unlike a void there is no
/// reason to keep and no owner to fetch: the aggregate proves the ticket has
/// no history, and receipt numbers are their own sequence, so a gap in
/// ticket ids is not a gap in the books. The log line is the only trace.
/// </summary>
public record DiscardTicketCommand(int TicketId, string DiscardedBy) : IRequest<bool>;

public class DiscardTicketCommandHandler(
    ITicketRepository ticketRepository,
    ILogger<DiscardTicketCommandHandler> logger) : IRequestHandler<DiscardTicketCommand, bool>
{
    public async Task<bool> Handle(DiscardTicketCommand command, CancellationToken cancellationToken)
    {
        var ticket = await ticketRepository.GetAsync(command.TicketId)
            ?? throw new SalesDomainException($"Ticket {command.TicketId} does not exist.");

        ticket.Discard();
        ticketRepository.Remove(ticket);

        await ticketRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation(
            "Empty {Type} ticket {TicketId} discarded by {DiscardedBy}",
            ticket.Type, ticket.Id, command.DiscardedBy);

        return true;
    }
}
