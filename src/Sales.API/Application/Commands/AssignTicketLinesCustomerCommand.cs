#nullable enable
namespace Chillax.Sales.API.Application.Commands;

/// <summary>
/// Name the customer on a chosen set of lines. Sales-only: it is the snapshot
/// that groups the bill and drives the receipt and an Account tender. The
/// order, and the points it earned, stay with whoever placed it — a whole
/// order changing hands is Ordering's call (assign the order's customer).
/// </summary>
public record AssignTicketLinesCustomerCommand(
    int TicketId,
    IReadOnlyCollection<int> LineIds,
    string? CustomerId,
    string CustomerName) : IRequest<bool>;

public class AssignTicketLinesCustomerCommandHandler(
    ITicketRepository ticketRepository,
    ILogger<AssignTicketLinesCustomerCommandHandler> logger) : IRequestHandler<AssignTicketLinesCustomerCommand, bool>
{
    public async Task<bool> Handle(AssignTicketLinesCustomerCommand command, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(command.CustomerName))
            throw new SalesDomainException("A customer needs a name.");

        var ticket = await ticketRepository.GetAsync(command.TicketId)
            ?? throw new SalesDomainException($"Ticket {command.TicketId} does not exist.");

        ticket.AssignLinesCustomer(command.LineIds, command.CustomerId, command.CustomerName);

        await ticketRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation(
            "Named {Customer} on {Count} line(s) of ticket {TicketId}",
            command.CustomerName, command.LineIds.Count, ticket.Id);

        return true;
    }
}
