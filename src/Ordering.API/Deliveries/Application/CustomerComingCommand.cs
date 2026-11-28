#nullable enable
namespace Ninja.Ordering.API.Deliveries;

/// <summary>
/// The customer says they are coming down to meet the rider. Theirs to say
/// only for their own order (by account, or by the device a guest ordered
/// from), only while it is on the way, and once: a second tap changes nothing.
/// </summary>
public record CustomerComingCommand(int OrderId, string? UserId, string? GuestId) : IRequest<DeliveryStepResult>;

public class CustomerComingCommandHandler(
    IOrderRepository orderRepository,
    ILogger<CustomerComingCommandHandler> logger) : IRequestHandler<CustomerComingCommand, DeliveryStepResult>
{
    public async Task<DeliveryStepResult> Handle(CustomerComingCommand command, CancellationToken cancellationToken)
    {
        var order = await orderRepository.GetAsync(command.OrderId);
        if (order?.Delivery is null)
            return DeliveryStepResult.NotFound;

        // Order numbers run in sequence: somebody else's is as good as missing
        var theirs = !string.IsNullOrEmpty(command.UserId)
            ? order.Buyer?.IdentityGuid == command.UserId
            : !string.IsNullOrEmpty(command.GuestId) && order.GuestId == command.GuestId;
        if (!theirs)
            return DeliveryStepResult.NotFound;

        order.MarkCustomerComing();
        logger.LogInformation("Delivery of order {OrderId}: the customer is coming down", order.Id);
        await orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return DeliveryStepResult.Done;
    }
}
