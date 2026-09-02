#nullable enable
using Chillax.EventBus.Abstractions;
using Chillax.Sales.API.Application.IntegrationEvents.Events;

namespace Chillax.Sales.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// A confirmed order lands on the right ticket:
/// its session's (opened lazily if Sales missed the start), its table's
/// (opened lazily by the first order — Q7: one open ticket per table), or a
/// fresh counter ticket for a POS sale or an order-ahead paid at the counter.
/// Idempotent per order via <see cref="Ticket.AppendOrder"/>.
/// </summary>
public class OrderStatusChangedToConfirmedIntegrationEventHandler(
    ITicketRepository ticketRepository,
    ILogger<OrderStatusChangedToConfirmedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderStatusChangedToConfirmedIntegrationEvent>
{
    public async Task Handle(OrderStatusChangedToConfirmedIntegrationEvent @event)
    {
        // Events published before Ordering carried the breakdown have no
        // items; there is nothing to bill from them
        if (@event.Items.Count == 0)
        {
            logger.LogWarning("Order {OrderId} confirmed without line items - skipping ticket assembly", @event.OrderId);
            return;
        }

        var ticket = await ResolveTicketAsync(@event);

        // AppendOrder stamps the order id on every line itself
        var lines = @event.Items.Select(i => new TicketLine(
            TicketLineSource.Order,
            i.ProductName,
            qty: i.Units,
            unitPrice: i.UnitPrice,
            discount: i.Discount,
            details: i.CustomizationsDescription)).ToList();

        ticket.AppendOrder(
            @event.OrderId,
            lines,
            @event.LoyaltyDiscount,
            customerName: string.IsNullOrWhiteSpace(@event.BuyerName) ? null : @event.BuyerName,
            guestPhone: @event.GuestPhone);

        await ticketRepository.UnitOfWork.SaveEntitiesAsync();

        logger.LogInformation(
            "Order {OrderId} appended to {Type} ticket {TicketId}",
            @event.OrderId, ticket.Type, ticket.Id);
    }

    private async Task<Ticket> ResolveTicketAsync(OrderStatusChangedToConfirmedIntegrationEvent @event)
    {
        if (@event.SessionId is int sessionId)
        {
            var sessionTicket = await ticketRepository.FindOpenBySessionAsync(sessionId);

            // The session may predate Sales (or its start event was lost) —
            // the order still has to land somewhere, so open the ticket now
            return sessionTicket ?? ticketRepository.Add(Ticket.OpenForSession(
                sessionId,
                @event.RoomId ?? 0,
                @event.RoomName ?? new LocalizedText("Room"),
                @event.BranchId,
                string.IsNullOrEmpty(@event.BuyerIdentityGuid) ? null : @event.BuyerIdentityGuid,
                @event.BuyerName));
        }

        if (@event.TableId is int tableId)
        {
            var tableTicket = await ticketRepository.FindOpenByTableAsync(tableId, @event.BranchId);

            return tableTicket ?? ticketRepository.Add(Ticket.OpenForTable(tableId, @event.TableName, @event.BranchId));
        }

        // No destination: a counter sale keyed at the POS, or an order-ahead
        // that gets paid at the counter — either way its own one-shot ticket
        return ticketRepository.Add(Ticket.OpenForCounter(
            @event.BranchId,
            string.IsNullOrEmpty(@event.BuyerIdentityGuid) ? null : @event.BuyerIdentityGuid,
            string.IsNullOrWhiteSpace(@event.BuyerName) ? null : @event.BuyerName));
    }
}
