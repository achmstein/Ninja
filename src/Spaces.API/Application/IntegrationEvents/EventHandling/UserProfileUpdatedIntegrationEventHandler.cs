using Ninja.EventBus.Abstractions;
using Ninja.Spaces.API.Application.IntegrationEvents.Events;
using Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Ninja.Spaces.Domain.AggregatesModel.StayAggregate;
using SpacesContext = Ninja.Spaces.Infrastructure.SpacesContext;

namespace Ninja.Spaces.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// A customer renamed themselves: the reservations still to come (or sat on
/// now) and the stays still running say the new name, as owner or as one of
/// the party. Reservations and stays that are over keep the name they had.
/// Renaming raises no domain event, so a plain save is enough. Idempotent:
/// the same name again changes nothing.
/// </summary>
public class UserProfileUpdatedIntegrationEventHandler(
    SpacesContext context,
    ILogger<UserProfileUpdatedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<UserProfileUpdatedIntegrationEvent>
{
    public async Task Handle(UserProfileUpdatedIntegrationEvent @event)
    {
        var userId = @event.UserId;
        var name = @event.DisplayName;
        if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(name))
        {
            return;
        }

        var reservations = await context.Reservations
            .Where(r => r.CustomerId == userId
                && (r.Status == ReservationStatus.Requested || r.Status == ReservationStatus.Confirmed || r.Status == ReservationStatus.Seated))
            .ToListAsync();

        var stays = await context.Stays
            .Include(s => s.Members)
            .Where(s => s.Status == StayStatus.Running
                && (s.CustomerId == userId || s.Members.Any(m => m.CustomerId == userId)))
            .ToListAsync();

        var renamed = reservations.Count(r => r.RenameCustomer(userId, name))
            + stays.Count(s => s.RenameCustomer(userId, name));

        if (renamed == 0)
        {
            return;
        }

        await context.SaveChangesAsync();
        logger.LogInformation("Renamed user {UserId} to {Name} on {Count} open reservation(s) and running stay(s)", userId, name, renamed);
    }
}
