namespace Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;

public class OrderValidationFailedIntegrationEventHandler(
    IMediator mediator,
    ILogger<OrderValidationFailedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderValidationFailedIntegrationEvent>
{
    public async Task Handle(OrderValidationFailedIntegrationEvent @event)
    {
        logger.LogInformation("Handling integration event: {IntegrationEventId} - ({@IntegrationEvent})", @event.Id, @event);

        await FailAsync(@event.OrderId, @event.Lines.Select(l => new ValidationFailure(l.ProductId, l.Reason)).ToList());
    }

    internal async Task FailAsync(int orderId, List<ValidationFailure> failures)
    {
        // Through a command, not the aggregate: cancelling raises a domain
        // event whose handler writes the cancelled integration event to the
        // outbox, and that write needs the transaction TransactionBehavior
        // opens around a command (see OrderValidatedIntegrationEventHandler).
        var cancelled = await mediator.Send(new SetOrderValidationFailedCommand(orderId, failures));

        if (!cancelled)
        {
            return;
        }

        logger.LogWarning("Order {OrderId} cancelled by the menu check: {Failures}",
            orderId, string.Join(", ", failures.Select(f => $"{f.ProductId} {f.Reason}")));
    }
}

/// <summary>
/// Catalog's refusal under its old name, from before it gave reasons: read
/// for one release, for answers queued when the stack was upgraded. Every
/// product it names was out of stock.
/// </summary>
public class OrderStockRejectedIntegrationEventHandler(
    IMediator mediator,
    ILogger<OrderValidationFailedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderStockRejectedIntegrationEvent>
{
    public Task Handle(OrderStockRejectedIntegrationEvent @event)
        => new OrderValidationFailedIntegrationEventHandler(mediator, logger).FailAsync(
            @event.OrderId,
            @event.OrderStockItems
                .Where(i => !i.HasStock)
                .Select(i => new ValidationFailure(i.ProductId, ValidationFailure.Unavailable))
                .ToList());
}
