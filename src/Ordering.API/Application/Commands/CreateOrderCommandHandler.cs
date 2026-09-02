namespace Chillax.Ordering.API.Application.Commands;

using Chillax.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>
/// Handler for creating cafe orders.
/// </summary>
public class CreateOrderCommandHandler : IRequestHandler<CreateOrderCommand, int>
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

    public async Task<int> Handle(CreateOrderCommand message, CancellationToken cancellationToken)
    {
        // Add Integration event to clean the basket
        var orderStartedIntegrationEvent = new OrderStartedIntegrationEvent(message.UserId);
        await _orderingIntegrationEventService.AddAndSaveEventAsync(orderStartedIntegrationEvent);

        // The discount is what the redeemed points are worth at the fixed
        // rate, against what the items actually cost — the request's opinion
        // of it is never consulted (the client used to send it; see D5b/D7 in
        // docs/pos-plan.md).
        var itemsTotal = message.OrderItems.Sum(i => i.UnitPrice * i.Units - i.Discount);
        var loyaltyDiscount = Order.GetLoyaltyDiscountFor(message.PointsToRedeem, itemsTotal);

        // Create the order (starts in AwaitingValidation status)
        var order = new Order(
            message.UserId,
            message.UserName,
            message.BranchId,
            message.RoomName,
            message.CustomerNote,
            pointsToRedeem: message.PointsToRedeem,
            loyaltyDiscount: loyaltyDiscount,
            tableId: message.TableId,
            tableName: message.TableName,
            guestId: message.GuestId,
            guestName: message.GuestName,
            guestPhone: message.GuestPhone,
            source: message.Source,
            sessionId: message.SessionId,
            roomId: message.RoomId);

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

        await _orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        // HiLo assigned the id at Add — the POS uses it to find the ticket
        // the confirmed order lands on
        return order.Id;
    }
}

/// <summary>
/// Idempotent command handler for CreateOrderCommand
/// </summary>
public class CreateOrderIdentifiedCommandHandler : IdentifiedCommandHandler<CreateOrderCommand, int>
{
    public CreateOrderIdentifiedCommandHandler(
        IMediator mediator,
        IRequestManager requestManager,
        ILogger<IdentifiedCommandHandler<CreateOrderCommand, int>> logger)
        : base(mediator, requestManager, logger)
    {
    }

    protected override int CreateResultForDuplicateRequest()
    {
        // The retry of an already-created order: the id wasn't recorded
        // against the request id, so 0 stands for "placed, look it up"
        return 0;
    }
}
