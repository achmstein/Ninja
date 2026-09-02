#nullable enable
namespace Chillax.Sales.API.Application.Commands;

public record AddManualLineCommand(
    int TicketId,
    LocalizedText Description,
    decimal Qty,
    decimal UnitPrice,
    decimal Discount,
    string AddedBy) : IRequest<bool>;

public class AddManualLineCommandHandler(
    ITicketRepository ticketRepository,
    ILogger<AddManualLineCommandHandler> logger) : IRequestHandler<AddManualLineCommand, bool>
{
    public async Task<bool> Handle(AddManualLineCommand command, CancellationToken cancellationToken)
    {
        var ticket = await ticketRepository.GetAsync(command.TicketId)
            ?? throw new SalesDomainException($"Ticket {command.TicketId} does not exist.");

        ticket.AddManualLine(command.Description, command.Qty, command.UnitPrice, command.Discount, command.AddedBy);

        await ticketRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation("Manual line added to ticket {TicketId} by {AddedBy}", ticket.Id, command.AddedBy);

        return true;
    }
}
