namespace Ninja.Ordering.API.Application.DomainEventHandlers;

public partial class OrderCancelledDomainEventHandler
                : INotificationHandler<OrderCancelledDomainEvent>
{
    private readonly IOrderRepository _orderRepository;
    private readonly IBuyerRepository _buyerRepository;
    private readonly ILogger _logger;
    private readonly IOrderingIntegrationEventService _orderingIntegrationEventService;

    public OrderCancelledDomainEventHandler(
        IOrderRepository orderRepository,
        ILogger<OrderCancelledDomainEventHandler> logger,
        IBuyerRepository buyerRepository,
        IOrderingIntegrationEventService orderingIntegrationEventService)
    {
        _orderRepository = orderRepository ?? throw new ArgumentNullException(nameof(orderRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _buyerRepository = buyerRepository ?? throw new ArgumentNullException(nameof(buyerRepository));
        _orderingIntegrationEventService = orderingIntegrationEventService;
    }

    public async Task Handle(OrderCancelledDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        OrderingApiTrace.LogOrderStatusUpdated(_logger, domainEvent.Order.Id, OrderStatus.Cancelled);

        var order = await _orderRepository.GetAsync(domainEvent.Order.Id);

        // A guest order has no Buyer row to read the name off, and nothing to
        // notify by identity — it still has to announce the cancellation.
        var buyer = order.BuyerId.HasValue
            ? await _buyerRepository.FindByIdAsync(order.BuyerId.Value)
            : null;

        var integrationEvent = new OrderStatusChangedToCancelledIntegrationEvent(
            order.Id,
            order.OrderStatus,
            buyer?.Name ?? order.GuestName ?? "Customer",
            buyer?.IdentityGuid ?? string.Empty,
            order.GuestId);

        await _orderingIntegrationEventService.AddAndSaveEventAsync(integrationEvent);
    }
}
