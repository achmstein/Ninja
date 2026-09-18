#nullable enable
namespace Chillax.Ordering.API.Application.DomainEventHandlers;

/// <summary>
/// Handler for OrderStatusChangedToConfirmedDomainEvent.
/// Publishes an integration event to notify other services that the order is confirmed.
/// </summary>
public class OrderStatusChangedToConfirmedDomainEventHandler
    : INotificationHandler<OrderStatusChangedToConfirmedDomainEvent>
{
    private readonly IOrderRepository _orderRepository;
    private readonly IBuyerRepository _buyerRepository;
    private readonly ILogger _logger;
    private readonly IOrderingIntegrationEventService _orderingIntegrationEventService;

    public OrderStatusChangedToConfirmedDomainEventHandler(
        IOrderRepository orderRepository,
        ILogger<OrderStatusChangedToConfirmedDomainEventHandler> logger,
        IBuyerRepository buyerRepository,
        IOrderingIntegrationEventService orderingIntegrationEventService)
    {
        _orderRepository = orderRepository ?? throw new ArgumentNullException(nameof(orderRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _buyerRepository = buyerRepository ?? throw new ArgumentNullException(nameof(buyerRepository));
        _orderingIntegrationEventService = orderingIntegrationEventService ?? throw new ArgumentNullException(nameof(orderingIntegrationEventService));
    }

    public async Task Handle(OrderStatusChangedToConfirmedDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        OrderingApiTrace.LogOrderStatusUpdated(_logger, domainEvent.OrderId, OrderStatus.Confirmed);

        var order = await _orderRepository.GetAsync(domainEvent.OrderId);

        if (order == null)
        {
            _logger.LogWarning("Order {OrderId} not found", domainEvent.OrderId);
            return;
        }

        // A guest order or walk-in counter sale is confirmed like any other;
        // it just has no identity to credit, so loyalty skips it downstream
        // on the empty guid.
        string buyerName;
        string buyerIdentityGuid;

        if (order.BuyerId == null)
        {
            buyerName = order.GuestName ?? "Walk-in";
            buyerIdentityGuid = string.Empty;
        }
        else
        {
            var buyer = await _buyerRepository.FindByIdAsync(order.BuyerId.Value);

            if (buyer == null)
            {
                _logger.LogWarning("Buyer {BuyerId} not found for order {OrderId}", order.BuyerId, domainEvent.OrderId);
                return;
            }

            buyerName = buyer.Name;
            buyerIdentityGuid = buyer.IdentityGuid;
        }

        // Null unless somebody was actually named, so downstream can tell a
        // named walk-in from an anonymous one
        var customerName = order.BuyerId is null ? order.GuestName : buyerName;

        var integrationEvent = new OrderStatusChangedToConfirmedIntegrationEvent(
            order.Id,
            order.OrderStatus,
            buyerName,
            buyerIdentityGuid,
            // LEGACY(places): RoomName, and RoomId/TableId/TableName below, still fill the event's old fields beside the place — remove when every till and customer app is on /api/places and /api/stays.
            order.RoomName,
            order.GetTotal(),
            order.PointsToRedeem,
            order.GuestId,
            order.BranchId,
            order.SessionId,
            order.RoomId,
            order.TableId,
            order.TableName,
            order.TicketId,
            customerName,
            order.Source.ToString(),
            order.GuestPhone,
            order.LoyaltyDiscount,
            order.OrderItems.Select(oi => new OrderConfirmedItem(
                oi.ProductId,
                oi.ProductName,
                oi.Units,
                oi.UnitPrice,
                oi.Discount,
                oi.CustomizationsDescription,
                oi.OptionIds)).ToList(),
            order.PlaceId,
            order.PlaceKind,
            order.PlaceName,
            order.PromoCode,
            order.PromoDiscount)
        {
            PlacedAt = order.OrderDate,
        };

        await _orderingIntegrationEventService.AddAndSaveEventAsync(integrationEvent);
    }
}
