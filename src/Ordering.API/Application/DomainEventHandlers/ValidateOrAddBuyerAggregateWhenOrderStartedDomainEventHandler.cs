#nullable enable
namespace Ninja.Ordering.API.Application.DomainEventHandlers;

/// <summary>
/// Handler for OrderStartedDomainEvent.
/// Creates or updates the Buyer behind a signed-in order and links it. The
/// "new order" notification is not sent from here: at order start the order
/// is still awaiting the stock check and is not in the pending queue yet
/// (see OrderStatusChangedToSubmittedDomainEventHandler).
/// </summary>
public class ValidateOrAddBuyerAggregateWhenOrderStartedDomainEventHandler
                    : INotificationHandler<OrderStartedDomainEvent>
{
    private readonly ILogger _logger;
    private readonly IBuyerRepository _buyerRepository;

    public ValidateOrAddBuyerAggregateWhenOrderStartedDomainEventHandler(
        ILogger<ValidateOrAddBuyerAggregateWhenOrderStartedDomainEventHandler> logger,
        IBuyerRepository buyerRepository)
    {
        _buyerRepository = buyerRepository ?? throw new ArgumentNullException(nameof(buyerRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task Handle(OrderStartedDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        // A guest or walk-in order has no identity behind it, so no Buyer row
        if (string.IsNullOrWhiteSpace(domainEvent.UserId))
        {
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

        OrderingApiTrace.LogOrderBuyerAndPaymentValidatedOrUpdated(_logger, buyer.Id, domainEvent.Order.Id);
    }
}
