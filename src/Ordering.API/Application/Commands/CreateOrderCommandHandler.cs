namespace Chillax.Ordering.API.Application.Commands;

using Chillax.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>
/// Handler for creating cafe orders.
/// </summary>
public class CreateOrderCommandHandler : IRequestHandler<CreateOrderCommand, bool>
{
    private readonly IOrderRepository _orderRepository;
    private readonly IOrderingIntegrationEventService _orderingIntegrationEventService;
    private readonly ILogger<CreateOrderCommandHandler> _logger;

    public CreateOrderCommandHandler(
        IOrderingIntegrationEventService orderingIntegrationEventService,
        IOrderRepository orderRepository,
        ILogger<CreateOrderCommandHandler> logger)
    {
        _orderRepository = orderRepository ?? throw new ArgumentNullException(nameof(orderRepository));
        _orderingIntegrationEventService = orderingIntegrationEventService ?? throw new ArgumentNullException(nameof(orderingIntegrationEventService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(CreateOrderCommand message, CancellationToken cancellationToken)
    {
        // Add Integration event to clean the basket
        var orderStartedIntegrationEvent = new OrderStartedIntegrationEvent(message.UserId);
        await _orderingIntegrationEventService.AddAndSaveEventAsync(orderStartedIntegrationEvent);

        // Create the order (starts in AwaitingValidation status)
        var order = new Order(
            message.UserId,
            message.UserName,
            message.BranchId,
            message.RoomName,
            message.CustomerNote,
            pointsToRedeem: message.PointsToRedeem,
            loyaltyDiscount: message.LoyaltyDiscount,
            tableId: message.TableId,
            tableName: message.TableName);

        foreach (var item in message.OrderItems)
        {
            order.AddOrderItem(item.ProductId, item.ProductName, item.UnitPrice, item.Discount, item.PictureUrl, item.Units, item.CustomizationsDescription, item.SpecialInstructions);
        }

        _logger.LogInformation("Creating Cafe Order - Order: {@Order}", order);

        _orderRepository.Add(order);

        // Add event to validate item availability in Catalog (will be published by TransactionBehavior)
        var orderStockItems = message.OrderItems
            .Select(i => new OrderStockItem(i.ProductId, i.Units));

        var awaitingValidationEvent = new OrderStatusChangedToAwaitingValidationIntegrationEvent(
            order.Id, orderStockItems, message.BranchId);

        await _orderingIntegrationEventService.AddAndSaveEventAsync(awaitingValidationEvent);

        return await _orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}

/// <summary>
/// Idempotent command handler for CreateOrderCommand
/// </summary>
public class CreateOrderIdentifiedCommandHandler : IdentifiedCommandHandler<CreateOrderCommand, bool>
{
    public CreateOrderIdentifiedCommandHandler(
        IMediator mediator,
        IRequestManager requestManager,
        ILogger<IdentifiedCommandHandler<CreateOrderCommand, bool>> logger)
        : base(mediator, requestManager, logger)
    {
    }

    protected override bool CreateResultForDuplicateRequest()
    {
        return true; // Ignore duplicate requests for creating order.
    }
}
