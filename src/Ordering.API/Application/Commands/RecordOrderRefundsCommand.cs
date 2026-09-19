namespace Ninja.Ordering.API.Application.Commands;

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
    IBuyerRepository buyerRepository,
    IOrderingIntegrationEventService integrationEvents,
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
            await PaymentNotice.QueueAsync(order, "Refunded", buyerRepository, integrationEvents);
        }
        return await orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}

/// <summary>
/// The bus redelivers and RecordRefund adds, so the credit note's event id
/// is the request id: a second delivery finds it and does nothing.
/// </summary>
public class RecordOrderRefundsIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<RecordOrderRefundsCommand, bool>> logger)
    : IdentifiedCommandHandler<RecordOrderRefundsCommand, bool>(mediator, requestManager, logger)
{
    protected override bool CreateResultForDuplicateRequest() => true;
}
