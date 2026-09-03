#nullable enable
using Chillax.Sales.API.Application.IntegrationEvents.Events;

namespace Chillax.Sales.API.Application.Commands;

public record RefundLineDto(int LineId, decimal Qty);

public record RefundResult(int Number, decimal Amount);

/// <summary>
/// Issue a credit note against a settled ticket. Owner-gated at the API.
/// The ticket never changes; the refund is its own numbered document.
/// </summary>
public record RefundTicketCommand(
    int TicketId,
    IReadOnlyCollection<RefundLineDto> Lines,
    string Reason,
    PaymentTender Tender,
    string? CustomerId,
    string? CustomerName,
    string RefundedBy) : IRequest<RefundResult>;

public class RefundTicketCommandHandler(
    ITicketRepository ticketRepository,
    Chillax.Sales.Domain.AggregatesModel.ShiftAggregate.IShiftRepository shiftRepository,
    ISalesIntegrationEventService integrationEvents,
    ILogger<RefundTicketCommandHandler> logger) : IRequestHandler<RefundTicketCommand, RefundResult>
{
    /// <summary>Same numbering race as receipts, settled the same way.</summary>
    private const int NumberAttempts = 3;

    public async Task<RefundResult> Handle(RefundTicketCommand command, CancellationToken cancellationToken)
    {
        var ticket = await ticketRepository.GetAsync(command.TicketId)
            ?? throw new SalesDomainException($"Ticket {command.TicketId} does not exist.");

        var receipt = await ticketRepository.FindReceiptByTicketAsync(ticket.Id)
            ?? throw new SalesDomainException($"Ticket {command.TicketId} has no receipt to credit.");

        var earlier = await ticketRepository.GetRefundsForTicketAsync(ticket.Id);

        // A cash refund comes out of the open drawer, if one is open; the Z
        // report subtracts it. An account credit touches no cash.
        var shift = command.Tender == PaymentTender.Cash
            ? await shiftRepository.FindOpenByBranchAsync(ticket.BranchId)
            : null;

        var requested = command.Lines.Select(l => new RefundRequestLine(l.LineId, l.Qty)).ToList();

        for (var attempt = 1; ; attempt++)
        {
            var number = await ticketRepository.GetLastRefundNumberAsync(ticket.BranchId) + 1;

            var refund = Refund.Issue(
                number,
                ticket,
                receipt.Number,
                earlier,
                requested,
                command.Reason,
                command.Tender,
                command.CustomerId,
                command.CustomerName,
                command.RefundedBy,
                shift?.Id);

            ticketRepository.AddRefund(refund);

            try
            {
                await ticketRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

                logger.LogWarning(
                    "Ticket {TicketId} (receipt #{Receipt}) refunded {Amount} as credit note #{Number} by {RefundedBy} via {Tender}: {Reason}",
                    ticket.Id, receipt.Number, refund.Amount, refund.Number, command.RefundedBy, refund.Tender, refund.Reason);

                // Money the ticket's orders earned points on goes back in
                // proportion; the order's full menu value on this ticket is
                // the denominator Loyalty divides by — the figure a void
                // reverses outright
                var amountByOrder = ticket.GetAmountByOrder();
                var reversals = refund.RefundedByOrder()
                    .Select(r => new RefundOrderReversal(
                        r.OrderId,
                        r.RefundedAmount,
                        amountByOrder.GetValueOrDefault(r.OrderId)))
                    .ToList();

                await integrationEvents.AddAndSaveEventAsync(new TicketRefundedIntegrationEvent(
                    refund.Id,
                    refund.Number,
                    ticket.Id,
                    ticket.BranchId,
                    receipt.Number,
                    refund.Amount,
                    refund.Tender.ToString(),
                    refund.CustomerId,
                    refund.CustomerName,
                    refund.Reason,
                    refund.RefundedBy,
                    reversals));

                return new RefundResult(refund.Number, refund.Amount);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw;
            }
            catch (DbUpdateException) when (attempt < NumberAttempts)
            {
                ticketRepository.RemoveRefund(refund);
            }
        }
    }
}
