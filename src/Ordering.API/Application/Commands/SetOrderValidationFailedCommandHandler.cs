namespace Ninja.Ordering.API.Application.Commands;

/// <summary>
/// Handler for the failed-validation transition. A command for the same
/// reason as SetOrderValidatedCommand: cancelling raises a domain event whose
/// handler writes to the outbox, and that write needs the transaction
/// TransactionBehavior opens around a command. An order already past the
/// check (the answer delivered twice) is left as it is.
/// </summary>
public class SetOrderValidationFailedCommandHandler(
    IOrderRepository orderRepository,
    ILogger<SetOrderValidationFailedCommandHandler> logger) : IRequestHandler<SetOrderValidationFailedCommand, bool>
{
    public async Task<bool> Handle(SetOrderValidationFailedCommand command, CancellationToken cancellationToken)
    {
        var order = await orderRepository.GetAsync(command.OrderNumber);

        if (order == null)
        {
            logger.LogWarning("Order {OrderNumber} not found for failed validation", command.OrderNumber);
            return false;
        }

        if (order.OrderStatus != OrderStatus.AwaitingValidation)
        {
            logger.LogInformation("Order {OrderNumber} is already {Status}; a repeated validation is ignored", command.OrderNumber, order.OrderStatus);
            return false;
        }

        order.SetValidationFailedStatus(command.Failures);

        return await orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
