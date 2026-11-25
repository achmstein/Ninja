#nullable enable
using Ninja.Ordering.Infrastructure.Deliveries;
using Order = Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order;

namespace Ninja.Ordering.API.Deliveries;

/// <summary>The till gives a delivery to one of the business's courier companies instead of a rider, or changes who it sent.</summary>
public record AssignDeliveryCourierCommand(int OrderId, int BranchId, int ProviderId, string? CourierName, string? CourierPhone, decimal? Fee)
    : DeliveryStepCommand(OrderId, BranchId);

/// <summary>The courier handed it over and collected this much: said by the till for a manual courier.</summary>
public record MarkCourierDeliveredCommand(int OrderId, int BranchId, decimal Collected) : DeliveryStepCommand(OrderId, BranchId);

public class AssignDeliveryCourierCommandHandler(
    IOrderRepository orderRepository,
    IIdentityService identity,
    OrderingContext context,
    ILogger<AssignDeliveryCourierCommandHandler> logger) : DeliveryStepHandler<AssignDeliveryCourierCommand>(orderRepository, identity, logger)
{
    protected override bool TillOnly => true;

    protected override async Task ApplyAsync(Order order, AssignDeliveryCourierCommand command)
    {
        // Only a company the business lists and has not switched off; its name and usual fee are the business's own record
        var provider = await context.CourierProviders.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == command.ProviderId && p.IsActive)
            ?? throw new OrderingDomainException("That isn't one of the business's courier companies.", DeliveryErrors.CourierUnknown);

        order.AssignCourier(provider.Id, provider.Name, command.CourierName, command.CourierPhone, command.Fee ?? provider.DefaultFee);
    }
}

public class MarkCourierDeliveredCommandHandler(
    IOrderRepository orderRepository, IIdentityService identity, ILogger<MarkCourierDeliveredCommandHandler> logger)
    : DeliveryStepHandler<MarkCourierDeliveredCommand>(orderRepository, identity, logger)
{
    protected override bool TillOnly => true;

    protected override Task ApplyAsync(Order order, MarkCourierDeliveredCommand command)
    {
        order.MarkCourierDelivered(command.Collected);
        return Task.CompletedTask;
    }
}

/// <summary>The courier companies the business lists, as the owner keeps them in admin.</summary>
public static class CourierProviders
{
    public static CourierProviderView View(CourierCompany p) => new(p.Id, p.Name, p.Phone, p.DefaultFee, p.IsActive);

    /// <summary>The words of a request, tidied and checked against the columns; throws what the API answers 400.</summary>
    public static (string Name, string? Phone, decimal? Fee) Read(CourierProviderRequest request)
    {
        var name = request.Name?.Trim();
        if (string.IsNullOrEmpty(name))
            throw new OrderingDomainException("Give the courier company a name.", DeliveryErrors.CourierUnknown);
        if (name.Length > DeliveryLimits.CourierProvider)
            throw new OrderingDomainException($"The name is longer than {DeliveryLimits.CourierProvider} characters.", DeliveryErrors.TooLong);
        var phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        if (phone is { Length: > DeliveryLimits.Phone })
            throw new OrderingDomainException($"The phone is longer than {DeliveryLimits.Phone} characters.", DeliveryErrors.TooLong);
        if (request.DefaultFee is < 0)
            throw new OrderingDomainException("A courier's fee can't be below zero.", DeliveryErrors.CourierFeeInvalid);
        return (name, phone, request.DefaultFee);
    }
}
