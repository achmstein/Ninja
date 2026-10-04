#nullable enable
namespace Ninja.Ordering.API.Deliveries;

/// <summary>
/// Turns a delivery's move into the integration event the rider app, the
/// customer, the till and Sales each listen for, and into a row of the
/// delivery's history (who had it, what was done, by whom). Both are written
/// in the step's own transaction: the domain event is dispatched before the
/// order is saved. Logs ids and the stage only: the customer's address and
/// phone stay out of the logs.
/// </summary>
public class OrderDeliveryChangedDomainEventHandler(
    IBuyerRepository buyerRepository,
    IOrderingIntegrationEventService orderingIntegrationEventService,
    OrderingContext context,
    IIdentityService identity,
    ILogger<OrderDeliveryChangedDomainEventHandler> logger)
    : INotificationHandler<OrderDeliveryChangedDomainEvent>
{
    /// <summary>The history row a step makes; the order is the delivery as it stands after it.</summary>
    public static DeliveryAssignment HistoryRow(OrderDeliveryChangedDomainEvent step, DateTime at, string? actorUserId, string? actorName, bool byTill)
    {
        var order = step.Order;
        var delivery = order.Delivery!;
        var action = step.CashHandedIn ? DeliveryAction.CashIn
            : step.Stage switch
            {
                DeliveryStage.Waiting => DeliveryAction.Unassigned,
                DeliveryStage.Assigned => step.PreviousRiderUserId is null ? DeliveryAction.Assigned : DeliveryAction.Reassigned,
                DeliveryStage.OnTheWay => DeliveryAction.Out,
                DeliveryStage.Delivered => DeliveryAction.Delivered,
                DeliveryStage.Failed => DeliveryAction.Failed,
                _ => DeliveryAction.Returned,
            };

        return new DeliveryAssignment
        {
            OrderId = order.Id,
            BranchId = order.BranchId,
            RiderUserId = delivery.RiderUserId,
            RiderName = delivery.RiderName,
            PreviousRiderUserId = step.PreviousRiderUserId,
            Action = action,
            At = at,
            ActorUserId = actorUserId,
            ActorName = actorName is { Length: > 200 } ? actorName[..200] : actorName,
            ActorRole = byTill ? "Till" : "Rider",
            CashCollected = action == DeliveryAction.CashIn ? delivery.CashCollected : null,
            Reason = action == DeliveryAction.Failed ? delivery.FailureReason : null,
        };
    }

    public async Task Handle(OrderDeliveryChangedDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        var order = domainEvent.Order;
        var delivery = order.Delivery!;

        logger.LogInformation(
            "Order {OrderId} delivery -> {Stage} (version {Version}, cash in {CashIn})",
            order.Id, domainEvent.Stage, delivery.Version, domainEvent.CashHandedIn);

        // Saved with the order: the step and its history stand or fall together
        context.DeliveryAssignments.Add(HistoryRow(
            domainEvent, DateTime.UtcNow, identity.GetUserIdentity(), identity.GetUserName(), identity.RunsTheTill()));

        var buyer = order.BuyerId.HasValue
            ? await buyerRepository.FindByIdAsync(order.BuyerId.Value)
            : null;

        await orderingIntegrationEventService.AddAndSaveEventAsync(new OrderDeliveryChangedIntegrationEvent(
            order.Id,
            order.BranchId,
            domainEvent.Stage.ToString(),
            delivery.RiderUserId,
            delivery.RiderName,
            domainEvent.PreviousRiderUserId,
            buyer?.IdentityGuid,
            order.GuestId,
            domainEvent.CashHandedIn,
            order.GetTotal(),
            delivery.Address,
            delivery.Version,
            delivery.CashCollected));
    }
}
