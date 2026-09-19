namespace Ninja.Ordering.API.Application.Commands;

/// <summary>
/// Marks a confirmed order ready in the kitchen, or brings it back. The
/// aggregate decides which moves are legal; a repeated tap is a no-op there,
/// so two screens on the same card never trip over each other.
/// </summary>
public class SetOrderReadyCommandHandler(
    IOrderRepository orderRepository,
    ILogger<SetOrderReadyCommandHandler> logger) : IRequestHandler<SetOrderReadyCommand, bool>
{
    public async Task<bool> Handle(SetOrderReadyCommand command, CancellationToken cancellationToken)
    {
        var order = await orderRepository.GetAsync(command.OrderNumber);

        if (order == null)
        {
            logger.LogWarning("Order {OrderNumber} not found for kitchen update", command.OrderNumber);
            return false;
        }

        logger.LogInformation("Kitchen: order {OrderNumber} ready -> {Ready}", command.OrderNumber, command.Ready);

        order.SetReady(command.Ready);

        return await orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}

/// <summary>
/// Idempotent command handler for SetOrderReadyCommand
/// </summary>
public class SetOrderReadyIdentifiedCommandHandler : IdentifiedCommandHandler<SetOrderReadyCommand, bool>
{
    public SetOrderReadyIdentifiedCommandHandler(
        IMediator mediator,
        IRequestManager requestManager,
        ILogger<IdentifiedCommandHandler<SetOrderReadyCommand, bool>> logger)
        : base(mediator, requestManager, logger)
    {
    }

    protected override bool CreateResultForDuplicateRequest()
    {
        return true; // A retried tap already landed
    }
}
