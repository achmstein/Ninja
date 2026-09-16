namespace Chillax.Ordering.API.Application.Commands;

/// <summary>What one refund gave back against one order.</summary>
public record OrderRefund(int OrderNumber, decimal Amount);

/// <summary>
/// A credit note reversed part of these orders: each keeps a running
/// refunded amount so the customer's list can say so. Through a command for
/// the same reason as <see cref="MarkOrdersPaidCommand"/>.
/// </summary>
[DataContract]
public record RecordOrderRefundsCommand(
    [property: DataMember] IReadOnlyCollection<OrderRefund> Refunds) : IRequest<bool>;

public class RecordOrderRefundsCommandHandler(
    IOrderRepository orderRepository,
    ILogger<RecordOrderRefundsCommandHandler> logger) : IRequestHandler<RecordOrderRefundsCommand, bool>
{
    public async Task<bool> Handle(RecordOrderRefundsCommand command, CancellationToken cancellationToken)
    {
        foreach (var refund in command.Refunds)
        {
            var order = await orderRepository.GetAsync(refund.OrderNumber);
            if (order is null)
            {
                logger.LogInformation("Refunded order {OrderNumber} is not known to Ordering - skipped", refund.OrderNumber);
                continue;
            }
            order.RecordRefund(refund.Amount);
        }
        return await orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
