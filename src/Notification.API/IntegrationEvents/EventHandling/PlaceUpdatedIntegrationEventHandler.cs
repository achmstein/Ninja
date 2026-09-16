using Chillax.Notification.API.IntegrationEvents.Events;
using Chillax.Notification.API.Model;

namespace Chillax.Notification.API.IntegrationEvents.EventHandling;

/// <summary>
/// Keeps Notification's projection of the places: an upsert keyed by place
/// id, guarded against out-of-order delivery. A deleted place loses its row.
/// </summary>
public class PlaceUpdatedIntegrationEventHandler(
    NotificationContext context,
    ILogger<PlaceUpdatedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<PlaceUpdatedIntegrationEvent>
{
    public async Task Handle(PlaceUpdatedIntegrationEvent @event)
    {
        var row = await context.Places.FindAsync(@event.PlaceId);

        if (row is not null && @event.CreationDate <= row.UpdatedAt)
        {
            logger.LogInformation("Place {PlaceId} event from {EventAt} is not newer than the projection - skipped", @event.PlaceId, @event.CreationDate);
            return;
        }

        if (@event.Deleted)
        {
            if (row is not null)
            {
                context.Places.Remove(row);
                await context.SaveChangesAsync();
            }
            logger.LogInformation("Place {PlaceId} projection dropped", @event.PlaceId);
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
        row.IsTimed = @event.IsTimed;
        row.HasOptions = @event.HasOptions;
        row.IsActive = @event.IsActive;
        // LEGACY(places): projects the old room/table ids — remove when the printed room/table stickers are reprinted with /p/{id}.
        row.LegacyRoomId = @event.LegacyRoomId;
        row.LegacyTableId = @event.LegacyTableId;
        row.UpdatedAt = @event.CreationDate;

        await context.SaveChangesAsync();

        logger.LogInformation("Place {PlaceId} projection: {Kind} {Name}, timed {Timed}, options {Options}, active {Active}",
            @event.PlaceId, @event.Kind, @event.Name.En, @event.IsTimed, @event.HasOptions, @event.IsActive);
    }
}
