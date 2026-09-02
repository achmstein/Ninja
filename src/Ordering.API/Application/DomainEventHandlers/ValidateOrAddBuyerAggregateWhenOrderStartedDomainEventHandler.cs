#nullable enable
namespace Chillax.Ordering.API.Application.DomainEventHandlers;

/// <summary>
/// Handler for OrderStartedDomainEvent.
/// Simplified for cafe - creates or retrieves buyer, no payment method handling.
/// </summary>
public class ValidateOrAddBuyerAggregateWhenOrderStartedDomainEventHandler
                    : INotificationHandler<OrderStartedDomainEvent>
{
    private readonly ILogger _logger;
    private readonly IBuyerRepository _buyerRepository;
    private readonly IOrderingIntegrationEventService _orderingIntegrationEventService;

    public ValidateOrAddBuyerAggregateWhenOrderStartedDomainEventHandler(
        ILogger<ValidateOrAddBuyerAggregateWhenOrderStartedDomainEventHandler> logger,
        IBuyerRepository buyerRepository,
        IOrderingIntegrationEventService orderingIntegrationEventService)
    {
        _buyerRepository = buyerRepository ?? throw new ArgumentNullException(nameof(buyerRepository));
        _orderingIntegrationEventService = orderingIntegrationEventService ?? throw new ArgumentNullException(nameof(orderingIntegrationEventService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task Handle(OrderStartedDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        // An order with no identity behind it has no Buyer to hang off — a
        // guest announces itself under the name left at checkout, a walk-in
        // counter sale under a generic label.
        if (string.IsNullOrWhiteSpace(domainEvent.UserId))
        {
            await _orderingIntegrationEventService.AddAndSaveEventAsync(
                new OrderStatusChangedToSubmittedIntegrationEvent(
                    domainEvent.Order.Id,
                    domainEvent.Order.OrderStatus,
                    domainEvent.Order.GuestName ?? "Walk-in",
                    string.Empty,
                    domainEvent.Order.BranchId,
                    domainEvent.Order.GuestId));

            return;
        }

        var buyer = await _buyerRepository.FindAsync(domainEvent.UserId);
        var buyerExisted = buyer is not null;

        if (!buyerExisted)
        {
            buyer = new Buyer(domainEvent.UserId, domainEvent.UserName);
            _buyerRepository.Add(buyer);
        }
        else if (buyer!.Name != domainEvent.UserName)
        {
            buyer.UpdateName(domainEvent.UserName);
        }

        await _buyerRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        // Link the buyer to the order
        domainEvent.Order.SetBuyerId(buyer!.Id);

        var integrationEvent = new OrderStatusChangedToSubmittedIntegrationEvent(
            domainEvent.Order.Id,
            domainEvent.Order.OrderStatus,
            buyer!.Name,
            buyer.IdentityGuid,
            domainEvent.Order.BranchId);

        await _orderingIntegrationEventService.AddAndSaveEventAsync(integrationEvent);

        OrderingApiTrace.LogOrderBuyerAndPaymentValidatedOrUpdated(_logger, buyer.Id, domainEvent.Order.Id);
    }
}
