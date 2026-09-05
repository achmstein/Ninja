namespace Chillax.Ordering.API.Application.Commands;

/// <summary>
/// Moves a confirmed order along in the kitchen. The aggregate decides which
/// moves are legal; a repeated tap is a no-op there, so two screens on the
/// same card never trip over each other.
/// </summary>
public class SetOrderPreparationCommandHandler(
    IOrderRepository orderRepository,
    ILogger<SetOrderPreparationCommandHandler> logger) : IRequestHandler<SetOrderPreparationCommand, bool>
{
    public async Task<bool> Handle(SetOrderPreparationCommand command, CancellationToken cancellationToken)
    {
        var order = await orderRepository.GetAsync(command.OrderNumber);

        if (order == null)
        {
            logger.LogWarning("Order {OrderNumber} not found for kitchen update", command.OrderNumber);
            return false;
        }

        logger.LogInformation("Kitchen: order {OrderNumber} -> {Preparation}", command.OrderNumber, command.Preparation);

        order.SetPreparation(command.Preparation);

        return await orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}

/// <summary>
/// Idempotent command handler for SetOrderPreparationCommand
/// </summary>
public class SetOrderPreparationIdentifiedCommandHandler : IdentifiedCommandHandler<SetOrderPreparationCommand, bool>
{
    public SetOrderPreparationIdentifiedCommandHandler(
        IMediator mediator,
        IRequestManager requestManager,
        ILogger<IdentifiedCommandHandler<SetOrderPreparationCommand, bool>> logger)
        : base(mediator, requestManager, logger)
    {
    }

    protected override bool CreateResultForDuplicateRequest()
    {
        return true; // A retried tap already landed
    }
}
