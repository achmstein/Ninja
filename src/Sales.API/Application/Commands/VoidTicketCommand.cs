#nullable enable
namespace Chillax.Sales.API.Application.Commands;

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
            ticket.Id, ticket.GetTotal(), command.VoidedBy, command.Reason);

        return true;
    }
}
