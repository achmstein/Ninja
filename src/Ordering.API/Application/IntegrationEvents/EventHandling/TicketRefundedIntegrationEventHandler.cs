namespace Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;

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
        // Under the event's own id: the amounts add up, so a redelivery must
        // be recognised, not re-applied
        await mediator.Send(new IdentifiedCommand<RecordOrderRefundsCommand, bool>(
            new RecordOrderRefundsCommand(
                reversals.Select(r => new OrderRefund(r.OrderId, r.RefundedAmount)).ToList()),
            @event.Id));
    }
}
