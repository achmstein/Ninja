namespace Chillax.Ordering.API.Application.Commands;

/// <summary>
/// Handler for the stock-confirmed transition. A command rather than a direct
/// aggregate call from the integration-event handler: the transition raises a
/// domain event whose handler writes to the outbox, and that write needs the
/// transaction TransactionBehavior opens around a command.
/// </summary>
public class SetOrderStockConfirmedCommandHandler(
    IOrderRepository orderRepository,
    ILogger<SetOrderStockConfirmedCommandHandler> logger) : IRequestHandler<SetOrderStockConfirmedCommand, bool>
{
    public async Task<bool> Handle(SetOrderStockConfirmedCommand command, CancellationToken cancellationToken)
    {
        var order = await orderRepository.GetAsync(command.OrderNumber);

        if (order == null)
        {
            logger.LogWarning("Order {OrderNumber} not found for stock confirmation", command.OrderNumber);
            return false;
        }

        order.SetStockConfirmedStatus();

        return await orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
