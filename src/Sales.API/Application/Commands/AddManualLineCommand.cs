#nullable enable
using Chillax.Sales.Infrastructure.Idempotency;
namespace Chillax.Sales.API.Application.Commands;

public record AddManualLineCommand(
    int TicketId,
    LocalizedText Description,
    decimal Qty,
    decimal UnitPrice,
    decimal Discount,
    string AddedBy,
    string? CustomerName = null) : IRequest<bool>;

public class AddManualLineCommandHandler(
    ITicketRepository ticketRepository,
    ILogger<AddManualLineCommandHandler> logger) : IRequestHandler<AddManualLineCommand, bool>
{
    public async Task<bool> Handle(AddManualLineCommand command, CancellationToken cancellationToken)
    {
        var ticket = await ticketRepository.GetAsync(command.TicketId)
            ?? throw new SalesDomainException($"Ticket {command.TicketId} does not exist.");

        ticket.AddManualLine(command.Description, command.Qty, command.UnitPrice, command.Discount, command.AddedBy, command.CustomerName);

        await ticketRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation("Manual line added to ticket {TicketId} by {AddedBy}", ticket.Id, command.AddedBy);

        return true;
    }
}


/// <summary>Idempotent wrapper for <see cref="AddManualLineCommand"/> keyed on the client's request id.</summary>
public class AddManualLineIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<AddManualLineCommand, bool>> logger)
    : IdentifiedCommandHandler<AddManualLineCommand, bool>(mediator, requestManager, logger)
{
    protected override Task<bool> CreateResultForDuplicateRequestAsync(AddManualLineCommand command, CancellationToken cancellationToken)
        => Task.FromResult(true);
}
