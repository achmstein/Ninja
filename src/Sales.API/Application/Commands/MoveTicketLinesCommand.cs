#nullable enable
using Ninja.Sales.Infrastructure.Idempotency;
namespace Ninja.Sales.API.Application.Commands;

/// <summary>A ticket to open for the moved lines: a fresh counter tab, or a table's bill.</summary>
public record NewTicketTarget(TicketType Type, string? Label, int? PlaceId = null, LocalizedText? PlaceName = null);

/// <summary>
/// Move lines off a ticket. Three destinations: none given is the turnover
/// guard — a fresh ticket for the same place; an existing open ticket takes
/// the lines onto its bill; a new ticket target opens a counter tab, or a
/// table's bill (its open one if it has one), and moves the lines in one
/// step — the customer who ordered at a table and then went to the counter,
/// or to another table.
/// </summary>
public record MoveTicketLinesCommand(
    int TicketId,
    IReadOnlyCollection<int> LineIds,
    int? TargetTicketId = null,
    NewTicketTarget? NewTicket = null) : IRequest<int>;

public class MoveTicketLinesCommandHandler(
    ITicketRepository ticketRepository,
    ILogger<MoveTicketLinesCommandHandler> logger) : IRequestHandler<MoveTicketLinesCommand, int>
{
    public async Task<int> Handle(MoveTicketLinesCommand command, CancellationToken cancellationToken)
    {
        var ticket = await ticketRepository.GetAsync(command.TicketId)
            ?? throw new SalesDomainException($"Ticket {command.TicketId} does not exist.");

        if (command.TargetTicketId is null && command.NewTicket is null)
        {
            var fresh = ticket.MoveLines(command.LineIds);
            ticketRepository.Add(fresh);

            await ticketRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

            logger.LogInformation(
                "Moved {Count} lines from ticket {From} to new ticket {To} for the same place",
                command.LineIds.Count, ticket.Id, fresh.Id);

            return fresh.Id;
        }

        var target = command.TargetTicketId is int targetId
            ? await ExistingAsync(ticket, targetId)
            : await OpenAsync(ticket, command.NewTicket!);

        ticket.MoveLinesTo(target, command.LineIds);

        // Emptied, a table or counter bill has nothing left to be: its lines
        // live on with their order ids on the target, so it goes the way an
        // untouched empty ticket does. A room ticket stays for its session.
        var emptied = ticket.Lines.Count == 0 && !ticket.HasSession;
        if (emptied)
        {
            ticket.Discard();
            ticketRepository.Remove(ticket);
        }

        await ticketRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation(
            "Moved {Count} lines from ticket {From} to {Type} ticket {To}{Discarded}",
            command.LineIds.Count, ticket.Id, target.Type, target.Id, emptied ? " (source discarded)" : "");

        return target.Id;
    }

    private async Task<Ticket> ExistingAsync(Ticket source, int targetId)
    {
        if (targetId == source.Id)
            throw new SalesDomainException("A ticket cannot receive its own lines.");

        return await ticketRepository.GetAsync(targetId)
            ?? throw new SalesDomainException($"Ticket {targetId} does not exist.");
    }

    private async Task<Ticket> OpenAsync(Ticket source, NewTicketTarget wanted)
    {
        switch (wanted.Type)
        {
            case TicketType.Counter:
                return ticketRepository.Add(Ticket.OpenForCounter(source.BranchId, wanted.Label));

            case TicketType.Table when wanted.PlaceId is int placeId:
                // Q7: one open ticket per table — a table that already has a
                // bill takes the lines onto it rather than growing a second
                var open = await ticketRepository.FindOpenByPlaceAsync(placeId, source.BranchId);
                return open ?? ticketRepository.Add(Ticket.OpenForTable(placeId, wanted.PlaceName, source.BranchId));

            case TicketType.Table:
                throw new SalesDomainException("Moving to a table takes the table's place.");

            default:
                throw new SalesDomainException("Room tickets follow their sessions — move onto the room's open bill instead.");
        }
    }
}


/// <summary>Idempotent wrapper for <see cref="MoveTicketLinesCommand"/> keyed on the client's request id.</summary>
public class MoveTicketLinesIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<MoveTicketLinesCommand, int>> logger)
    : IdentifiedCommandHandler<MoveTicketLinesCommand, int>(mediator, requestManager, logger)
{
    // The lines already moved; the till refetches the floor to find where
    protected override Task<int> CreateResultForDuplicateRequestAsync(MoveTicketLinesCommand command, CancellationToken cancellationToken)
        => Task.FromResult(0);
}
