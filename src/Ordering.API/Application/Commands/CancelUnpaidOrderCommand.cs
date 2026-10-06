namespace Ninja.Ordering.API.Application.Commands;

/// <summary>
/// The customer gave up on paying an order ahead: it is cancelled, nothing
/// having been charged (Sales lets go of a payment still open for it, and
/// gives back one that lands later). A command, so the write and its events
/// share a transaction.
/// </summary>
[DataContract]
public record CancelUnpaidOrderCommand([property: DataMember] int OrderNumber) : IRequest<bool>;

public class CancelUnpaidOrderCommandHandler(IOrderRepository orderRepository)
    : IRequestHandler<CancelUnpaidOrderCommand, bool>
{
    public async Task<bool> Handle(CancelUnpaidOrderCommand command, CancellationToken cancellationToken)
    {
        var order = await orderRepository.GetAsync(command.OrderNumber);
        if (order is null)
        {
            return false;
        }
        order.CancelUnpaid();
        return await orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
