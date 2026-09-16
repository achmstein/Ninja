namespace Chillax.Ordering.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// A credit note went out against a settled bill: each order it reversed
/// keeps a running refunded amount, so the customer's list can say
/// "Refunded" beside "Paid".
/// </summary>
public class TicketRefundedIntegrationEventHandler(
    IMediator mediator,
    ILogger<TicketRefundedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<TicketRefundedIntegrationEvent>
{
    public async Task Handle(TicketRefundedIntegrationEvent @event)
    {
        var reversals = @event.OrderReversals ?? [];
        if (reversals.Count == 0)
        {
            return;
        }
        logger.LogInformation("Credit note #{Number} on receipt #{Receipt} - recording refunds on {Count} order(s)",
            @event.Number, @event.ReceiptNumber, reversals.Count);
        await mediator.Send(new RecordOrderRefundsCommand(
            reversals.Select(r => new OrderRefund(r.OrderId, r.RefundedAmount)).ToList()));
    }
}
