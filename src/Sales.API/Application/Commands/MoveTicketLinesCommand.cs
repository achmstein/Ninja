#nullable enable
namespace Chillax.Sales.API.Application.Commands;

/// <summary>
/// The turnover guard: lines that landed on the previous group's bill move to
/// a fresh open ticket for the same place.
/// </summary>
public record MoveTicketLinesCommand(int TicketId, IReadOnlyCollection<int> LineIds) : IRequest<int>;

public class MoveTicketLinesCommandHandler(
    ITicketRepository ticketRepository,
    ILogger<MoveTicketLinesCommandHandler> logger) : IRequestHandler<MoveTicketLinesCommand, int>
{
    public async Task<int> Handle(MoveTicketLinesCommand command, CancellationToken cancellationToken)
    {
        var ticket = await ticketRepository.GetAsync(command.TicketId)
            ?? throw new SalesDomainException($"Ticket {command.TicketId} does not exist.");

        var target = ticket.MoveLines(command.LineIds);
        ticketRepository.Add(target);

        await ticketRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation(
            "Moved {Count} lines from ticket {From} to new ticket {To}",
            command.LineIds.Count, ticket.Id, target.Id);

        return target.Id;
    }
}
