#nullable enable
using Ninja.EventBus.Abstractions;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.Infrastructure;
using Ninja.Sales.Infrastructure.Projections;

namespace Ninja.Sales.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// Keeps Sales' copy of the places: an upsert keyed by place id, guarded against out-of-order
/// delivery — an event older than what the row already holds is dropped. A deleted place loses
/// its row. A bill already open keeps the name it was opened with.
/// </summary>
public class PlaceUpdatedIntegrationEventHandler(
    SalesContext context,
    ILogger<PlaceUpdatedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<PlaceUpdatedIntegrationEvent>
{
    public async Task Handle(PlaceUpdatedIntegrationEvent @event)
    {
        var row = await context.Places.FindAsync(@event.PlaceId);

        if (row is not null && @event.CreationDate <= row.UpdatedAt)
        {
            logger.LogInformation(
                "Place {PlaceId} event from {EventAt} is not newer than the copy ({RowAt}) - skipped",
                @event.PlaceId, @event.CreationDate, row.UpdatedAt);
            return;
        }

        if (@event.Deleted)
        {
            if (row is not null)
            {
                context.Places.Remove(row);
                await context.SaveChangesAsync();
            }
            return;
        }

        if (row is null)
        {
            row = new Place { PlaceId = @event.PlaceId };
            context.Places.Add(row);
        }

        row.Kind = @event.Kind;
        row.Name = new LocalizedText(@event.Name.En, @event.Name.Ar);
        row.BranchId = @event.BranchId;
        row.UpdatedAt = @event.CreationDate;

        await context.SaveChangesAsync();
    }
}
