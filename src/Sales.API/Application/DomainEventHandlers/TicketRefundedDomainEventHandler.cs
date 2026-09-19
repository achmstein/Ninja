using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.Domain.Events;

namespace Ninja.Sales.API.Application.DomainEventHandlers;

/// <summary>
/// A refund changes what a settled ticket screen shows — the same refresh
/// nudge; the credit note itself goes out from the refund command once it
/// has its number.
/// </summary>
public class TicketRefundedDomainEventHandler(
    ISalesIntegrationEventService integrationEvents,
    ILogger<TicketRefundedDomainEventHandler> logger) : INotificationHandler<TicketRefundedDomainEvent>
{
    public async Task Handle(TicketRefundedDomainEvent notification, CancellationToken cancellationToken)
    {
        logger.LogInformation("Ticket {TicketId} refunded - queueing the floor nudge", notification.Refund.TicketId);

        await integrationEvents.AddAndSaveEventAsync(new TicketUpdatedIntegrationEvent(
            notification.Refund.TicketId,
            notification.Refund.BranchId));
    }
}
