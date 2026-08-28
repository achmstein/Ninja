namespace Chillax.Ordering.API.Application.Commands;

/// <summary>
/// Permanently removes an order. Only cancelled orders may be deleted —
/// confirmed orders are financial history (revenue, loyalty points) and
/// cancelled-then-deleted is the cleanup path for duplicate submissions.
/// </summary>
public class DeleteOrderCommandHandler : IRequestHandler<DeleteOrderCommand, bool>
{
    private readonly IOrderRepository _orderRepository;
    private readonly ILogger<DeleteOrderCommandHandler> _logger;

    public DeleteOrderCommandHandler(
        IOrderRepository orderRepository,
        ILogger<DeleteOrderCommandHandler> logger)
    {
        _orderRepository = orderRepository;
        _logger = logger;
    }

    public async Task<bool> Handle(DeleteOrderCommand command, CancellationToken cancellationToken)
    {
        var order = await _orderRepository.GetAsync(command.OrderNumber);
        if (order == null)
        {
            return false;
        }

        if (order.OrderStatus != OrderStatus.Cancelled)
        {
            _logger.LogWarning(
                "Refusing to delete order {OrderNumber} with status {Status} — only cancelled orders can be deleted",
                command.OrderNumber, order.OrderStatus);
            return false;
        }

        _orderRepository.Delete(order);
        return await _orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
