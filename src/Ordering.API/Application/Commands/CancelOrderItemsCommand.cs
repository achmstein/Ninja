#nullable enable
namespace Ninja.Ordering.API.Application.Commands;

/// <summary>One order, and which of its items the till cancelled.</summary>
public record OrderItemsToCancel(int OrderNumber, IReadOnlyCollection<ItemCancel> Items);

/// <summary>
/// Items of these orders were cancelled at the till after the kitchen had
/// them (their bill's lines were): each order strikes them, the kitchen
/// hears, and their stock goes as said. Through a command, under the
/// event's id, for the same reason as <see cref="RecordOrderRefundsCommand"/>.
/// </summary>
[DataContract]
public record CancelOrderItemsCommand(
    [property: DataMember] IReadOnlyCollection<OrderItemsToCancel> Orders,
    [property: DataMember] string? Reason,
    [property: DataMember] DateTime CancelledAt,
    [property: DataMember] StockDisposition? StockDisposition,
    [property: DataMember] Guid Key) : IRequest<bool>;

public class CancelOrderItemsCommandHandler(
    IOrderRepository orderRepository,
    ILogger<CancelOrderItemsCommandHandler> logger) : IRequestHandler<CancelOrderItemsCommand, bool>
{
    public async Task<bool> Handle(CancelOrderItemsCommand command, CancellationToken cancellationToken)
    {
        foreach (var cancel in command.Orders)
        {
            var order = await orderRepository.GetAsync(cancel.OrderNumber);
            if (order is null)
            {
                logger.LogInformation("Cancelled items of order {OrderNumber}, which Ordering does not know - skipped", cancel.OrderNumber);
                continue;
            }

            if (!order.CancelItems(cancel.Items, command.Reason, command.CancelledAt, command.StockDisposition, command.Key))
            {
                logger.LogWarning("Order {OrderNumber}: none of the cancelled items were found still to make", cancel.OrderNumber);
            }
        }
        return await orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}

/// <summary>A strike adds up, so the cancel's event id is the request id: a redelivery does nothing.</summary>
public class CancelOrderItemsIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<CancelOrderItemsCommand, bool>> logger)
    : IdentifiedCommandHandler<CancelOrderItemsCommand, bool>(mediator, requestManager, logger)
{
    protected override bool CreateResultForDuplicateRequest() => true;
}
