namespace Chillax.Ordering.API.Application.Commands;

/// <summary>
/// The bill these orders were on was voided before it was paid: stamp each,
/// so the customer's list says "Voided" rather than "Unpaid" forever. Through
/// a command for the same reason as <see cref="MarkOrdersPaidCommand"/>.
/// </summary>
[DataContract]
public record MarkOrdersVoidedCommand(
    [property: DataMember] IReadOnlyCollection<int> OrderNumbers,
    [property: DataMember] DateTime VoidedAt) : IRequest<bool>;

public class MarkOrdersVoidedCommandHandler(
    IOrderRepository orderRepository,
    ILogger<MarkOrdersVoidedCommandHandler> logger) : IRequestHandler<MarkOrdersVoidedCommand, bool>
{
    public async Task<bool> Handle(MarkOrdersVoidedCommand command, CancellationToken cancellationToken)
    {
        foreach (var orderNumber in command.OrderNumbers.Distinct())
        {
            var order = await orderRepository.GetAsync(orderNumber);
            if (order is null)
            {
                logger.LogInformation("Voided order {OrderNumber} is not known to Ordering - skipped", orderNumber);
                continue;
            }
            order.MarkVoided(command.VoidedAt);
        }
        return await orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
