#nullable enable
namespace Ninja.Ordering.API.Application.Commands;

public enum DeliveryAction
{
    /// <summary>The till gives it to a rider, or to another before it leaves.</summary>
    AssignRider,

    /// <summary>The till takes it back from its rider before it leaves.</summary>
    UnassignRider,

    /// <summary>The rider left with it.</summary>
    Out,

    /// <summary>The customer has it.</summary>
    Delivered,

    /// <summary>The till took the rider's cash; the bill settles with it.</summary>
    CashIn,
}

public enum DeliveryActionResult
{
    Done,
    NotFound,

    /// <summary>A rider acting on a delivery someone else has.</summary>
    NotYours,
}

/// <summary>
/// One step of a delivery, from the till or the rider app. A rider may only
/// move their own deliveries (<paramref name="RiderOnly"/>); the till may
/// move any at its branch. The aggregate decides what may follow what, and
/// a repeated tap is a no-op there.
/// </summary>
[DataContract]
public record DeliveryActionCommand(
    [property: DataMember] int OrderId,
    [property: DataMember] int BranchId,
    [property: DataMember] DeliveryAction Action,
    [property: DataMember] string? ActorUserId,
    [property: DataMember] bool RiderOnly,
    [property: DataMember] string? RiderUserId = null,
    [property: DataMember] string? RiderName = null) : IRequest<DeliveryActionResult>;

public class DeliveryActionCommandHandler(
    IOrderRepository orderRepository,
    ILogger<DeliveryActionCommandHandler> logger) : IRequestHandler<DeliveryActionCommand, DeliveryActionResult>
{
    public async Task<DeliveryActionResult> Handle(DeliveryActionCommand command, CancellationToken cancellationToken)
    {
        var order = await orderRepository.GetAsync(command.OrderId);

        // Another branch's order is as good as missing from here
        if (order is null || order.BranchId != command.BranchId || order.Delivery is null)
        {
            return DeliveryActionResult.NotFound;
        }

        if (command.RiderOnly && order.Delivery.RiderUserId != command.ActorUserId)
        {
            return DeliveryActionResult.NotYours;
        }

        logger.LogInformation("Delivery of order {OrderId}: {Action} by {Actor}", order.Id, command.Action, command.ActorUserId);

        switch (command.Action)
        {
            case DeliveryAction.AssignRider:
                order.AssignRider(command.RiderUserId ?? string.Empty, command.RiderName ?? string.Empty);
                break;
            case DeliveryAction.UnassignRider:
                order.UnassignRider();
                break;
            case DeliveryAction.Out:
                order.MarkOutForDelivery();
                break;
            case DeliveryAction.Delivered:
                order.MarkDelivered();
                break;
            case DeliveryAction.CashIn:
                order.MarkDeliveryCashHandedIn();
                break;
        }

        await orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return DeliveryActionResult.Done;
    }
}
