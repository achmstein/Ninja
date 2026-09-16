namespace Chillax.Ordering.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// The till paid a bill: every order on it learns its receipt number and
/// tender, which is what the customer's order list shows as "Paid". Runs
/// through a command so the write has a transaction (see
/// OrderStockConfirmedIntegrationEventHandler). Idempotent: the aggregate
/// ignores a receipt it already carries, so a redelivered event is harmless.
/// </summary>
public class TicketSettledIntegrationEventHandler(
    IMediator mediator,
    ILogger<TicketSettledIntegrationEventHandler> logger)
    : IIntegrationEventHandler<TicketSettledIntegrationEvent>
{
    public async Task Handle(TicketSettledIntegrationEvent @event)
    {
        var orderIds = @event.OrderIds ?? [];
        if (orderIds.Count == 0)
        {
            return;
        }
        logger.LogInformation("Ticket {TicketId} settled (receipt #{Receipt}) - marking {Count} order(s) paid",
            @event.TicketId, @event.ReceiptNumber, orderIds.Count);
        await mediator.Send(new MarkOrdersPaidCommand(
            orderIds,
            @event.ReceiptNumber,
            @event.Tender ?? "Mixed",
            @event.SettledAt == default ? @event.CreationDate : @event.SettledAt));
    }
}
