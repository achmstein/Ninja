#nullable enable
using Ninja.Sales.Infrastructure.Idempotency;
namespace Ninja.Sales.API.Application.Commands;

/// <summary>
/// A cashier opens a ticket by hand — a counter sale of manual lines, or a
/// table bill started before any app order lands on it. Room tickets are
/// never opened this way; they follow their session.
/// </summary>
public record OpenTicketCommand(
    TicketType Type,
    int BranchId,
    // LEGACY(places): the old TableId/TableName from older tills — remove when every till and customer app is on /api/places and /api/stays.
    int? TableId,
    LocalizedText? TableName,
    string? Label,
    int? PlaceId = null,
    LocalizedText? PlaceName = null) : IRequest<int>;

public class OpenTicketCommandHandler(
    ITicketRepository ticketRepository,
    ILogger<OpenTicketCommandHandler> logger) : IRequestHandler<OpenTicketCommand, int>
{
    public async Task<int> Handle(OpenTicketCommand command, CancellationToken cancellationToken)
    {
        Ticket ticket;

        switch (command.Type)
        {
            case TicketType.Counter:
                ticket = Ticket.OpenForCounter(command.BranchId, command.Label);
                break;

            case TicketType.Table when command.PlaceId is int placeId || command.TableId is int:
                // Q7: one open ticket per table — reuse an existing one, by
                // the place or by the older table id
                var existing = command.PlaceId is int byPlace
                    ? await ticketRepository.FindOpenByPlaceAsync(byPlace, command.BranchId)
                    : null;
                // LEGACY(places): falls back to the old TableId — remove when every till and customer app is on /api/places and /api/stays.
                existing ??= command.TableId is int byTable
                    ? await ticketRepository.FindOpenByTableAsync(byTable, command.BranchId)
                    : null;
                if (existing is not null)
                    return existing.Id;

                ticket = Ticket.OpenForTable(command.TableId, command.TableName ?? command.PlaceName, command.BranchId, command.PlaceId);
                break;

            case TicketType.Table:
                throw new SalesDomainException("Opening a table ticket takes a table id.");

            default:
                throw new SalesDomainException("Only counter and table tickets can be opened by hand — room tickets follow their session.");
        }

        ticketRepository.Add(ticket);
        await ticketRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation("Opened {Type} ticket {TicketId} by hand", ticket.Type, ticket.Id);

        return ticket.Id;
    }
}


/// <summary>Idempotent wrapper for <see cref="OpenTicketCommand"/> keyed on the client's request id.</summary>
public class OpenTicketIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<OpenTicketCommand, int>> logger)
    : IdentifiedCommandHandler<OpenTicketCommand, int>(mediator, requestManager, logger)
{
    // The first attempt opened it; the till refetches the floor to find it
    protected override Task<int> CreateResultForDuplicateRequestAsync(OpenTicketCommand command, CancellationToken cancellationToken)
        => Task.FromResult(0);
}
