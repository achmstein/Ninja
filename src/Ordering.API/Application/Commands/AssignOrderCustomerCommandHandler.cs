#nullable enable
namespace Ninja.Ordering.API.Application.Commands;

/// <summary>
/// Handler for assigning a customer to an order after it was placed.
/// </summary>
public class AssignOrderCustomerCommandHandler : IRequestHandler<AssignOrderCustomerCommand, bool>
{
    private readonly IOrderRepository _orderRepository;
    private readonly IBuyerRepository _buyerRepository;
    private readonly ILogger<AssignOrderCustomerCommandHandler> _logger;

    public AssignOrderCustomerCommandHandler(
        IOrderRepository orderRepository,
        IBuyerRepository buyerRepository,
        ILogger<AssignOrderCustomerCommandHandler> logger)
    {
        _orderRepository = orderRepository ?? throw new ArgumentNullException(nameof(orderRepository));
        _buyerRepository = buyerRepository ?? throw new ArgumentNullException(nameof(buyerRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(AssignOrderCustomerCommand command, CancellationToken cancellationToken)
    {
        var order = await _orderRepository.GetAsync(command.OrderId);

        if (order == null)
        {
            _logger.LogWarning("Order {OrderId} not found for customer assignment", command.OrderId);
            return false;
        }

        // Whose it was, if anyone's: the order holds only the row id, and
        // Loyalty needs the identity losing the points as well as the one
        // gaining them — resolved here, since the event goes out before the save
        string? previousBuyerIdentityGuid = null;

        if (order.BuyerId is int previousBuyerId)
        {
            var previous = await _buyerRepository.FindByIdAsync(previousBuyerId);
            previousBuyerIdentityGuid = previous?.IdentityGuid;
        }

        // The account, when there is one, is a Buyer — found or created the
        // way a fresh order's is, so a first-time customer named at the
        // counter gets a row like anyone who ordered from the app
        Buyer? buyer = null;

        if (!string.IsNullOrWhiteSpace(command.CustomerUserId))
        {
            buyer = await _buyerRepository.FindAsync(command.CustomerUserId);

            if (buyer is null)
            {
                buyer = _buyerRepository.Add(new Buyer(command.CustomerUserId, command.CustomerName));

                // Saved before the order takes its id, as the order-started
                // handler does: an unsaved buyer has no id to take yet
                await _buyerRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
            }
            else if (buyer.Name != command.CustomerName)
            {
                buyer.UpdateName(command.CustomerName);
            }
        }

        _logger.LogInformation(
            "Assigning customer {Customer} to order {OrderId} (was {Previous})",
            buyer?.IdentityGuid ?? command.CustomerName,
            command.OrderId,
            previousBuyerIdentityGuid ?? "nobody");

        order.AssignCustomer(command.CustomerName, buyer, previousBuyerIdentityGuid);

        return await _orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}

/// <summary>
/// Idempotent command handler for AssignOrderCustomerCommand
/// </summary>
public class AssignOrderCustomerIdentifiedCommandHandler : IdentifiedCommandHandler<AssignOrderCustomerCommand, bool>
{
    public AssignOrderCustomerIdentifiedCommandHandler(
        IMediator mediator,
        IRequestManager requestManager,
        ILogger<IdentifiedCommandHandler<AssignOrderCustomerCommand, bool>> logger)
        : base(mediator, requestManager, logger)
    {
    }

    protected override bool CreateResultForDuplicateRequest()
    {
        return true; // Ignore duplicate requests for assigning a customer.
    }
}
