#nullable enable
using Ninja.EventBus.Abstractions;
using Ninja.Sales.API.Application.Deliveries;
using Ninja.Sales.API.Application.IntegrationEvents.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// The rider handed a delivery's cash in at the till: its bill settles with
/// it (see <see cref="DeliveryCashier"/>), or the cash waits for the bill, or
/// a shortfall is recorded and the bill left open for the till.
/// </summary>
public class OrderDeliveryChangedIntegrationEventHandler(
    ITicketRepository ticketRepository,
    SalesTransaction transaction,
    DeliveryCashier cashier,
    ILogger<OrderDeliveryChangedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderDeliveryChangedIntegrationEvent>
{
    /// <summary>The name a settle from a rider's cash is recorded under, beside a cashier's.</summary>
    public const string RiderSettledBy = DeliveryCashier.RiderSettledBy;

    public async Task Handle(OrderDeliveryChangedIntegrationEvent @event)
    {
        if (!@event.CashHandedIn) return;

        try
        {
            await transaction.RunAsync(nameof(OrderDeliveryChangedIntegrationEvent), () => cashier.TakeInAsync(@event));
        }
        catch (SalesDomainException ex) when (ex.InnerException is DbUpdateConcurrencyException)
        {
            // The till settled the same bill at the same moment and won: the bill is settled, which is
            // all the cash was for. Anything else is a real failure and goes back to the bus
            if ((await ticketRepository.FindByOrderAsync(@event.OrderId)).Any(t => t.Status == TicketStatus.Open))
                throw;

            logger.LogInformation("Delivery {OrderId}: the till settled its bill while the rider's cash came in", @event.OrderId);
            await transaction.RunAsync(nameof(OrderDeliveryChangedIntegrationEvent), () => cashier.SettledAtTillAsync(@event));
        }
    }
}
