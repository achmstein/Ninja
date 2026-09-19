#nullable enable
namespace Ninja.Ordering.API.Application.Commands;

/// <summary>
/// Handler for rating confirmed orders.
/// </summary>
public class RateOrderCommandHandler : IRequestHandler<RateOrderCommand, bool>
{
    private readonly IOrderRepository _orderRepository;
    private readonly IIdentityService _identityService;
    private readonly ILogger<RateOrderCommandHandler> _logger;

    public RateOrderCommandHandler(
        IOrderRepository orderRepository,
        IIdentityService identityService,
        ILogger<RateOrderCommandHandler> logger)
    {
        _orderRepository = orderRepository ?? throw new ArgumentNullException(nameof(orderRepository));
        _identityService = identityService ?? throw new ArgumentNullException(nameof(identityService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(RateOrderCommand command, CancellationToken cancellationToken)
    {
        var order = await _orderRepository.GetAsync(command.OrderId);

        if (order == null)
        {
            throw new OrderingDomainException($"Order {command.OrderId} not found.");
        }

        // Verify order belongs to the authenticated user
        var userId = _identityService.GetUserIdentity();
        if (order.Buyer == null || order.Buyer.IdentityGuid != userId)
        {
            throw new OrderingDomainException($"User {userId} is not authorized to rate order {command.OrderId}.");
        }

        // Check if order can be rated (must be confirmed)
        if (!order.CanBeRated())
        {
            throw new OrderingDomainException($"Order {command.OrderId} cannot be rated. Only confirmed orders can be rated.");
        }

        _logger.LogInformation("Rating Order {OrderId} with {RatingValue} stars", command.OrderId, command.RatingValue);

        // Create new rating or update existing rating
        if (order.HasRating())
        {
            // Update existing rating
            order.Rating!.Update(command.RatingValue, command.Comment);
        }
        else
        {
            // Create new rating
            var rating = new OrderRating(command.OrderId, command.RatingValue, command.Comment);
            _orderRepository.AddRating(rating);
        }

        return await _orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}

/// <summary>
/// Idempotent command handler for RateOrderCommand
/// </summary>
public class RateOrderIdentifiedCommandHandler : IdentifiedCommandHandler<RateOrderCommand, bool>
{
    public RateOrderIdentifiedCommandHandler(
        IMediator mediator,
        IRequestManager requestManager,
        ILogger<IdentifiedCommandHandler<RateOrderCommand, bool>> logger)
        : base(mediator, requestManager, logger)
    {
    }

    protected override bool CreateResultForDuplicateRequest()
    {
        return true; // Ignore duplicate requests for rating order.
    }
}
