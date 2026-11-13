#nullable enable
using Ninja.Ordering.Infrastructure.Projections;

namespace Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// Keeps Ordering's copy of a branch's named delivery areas: the event carries the whole list, so the
/// branch's rows are replaced together. A list older than the one held is dropped; an emptied list
/// leaves nothing to compare with, and the next save is simply newer.
/// </summary>
public class BranchDeliveryZonesChangedIntegrationEventHandler(
    OrderingContext context,
    ILogger<BranchDeliveryZonesChangedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<BranchDeliveryZonesChangedIntegrationEvent>
{
    public async Task Handle(BranchDeliveryZonesChangedIntegrationEvent @event)
    {
        var held = await context.BranchDeliveryZones.Where(z => z.BranchId == @event.BranchId).ToListAsync();
        if (held.Count > 0 && held.Max(z => z.Version) >= @event.Version)
        {
            logger.LogInformation("Branch {BranchId} delivery areas event {Version} is not newer than the list held - skipped", @event.BranchId, @event.Version);
            return;
        }

        context.BranchDeliveryZones.RemoveRange(held);
        // An area that moved branch keeps its id: the old row goes with this save, whichever branch held it
        var ids = @event.Zones.Select(z => z.Id).ToList();
        context.BranchDeliveryZones.RemoveRange(await context.BranchDeliveryZones.Where(z => z.BranchId != @event.BranchId && ids.Contains(z.Id)).ToListAsync());
        await context.SaveChangesAsync();

        context.BranchDeliveryZones.AddRange(@event.Zones.Select(z => new BranchDeliveryZone
        {
            Id = z.Id,
            BranchId = @event.BranchId,
            NameEn = z.Name?.En,
            NameAr = z.Name?.Ar,
            Fee = z.Fee,
            MinimumOrder = z.MinimumOrder,
            EtaMinutes = z.EtaMinutes,
            IsOn = z.IsOn,
            Shape = z.Shape is { Length: >= 3 } shape ? shape : null,
            SortOrder = z.SortOrder,
            Version = @event.Version,
        }));
        await context.SaveChangesAsync();

        logger.LogInformation("Branch {BranchId} delivery areas: {Count} kept", @event.BranchId, @event.Zones.Count);
    }
}
