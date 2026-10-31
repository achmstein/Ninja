#nullable enable
using Ninja.EventBus.Abstractions;
using Ninja.Sales.API.Application.IntegrationEvents.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// A customer renamed themselves: their lines on the bills still open say the
/// new name, so the till groups and settles their share under it. Settled and
/// voided bills, payments, credit notes and tab payments keep the names they
/// were printed with: those are receipts. Idempotent: the same name again
/// changes nothing.
/// </summary>
public class UserProfileUpdatedIntegrationEventHandler(
    ITicketRepository ticketRepository,
    SalesTransaction transaction,
    ILogger<UserProfileUpdatedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<UserProfileUpdatedIntegrationEvent>
{
    // One transaction per event, its floor nudge published after the commit
    public Task Handle(UserProfileUpdatedIntegrationEvent @event)
        => transaction.RunAsync(nameof(UserProfileUpdatedIntegrationEvent), () => Rename(@event));

    private async Task Rename(UserProfileUpdatedIntegrationEvent @event)
    {
        if (string.IsNullOrWhiteSpace(@event.UserId) || string.IsNullOrWhiteSpace(@event.DisplayName))
        {
            return;
        }

        var tickets = await ticketRepository.FindOpenWithCustomerAsync(@event.UserId);
        var renamed = tickets.Where(t => t.RenameCustomer(@event.UserId, @event.DisplayName)).Select(t => t.Id).ToList();

        if (renamed.Count == 0)
        {
            return;
        }

        await ticketRepository.UnitOfWork.SaveEntitiesAsync();
        logger.LogInformation("Renamed user {UserId} to {Name} on open ticket(s) {TicketIds}", @event.UserId, @event.DisplayName, renamed);
    }
}
