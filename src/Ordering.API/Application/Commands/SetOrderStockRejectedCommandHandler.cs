namespace Ninja.Ordering.API.Application.Commands;

/// <summary>
/// Handler for the stock-rejected transition. A command for the same reason
/// as SetOrderStockConfirmedCommand: cancelling raises a domain event whose
/// handler writes to the outbox, and that write needs the transaction
/// TransactionBehavior opens around a command.
/// </summary>
public class SetOrderStockRejectedCommandHandler(
    IOrderRepository orderRepository,
    ILogger<SetOrderStockRejectedCommandHandler> logger) : IRequestHandler<SetOrderStockRejectedCommand, bool>
{
    public async Task<bool> Handle(SetOrderStockRejectedCommand command, CancellationToken cancellationToken)
    {
        var order = await orderRepository.GetAsync(command.OrderNumber);

        if (order == null)
        {
            logger.LogWarning("Order {OrderNumber} not found for stock rejection", command.OrderNumber);
            return false;
        }

        order.SetStockRejectedStatus(command.UnavailableProductIds);

        return await orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
