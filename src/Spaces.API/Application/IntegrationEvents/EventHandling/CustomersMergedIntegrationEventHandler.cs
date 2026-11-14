using Ninja.EventBus.Abstractions;
using Ninja.Spaces.API.Application.IntegrationEvents.Events;
using SpacesContext = Ninja.Spaces.Infrastructure.SpacesContext;

namespace Ninja.Spaces.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// The merged-away account's reservations, stays and places in a room's
/// roster are the kept customer's, under their name. Where both were in one
/// room, the kept one's place stands and the other's goes: a person is in a
/// room once. Each statement finds nothing to do the second time.
/// </summary>
public class CustomersMergedIntegrationEventHandler(
    SpacesContext context,
    ILogger<CustomersMergedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<CustomersMergedIntegrationEvent>
{
    public async Task Handle(CustomersMergedIntegrationEvent @event)
    {
        var (from, into, name) = (@event.FromUserId, @event.IntoUserId, @event.IntoDisplayName);
        if (string.IsNullOrWhiteSpace(from) || string.IsNullOrWhiteSpace(into) || from == into)
            return;
        var named = !string.IsNullOrWhiteSpace(name);

        var reservations = await context.Reservations.IgnoreQueryFilters().Where(r => r.CustomerId == from)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.CustomerId, into).SetProperty(r => r.CustomerName, r => named ? name : r.CustomerName));
        var stays = await context.Stays.IgnoreQueryFilters().Where(s => s.CustomerId == from)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.CustomerId, into).SetProperty(x => x.CustomerName, x => named ? name : x.CustomerName));

        // A stay holds a customer once: where the kept one is already in the room, the other's place is dropped
        await context.StayMembers.IgnoreQueryFilters()
            .Where(m => m.CustomerId == from && context.StayMembers.IgnoreQueryFilters().Any(o => o.StayId == m.StayId && o.CustomerId == into))
            .ExecuteDeleteAsync();
        var members = await context.StayMembers.IgnoreQueryFilters().Where(m => m.CustomerId == from)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.CustomerId, into).SetProperty(m => m.CustomerName, m => named ? name : m.CustomerName));

        logger.LogInformation("Merged user {From} into {Into}: {Reservations} reservation(s), {Stays} stay(s), {Members} place(s) in a room",
            from, into, reservations, stays, members);
    }
}
