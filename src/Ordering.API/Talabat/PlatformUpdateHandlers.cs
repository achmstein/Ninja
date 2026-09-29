#nullable enable
using Order = Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order;

namespace Ninja.Ordering.API.Talabat;

/// <summary>
/// What a delivery platform hears when its order moves here: accepted when
/// staff confirm it, rejected when it is cancelled on our side (with the
/// reason), prepared when the kitchen marks it ready for the platform's rider.
/// Each is queued in the same transaction as the move itself, so it is sent
/// only once the move is saved and never lost to a failed call.
/// </summary>
public class PlatformUpdateHandlers(OrderingContext context, IOrderRepository orders)
    : INotificationHandler<OrderStatusChangedToConfirmedDomainEvent>,
      INotificationHandler<OrderCancelledDomainEvent>,
      INotificationHandler<OrderReadyChangedDomainEvent>
{
    public async Task Handle(OrderStatusChangedToConfirmedDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        var order = await orders.GetAsync(domainEvent.OrderId);
        if (order?.Platform is not { } platform)
            return;

        var now = DateTime.UtcNow;
        Queue(order, PlatformUpdateKind.Accepted, platform.AcceptedUrl, acceptanceTime: AcceptanceTime(platform, now));
    }

    public Task Handle(OrderCancelledDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        var order = domainEvent.Order;

        // The platform cancelling it is not ours to report back
        if (order.Platform is { CancelledAt: null } platform)
        {
            Queue(order, PlatformUpdateKind.Rejected, platform.RejectedUrl, reason: platform.RejectReason ?? PlatformRejectReasons.TooBusy);
        }
        return Task.CompletedTask;
    }

    public async Task Handle(OrderReadyChangedDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        // Only the platform's rider waits on "prepared"; bringing a card back unsays nothing
        if (!domainEvent.IsReady)
            return;

        var order = await orders.GetAsync(domainEvent.OrderId);
        if (order?.Platform is { Expedition: PlatformExpedition.PlatformDelivery, CancelledAt: null } platform
            && !await context.PlatformUpdates.AnyAsync(u => u.OrderId == order.Id && u.Kind == PlatformUpdateKind.Prepared, cancellationToken))
        {
            Queue(order, PlatformUpdateKind.Prepared, platform.PreparedUrl);
        }
    }

    private void Queue(Order order, PlatformUpdateKind kind, string? url, string? reason = null, DateTime? acceptanceTime = null)
    {
        // No address for it means the platform does not take this change for this order
        if (string.IsNullOrWhiteSpace(url))
            return;

        var now = DateTime.UtcNow;
        context.PlatformUpdates.Add(new PlatformUpdate
        {
            OrderId = order.Id,
            Platform = order.Platform!.Name,
            Token = order.Platform.Token,
            Kind = kind,
            Url = url,
            Reason = reason,
            AcceptanceTime = acceptanceTime,
            CreatedAt = now,
            NextAttemptAt = now,
        });
    }

    /// <summary>
    /// When it will be ready, as Talabat asks for it: the rider's pickup time
    /// for its own riders, the customer's due time otherwise — never sooner
    /// than a few minutes out, which Talabat refuses.
    /// </summary>
    public static DateTime AcceptanceTime(PlatformOrder platform, DateTime now)
    {
        var wanted = platform.Expedition switch
        {
            PlatformExpedition.PlatformDelivery => platform.RiderPickupAt ?? platform.DueAt,
            _ => platform.DueAt,
        } ?? now.AddMinutes(platform.Expedition == PlatformExpedition.VendorDelivery ? 45 : 15);

        var earliest = now.AddMinutes(3);
        return wanted < earliest ? earliest : wanted;
    }
}
