namespace Ninja.Ordering.API.Application.Commands;

/// <summary>
/// The customer's online payment for an order paid ahead came in: the order
/// goes to the till, marked paid. A payment the order cannot take is not an
/// error here: it is answered with OrderOnlinePaymentRefusedIntegrationEvent
/// (through the outbox, in this transaction) so Sales gives it back. A
/// command, so the write and the answer share the transaction
/// TransactionBehavior opens around it.
/// </summary>
[DataContract]
public record MarkOrderPaidOnlineCommand(
    [property: DataMember] int OrderNumber,
    [property: DataMember] Guid PaymentKey,
    [property: DataMember] decimal Amount,
    [property: DataMember] DateTime PaidAt) : IRequest<bool>;

public class MarkOrderPaidOnlineCommandHandler(
    IOrderRepository orderRepository,
    IOrderingIntegrationEventService integrationEvents,
    ILogger<MarkOrderPaidOnlineCommandHandler> logger) : IRequestHandler<MarkOrderPaidOnlineCommand, bool>
{
    public async Task<bool> Handle(MarkOrderPaidOnlineCommand command, CancellationToken cancellationToken)
    {
        var order = await orderRepository.GetAsync(command.OrderNumber);
        if (order is null)
        {
            logger.LogWarning("Online payment {Key} names order {OrderNumber}, which Ordering does not know - given back",
                command.PaymentKey, command.OrderNumber);
            await integrationEvents.AddAndSaveEventAsync(new OrderOnlinePaymentRefusedIntegrationEvent(command.OrderNumber, command.PaymentKey, PaymentErrors.NotAhead));
            return true;
        }

        try
        {
            if (!order.MarkPaidOnline(command.PaymentKey, command.Amount, command.PaidAt))
            {
                return true; // the same payment again: the bus redelivered
            }
        }
        catch (OrderingDomainException ex) when (ex.Code is not null)
        {
            logger.LogWarning("Order {OrderNumber} cannot take online payment {Key} ({Reason}) - given back",
                command.OrderNumber, command.PaymentKey, ex.Code);
            await integrationEvents.AddAndSaveEventAsync(new OrderOnlinePaymentRefusedIntegrationEvent(order.Id, command.PaymentKey, ex.Code));
            return true;
        }

        logger.LogInformation("Order {OrderNumber} paid online ({Amount}) - to the till", command.OrderNumber, command.Amount);
        return await orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
