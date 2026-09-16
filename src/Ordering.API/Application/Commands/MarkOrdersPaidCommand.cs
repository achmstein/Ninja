namespace Chillax.Ordering.API.Application.Commands;

/// <summary>
/// A receipt covered these orders: stamp each with the receipt number, the
/// tender and the time, so the customer's list can say it was paid. A
/// command rather than a direct aggregate call from the integration-event
/// handler, so the write runs inside the transaction TransactionBehavior
/// opens around a command.
/// </summary>
[DataContract]
public record MarkOrdersPaidCommand(
    [property: DataMember] IReadOnlyCollection<int> OrderNumbers,
    [property: DataMember] int ReceiptNumber,
    [property: DataMember] string Tender,
    [property: DataMember] DateTime PaidAt,
    [property: DataMember] int? TicketId = null) : IRequest<bool>;

public class MarkOrdersPaidCommandHandler(
    IOrderRepository orderRepository,
    ILogger<MarkOrdersPaidCommandHandler> logger) : IRequestHandler<MarkOrdersPaidCommand, bool>
{
    public async Task<bool> Handle(MarkOrdersPaidCommand command, CancellationToken cancellationToken)
    {
        foreach (var orderNumber in command.OrderNumbers.Distinct())
        {
            var order = await orderRepository.GetAsync(orderNumber);
            if (order is null)
            {
                // A counter sale keyed straight into the till has no order here
                logger.LogInformation("Order {OrderNumber} on receipt #{Receipt} is not known to Ordering - skipped",
                    orderNumber, command.ReceiptNumber);
                continue;
            }
            order.MarkPaid(command.ReceiptNumber, command.Tender, command.PaidAt, command.TicketId);
        }
        return await orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
