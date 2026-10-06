#nullable enable
namespace Ninja.Ordering.API.Application.Commands;

using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>
/// Handler for creating business orders.
/// </summary>
public class CreateOrderCommandHandler : IRequestHandler<CreateOrderCommand, int>
{
    private readonly IOrderRepository _orderRepository;
    private readonly IOrderingIntegrationEventService _orderingIntegrationEventService;
    private readonly ILogger<CreateOrderCommandHandler> _logger;
    private readonly IDeliveryPolicy? _deliveryPolicy;
    private readonly ICustomerAddressBook? _addressBook;

    public CreateOrderCommandHandler(
        IOrderingIntegrationEventService orderingIntegrationEventService,
        IOrderRepository orderRepository,
        ILogger<CreateOrderCommandHandler> logger,
        IDeliveryPolicy? deliveryPolicy = null,
        ICustomerAddressBook? addressBook = null)
    {
        _orderRepository = orderRepository ?? throw new ArgumentNullException(nameof(orderRepository));
        _orderingIntegrationEventService = orderingIntegrationEventService ?? throw new ArgumentNullException(nameof(orderingIntegrationEventService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _deliveryPolicy = deliveryPolicy;
        _addressBook = addressBook;
    }

    /// <summary>
    /// The delivery the order carries, held to the branch's terms: the
    /// customer's to its area and minimum, the till's to neither (the cashier
    /// knows the streets). A delivery goes on a bill of its own, never to a
    /// place or an open bill, and the till names who it is for.
    /// </summary>
    private async Task<Delivery?> DeliveryOfAsync(CreateOrderCommand message, decimal itemsTotal)
    {
        if (message.Delivery is not { } draft)
        {
            return null;
        }

        var taker = message.Source == OrderSource.Pos ? DeliveryTaker.Till : DeliveryTaker.Customer;

        if (message.PlaceId is not null || message.TicketId is not null)
        {
            throw new OrderingDomainException("A delivery goes on a bill of its own, not to a table or an open bill.", DeliveryErrors.PlaceConflict);
        }

        if (message.Replay)
        {
            throw new OrderingDomainException("A delivery can't be replayed: it hasn't left yet.", DeliveryErrors.PlaceConflict);
        }

        if (taker == DeliveryTaker.Till && string.IsNullOrWhiteSpace(message.UserId) && string.IsNullOrWhiteSpace(message.GuestName))
        {
            throw new OrderingDomainException("A delivery needs the customer's name.", DeliveryErrors.NameRequired);
        }

        var policy = _deliveryPolicy ?? throw new InvalidOperationException("No delivery policy to hold a delivery to.");
        return await policy.BuildAsync(draft, message.BranchId, taker, message.GuestPhone, itemsTotal, isGuest: message.IsGuestOrder);
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
        var delivery = await DeliveryOfAsync(message, itemsTotal);

        // Create the order (starts in AwaitingValidation status)
        var order = new Order(
            message.UserId,
            message.UserName,
            message.BranchId,
            message.CustomerNote,
            pointsToRedeem: message.PointsToRedeem,
            loyaltyDiscount: loyaltyDiscount,
            guestId: message.GuestId,
            guestName: message.GuestName,
            guestPhone: message.GuestPhone,
            source: message.Source,
            sessionId: message.SessionId,
            ticketId: message.TicketId,
            placedAt: message.PlacedAt,
            placeId: message.PlaceId,
            placeKind: message.PlaceKind,
            placeName: message.PlaceName,
            promoCode: message.PromoCode,
            guestOrdersAnywhere: message.GuestOrdersAnywhere,
            platform: message.Platform,
            delivery: delivery,
            paysOnline: message.PayOnline);

        foreach (var item in message.OrderItems)
        {
            order.AddOrderItem(item.ProductId, item.ProductName, item.UnitPrice, item.Discount, item.PictureUrl, item.Units, item.CustomizationsDescription, item.SpecialInstructions, item.OptionIds, item.Suggestion);
        }

        // Ids only: a delivery's address and phone stay out of the logs
        _logger.LogInformation(
            "Creating order at branch {BranchId} from {Source}, {Lines} lines, delivery {IsDelivery}",
            order.BranchId, order.Source, order.OrderItems.Count, order.IsDelivery);

        _orderRepository.Add(order);

        // A saved address used again comes first next time
        if (message.Delivery is { } used && !string.IsNullOrEmpty(message.UserId) && _addressBook is not null)
        {
            await _addressBook.MarkUsedAsync(message.UserId, used);
        }

        if (message.Replay)
        {
            // Rung up while the till was offline: the customer has already
            // left with the items, so there is nothing for the stock check or
            // the kitchen to decide. The order lands confirmed at once — the
            // same transition a POS order takes after Catalog says yes — and
            // the confirmed event opens its ticket in Sales like any other.
            order.SetValidatedStatus();
            order.SetConfirmedStatus();
        }
        else
        {
            // Ask Catalog whether each line can be sold and what it costs (published by TransactionBehavior)
            var orderStockItems = message.OrderItems
                .Select(i => new OrderStockItem(i.ProductId, i.Units));

            // The promo code travels with the check so Catalog can redeem it
            // against who is ordering: the account, or the guest device. The
            // lines are the order's own, merged and numbered (HiLo gave them
            // ids at Add), so Catalog's prices come back to the right line.
            var awaitingValidationEvent = new OrderStatusChangedToAwaitingValidationIntegrationEvent(
                order.Id,
                orderStockItems,
                message.BranchId,
                order.PromoCode,
                string.IsNullOrEmpty(message.UserId) ? order.GuestId : message.UserId,
                itemsTotal)
            {
                Lines = order.OrderItems
                    .Select(i => new OrderValidationLine(i.Id, i.ProductId, i.Units, i.UnitPrice, i.OptionIds))
                    .ToList(),
                PlacedAt = order.OrderDate,
                // Talabat charged the customer its own prices; the menu does not judge them
                PriceCheck = order.Source != OrderSource.Talabat,
            };

            await _orderingIntegrationEventService.AddAndSaveEventAsync(awaitingValidationEvent);
        }

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
