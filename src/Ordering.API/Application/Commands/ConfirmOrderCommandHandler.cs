namespace Ninja.Ordering.API.Application.Commands;

/// <summary>
/// Handler for confirming cafe orders (admin action).
/// </summary>
public class ConfirmOrderCommandHandler : IRequestHandler<ConfirmOrderCommand, bool>
{
    private readonly IOrderRepository _orderRepository;
    private readonly ILogger<ConfirmOrderCommandHandler> _logger;

    public ConfirmOrderCommandHandler(
        IOrderRepository orderRepository,
        ILogger<ConfirmOrderCommandHandler> logger)
    {
        _orderRepository = orderRepository ?? throw new ArgumentNullException(nameof(orderRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(ConfirmOrderCommand command, CancellationToken cancellationToken)
    {
        var order = await _orderRepository.GetAsync(command.OrderNumber);

        if (order == null)
        {
            _logger.LogWarning("Order {OrderNumber} not found for confirmation", command.OrderNumber);
            return false;
        }

        _logger.LogInformation("Confirming Order {OrderNumber} - sent to POS", command.OrderNumber);

        order.SetConfirmedStatus();

        return await _orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}

/// <summary>
/// Idempotent command handler for ConfirmOrderCommand
/// </summary>
public class ConfirmOrderIdentifiedCommandHandler : IdentifiedCommandHandler<ConfirmOrderCommand, bool>
{
    public ConfirmOrderIdentifiedCommandHandler(
        IMediator mediator,
        IRequestManager requestManager,
        ILogger<IdentifiedCommandHandler<ConfirmOrderCommand, bool>> logger)
        : base(mediator, requestManager, logger)
    {
    }

    protected override bool CreateResultForDuplicateRequest()
    {
        return true; // Ignore duplicate requests for confirming order.
    }
}
