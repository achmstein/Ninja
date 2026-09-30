namespace Ninja.Ordering.API.Application.Commands;

/// <summary>
/// Handler for the validated transition. A command rather than a direct
/// aggregate call from the integration-event handler: the transition raises a
/// domain event whose handler writes to the outbox, and that write needs the
/// transaction TransactionBehavior opens around a command. Answers false for
/// an order it did not move — none such, or one already past the check (the
/// same answer delivered twice), which is left as it is.
/// </summary>
public class SetOrderValidatedCommandHandler(
    IOrderRepository orderRepository,
    ILogger<SetOrderValidatedCommandHandler> logger) : IRequestHandler<SetOrderValidatedCommand, bool>
{
    public async Task<bool> Handle(SetOrderValidatedCommand command, CancellationToken cancellationToken)
    {
        var order = await orderRepository.GetAsync(command.OrderNumber);

        if (order == null)
        {
            logger.LogWarning("Order {OrderNumber} not found for validation", command.OrderNumber);
            return false;
        }

        if (order.OrderStatus != OrderStatus.AwaitingValidation)
        {
            logger.LogInformation("Order {OrderNumber} is already {Status}; a repeated validation is ignored", command.OrderNumber, order.OrderStatus);
            return false;
        }

        order.SetValidatedStatus(command.Prices, command.PromoCode, command.PromoDiscount, command.Categories);

        return await orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
