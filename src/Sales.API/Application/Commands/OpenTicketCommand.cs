#nullable enable
using Chillax.Sales.Infrastructure.Idempotency;
namespace Chillax.Sales.API.Application.Commands;

/// <summary>
/// A cashier opens a ticket by hand — a counter sale of manual lines, or a
/// table bill started before any app order lands on it. Room tickets are
/// never opened this way; they follow their session.
/// </summary>
public record OpenTicketCommand(
    TicketType Type,
    int BranchId,
    int? TableId,
    LocalizedText? TableName,
    string? Label) : IRequest<int>;

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

            case TicketType.Table when command.TableId is int tableId:
                // Q7: one open ticket per table — reuse an existing one
                var existing = await ticketRepository.FindOpenByTableAsync(tableId, command.BranchId);
                if (existing is not null)
                    return existing.Id;

                ticket = Ticket.OpenForTable(tableId, command.TableName, command.BranchId);
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
