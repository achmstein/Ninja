#nullable enable
using Chillax.EventBus.Abstractions;
using Chillax.Sales.API.Application.IntegrationEvents.Events;

namespace Chillax.Sales.API.Application.Commands;

public record PaymentDto(PaymentTender Tender, decimal Amount);

public record SettleResult(int ReceiptNumber, decimal Change);

public record SettleTicketCommand(int TicketId, IReadOnlyCollection<PaymentDto> Payments, string SettledBy)
    : IRequest<SettleResult>;

public class SettleTicketCommandHandler(
    ITicketRepository ticketRepository,
    Chillax.Sales.Domain.AggregatesModel.ShiftAggregate.IShiftRepository shiftRepository,
    IEventBus eventBus,
    ILogger<SettleTicketCommandHandler> logger) : IRequestHandler<SettleTicketCommand, SettleResult>
{
    /// <summary>
    /// Two cashiers settling in the same instant race on the receipt number;
    /// the unique (branch, number) index rejects the loser, who just retries.
    /// </summary>
    private const int ReceiptNumberAttempts = 3;

    public async Task<SettleResult> Handle(SettleTicketCommand command, CancellationToken cancellationToken)
    {
        var ticket = await ticketRepository.GetAsync(command.TicketId)
            ?? throw new SalesDomainException($"Ticket {command.TicketId} does not exist.");

        var payments = command.Payments
            .Select(p => new Payment(p.Tender, p.Amount, command.SettledBy))
            .ToList();

        // Attribute the settle to the branch's open drawer, if one is open —
        // a missing shift never blocks a sale, it just goes unattributed
        var shift = await shiftRepository.FindOpenByBranchAsync(ticket.BranchId);

        var change = ticket.Settle(payments, command.SettledBy, shift?.Id);

        for (var attempt = 1; ; attempt++)
        {
            var number = await ticketRepository.GetLastReceiptNumberAsync(ticket.BranchId) + 1;
            var receipt = ticketRepository.AddReceipt(new Receipt(number, ticket.BranchId, ticket.Id));

            try
            {
                await ticketRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

                logger.LogInformation(
                    "Ticket {TicketId} settled by {SettledBy} - receipt {Branch}/{Number}, change {Change}",
                    ticket.Id, command.SettledBy, ticket.BranchId, number, change);

                await eventBus.PublishAsync(new TicketSettledIntegrationEvent(
                    ticket.Id,
                    ticket.BranchId,
                    number,
                    ticket.GetTotal(),
                    ticket.CustomerId,
                    ticket.CustomerName,
                    payments.Where(p => p.Tender == PaymentTender.Account).Sum(p => p.Amount),
                    command.SettledBy,
                    ticket.Lines.Where(l => l.Source == TicketLineSource.SessionTime).Sum(l => l.Total)));

                return new SettleResult(number, change);
            }
            catch (DbUpdateException) when (attempt < ReceiptNumberAttempts)
            {
                // The losing receipt must leave the change tracker or the
                // retry would try to insert it again alongside the new one
                ticketRepository.RemoveReceipt(receipt);
                logger.LogWarning("Receipt number {Number} for branch {Branch} was taken - retrying", number, ticket.BranchId);
            }
        }
    }
}
