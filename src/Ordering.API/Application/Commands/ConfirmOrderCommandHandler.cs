namespace Ninja.Ordering.API.Application.Commands;

/// <summary>
/// Handler for confirming cafe orders (admin action). Confirming is also
/// what sends the order to the kitchen, split by the branch's stations as
/// they stand right now.
/// </summary>
public class ConfirmOrderCommandHandler : IRequestHandler<ConfirmOrderCommand, bool>
{
    private readonly IOrderRepository _orderRepository;
    private readonly IKitchenStationRepository _stationRepository;
    private readonly ILogger<ConfirmOrderCommandHandler> _logger;

    public ConfirmOrderCommandHandler(
        IOrderRepository orderRepository,
        IKitchenStationRepository stationRepository,
        ILogger<ConfirmOrderCommandHandler> logger)
    {
        _orderRepository = orderRepository ?? throw new ArgumentNullException(nameof(orderRepository));
        _stationRepository = stationRepository ?? throw new ArgumentNullException(nameof(stationRepository));
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

        // A branch without stations gets its default one here, saved with the
        // order; HiLo gives it its id on the spot, so a line can point at it
        var stations = await _stationRepository.GetForBranchAsync(order.BranchId);

        order.SetConfirmedStatus(new KitchenRouting(stations));

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
