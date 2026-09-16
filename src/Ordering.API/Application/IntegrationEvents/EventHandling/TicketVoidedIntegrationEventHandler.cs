namespace Chillax.Ordering.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// An owner voided an open bill: every order on it is stamped voided, so the
/// customer's list stops saying "Unpaid" for a bill that will never be paid.
/// Settled tickets cannot be voided, so a paid order never sees this.
/// </summary>
public class TicketVoidedIntegrationEventHandler(
    IMediator mediator,
    ILogger<TicketVoidedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<TicketVoidedIntegrationEvent>
{
    public async Task Handle(TicketVoidedIntegrationEvent @event)
    {
        var orderIds = (@event.OrderReversals ?? []).Select(r => r.OrderId).Distinct().ToList();
        if (orderIds.Count == 0)
        {
            return;
        }
        logger.LogInformation("Ticket {TicketId} voided - marking {Count} order(s) voided", @event.TicketId, orderIds.Count);
        await mediator.Send(new MarkOrdersVoidedCommand(orderIds, @event.CreationDate));
    }
}
