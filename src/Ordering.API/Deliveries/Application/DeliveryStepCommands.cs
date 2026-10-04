#nullable enable
using Order = Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order;

namespace Ninja.Ordering.API.Deliveries;

/// <summary>What became of a step: done, or the order is not there for this caller.</summary>
public enum DeliveryStepResult
{
    Done,

    /// <summary>No such delivery at this branch.</summary>
    NotFound,

    /// <summary>A rider acting on a delivery someone else has, or on a step only the till takes.</summary>
    NotYours,
}

/// <summary>One step of a delivery at a branch, from the till or the rider app.</summary>
public abstract record DeliveryStepCommand(int OrderId, int BranchId) : IRequest<DeliveryStepResult>;

/// <summary>The till gives it to a rider, or to another before it leaves. The rider is found here, never trusted from the request.</summary>
public record AssignDeliveryRiderCommand(int OrderId, int BranchId, string RiderUserId) : DeliveryStepCommand(OrderId, BranchId);

/// <summary>The till takes it back from its rider before it leaves.</summary>
public record UnassignDeliveryRiderCommand(int OrderId, int BranchId) : DeliveryStepCommand(OrderId, BranchId);

/// <summary>It left with its rider: said by the rider, or by the till for them.</summary>
public record MarkDeliveryOutCommand(int OrderId, int BranchId) : DeliveryStepCommand(OrderId, BranchId);

/// <summary>The customer has it: said by the rider, or by the till for them.</summary>
public record MarkDeliveryDeliveredCommand(int OrderId, int BranchId) : DeliveryStepCommand(OrderId, BranchId);

/// <summary>It could not be handed over, and why: said by the rider, or by the till for them.</summary>
public record MarkDeliveryFailedCommand(int OrderId, int BranchId, string? Reason) : DeliveryStepCommand(OrderId, BranchId);

/// <summary>The rider brought it back to the branch: the till says so.</summary>
public record MarkDeliveryReturnedCommand(int OrderId, int BranchId) : DeliveryStepCommand(OrderId, BranchId);

/// <summary>The rider handed in what they collected: the till counts it in, which settles the bill.</summary>
public record HandInDeliveryCashCommand(int OrderId, int BranchId, decimal Amount) : DeliveryStepCommand(OrderId, BranchId);

/// <summary>
/// The steps' common ground: the delivery is found at the caller's branch
/// (another branch's is as good as missing), and who may take the step is
/// decided here from the caller's own claims — the till moves any delivery
/// at its branch, a rider only their own and only the rider's steps. The
/// aggregate decides what may follow what; a repeated tap is a no-op there.
/// </summary>
public abstract class DeliveryStepHandler<TCommand>(
    IOrderRepository orderRepository,
    IIdentityService identity,
    ILogger logger) : IRequestHandler<TCommand, DeliveryStepResult>
    where TCommand : DeliveryStepCommand
{
    /// <summary>Only the till takes this step (give, take back, brought back, cash in).</summary>
    protected virtual bool TillOnly => false;

    public async Task<DeliveryStepResult> Handle(TCommand command, CancellationToken cancellationToken)
    {
        var order = await orderRepository.GetAsync(command.OrderId);
        if (order is null || order.BranchId != command.BranchId || order.Delivery is null)
        {
            return DeliveryStepResult.NotFound;
        }

        var byTill = identity.RunsTheTill();
        if (!byTill && (TillOnly || order.Delivery.RiderUserId != identity.GetUserIdentity()))
        {
            return DeliveryStepResult.NotYours;
        }

        await ApplyAsync(order, command);

        logger.LogInformation(
            "Delivery of order {OrderId}: {Step} by {Actor} ({By})",
            order.Id, typeof(TCommand).Name, identity.GetUserIdentity(), byTill ? "till" : "rider");

        await orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return DeliveryStepResult.Done;
    }

    protected abstract Task ApplyAsync(Order order, TCommand command);
}

public class AssignDeliveryRiderCommandHandler(
    IOrderRepository orderRepository,
    IIdentityService identity,
    IRiderDirectory riders,
    ILogger<AssignDeliveryRiderCommandHandler> logger) : DeliveryStepHandler<AssignDeliveryRiderCommand>(orderRepository, identity, logger)
{
    protected override bool TillOnly => true;

    protected override async Task ApplyAsync(Order order, AssignDeliveryRiderCommand command)
    {
        var rider = await riders.FindAsync(command.RiderUserId, command.BranchId)
            ?? throw new OrderingDomainException("That isn't one of this branch's riders.", DeliveryErrors.RiderUnknown);
        order.AssignRider(rider.UserId, rider.Name);
    }
}

public class UnassignDeliveryRiderCommandHandler(
    IOrderRepository orderRepository, IIdentityService identity, ILogger<UnassignDeliveryRiderCommandHandler> logger)
    : DeliveryStepHandler<UnassignDeliveryRiderCommand>(orderRepository, identity, logger)
{
    protected override bool TillOnly => true;

    protected override Task ApplyAsync(Order order, UnassignDeliveryRiderCommand command)
    {
        order.UnassignRider();
        return Task.CompletedTask;
    }
}

public class MarkDeliveryOutCommandHandler(
    IOrderRepository orderRepository, IIdentityService identity, ILogger<MarkDeliveryOutCommandHandler> logger)
    : DeliveryStepHandler<MarkDeliveryOutCommand>(orderRepository, identity, logger)
{
    protected override Task ApplyAsync(Order order, MarkDeliveryOutCommand command)
    {
        order.MarkOutForDelivery();
        return Task.CompletedTask;
    }
}

public class MarkDeliveryDeliveredCommandHandler(
    IOrderRepository orderRepository, IIdentityService identity, ILogger<MarkDeliveryDeliveredCommandHandler> logger)
    : DeliveryStepHandler<MarkDeliveryDeliveredCommand>(orderRepository, identity, logger)
{
    protected override Task ApplyAsync(Order order, MarkDeliveryDeliveredCommand command)
    {
        order.MarkDelivered();
        return Task.CompletedTask;
    }
}

public class MarkDeliveryFailedCommandHandler(
    IOrderRepository orderRepository, IIdentityService identity, ILogger<MarkDeliveryFailedCommandHandler> logger)
    : DeliveryStepHandler<MarkDeliveryFailedCommand>(orderRepository, identity, logger)
{
    protected override Task ApplyAsync(Order order, MarkDeliveryFailedCommand command)
    {
        order.MarkDeliveryFailed(command.Reason ?? string.Empty);
        return Task.CompletedTask;
    }
}

public class MarkDeliveryReturnedCommandHandler(
    IOrderRepository orderRepository, IIdentityService identity, ILogger<MarkDeliveryReturnedCommandHandler> logger)
    : DeliveryStepHandler<MarkDeliveryReturnedCommand>(orderRepository, identity, logger)
{
    protected override bool TillOnly => true;

    protected override Task ApplyAsync(Order order, MarkDeliveryReturnedCommand command)
    {
        order.MarkDeliveryReturned();
        return Task.CompletedTask;
    }
}

public class HandInDeliveryCashCommandHandler(
    IOrderRepository orderRepository, IIdentityService identity, ILogger<HandInDeliveryCashCommandHandler> logger)
    : DeliveryStepHandler<HandInDeliveryCashCommand>(orderRepository, identity, logger)
{
    protected override bool TillOnly => true;

    protected override Task ApplyAsync(Order order, HandInDeliveryCashCommand command)
    {
        order.MarkDeliveryCashHandedIn(command.Amount);
        return Task.CompletedTask;
    }
}
