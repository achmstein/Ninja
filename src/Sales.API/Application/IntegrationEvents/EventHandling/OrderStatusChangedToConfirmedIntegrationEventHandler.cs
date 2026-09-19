#nullable enable
using Ninja.EventBus.Abstractions;
using Ninja.Sales.API.Application.IntegrationEvents.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// A confirmed order lands on the right ticket: the one it names (a cashier
/// adding items to a bill already on the floor),
/// its session's (opened lazily if Sales missed the start), its table's
/// (opened lazily by the first order — Q7: one open ticket per table), or a
/// fresh counter ticket for a POS sale or an order-ahead paid at the counter.
/// Idempotent per order: a redelivery is dropped when any ticket already
/// carries the order — its lines may have moved since they landed — and
/// <see cref="Ticket.AppendOrder"/> guards the ticket itself besides.
/// </summary>
public class OrderStatusChangedToConfirmedIntegrationEventHandler(
    ITicketRepository ticketRepository,
    SalesTransaction transaction,
    ILogger<OrderStatusChangedToConfirmedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderStatusChangedToConfirmedIntegrationEvent>
{
    // One transaction per event, its floor nudge published after the commit
    public Task Handle(OrderStatusChangedToConfirmedIntegrationEvent @event)
        => transaction.RunAsync(nameof(OrderStatusChangedToConfirmedIntegrationEvent), () => Assemble(@event));

    private async Task Assemble(OrderStatusChangedToConfirmedIntegrationEvent @event)
    {
        // Events published before Ordering carried the breakdown have no
        // items; there is nothing to bill from them
        if (@event.Items.Count == 0)
        {
            logger.LogWarning("Order {OrderId} confirmed without line items - skipping ticket assembly", @event.OrderId);
            return;
        }

        // At-least-once delivery, checked across every ticket rather than the
        // one this order would land on: once its lines were moved to another
        // bill, a redelivered confirmation would otherwise re-append them
        // where they first landed
        if (await ticketRepository.HasOrderAsync(@event.OrderId))
        {
            logger.LogInformation("Order {OrderId} is already on a ticket - redelivery ignored", @event.OrderId);
            return;
        }

        var ticket = await ResolveTicketAsync(@event);

        // Whose items these are, so a shared table bill can be read (and
        // split) per person. Ordering sends null when nobody was named, so an
        // anonymous counter add stays untagged instead of being labelled
        // "Walk-in", which reads like a person and is not one.
        var lineCustomer = @event.CustomerName;

        // The account behind the name, when there is one. A name the till was
        // simply told has none — it can be grouped and read, but no tab can be
        // charged for it.
        var lineCustomerId = string.IsNullOrEmpty(@event.BuyerIdentityGuid)
            ? null
            : @event.BuyerIdentityGuid;

        // AppendOrder stamps the order id on every line itself
        var lines = @event.Items.Select(i => new TicketLine(
            TicketLineSource.Order,
            i.ProductName,
            qty: i.Units,
            unitPrice: i.UnitPrice,
            discount: i.Discount,
            details: i.CustomizationsDescription,
            customerName: lineCustomer,
            customerId: lineCustomerId,
            guestId: @event.GuestId,
            catalogItemId: i.ProductId)).ToList();

        ticket.AppendOrder(
            @event.OrderId,
            lines,
            @event.LoyaltyDiscount,
            guestPhone: @event.GuestPhone,
            promoCode: @event.PromoCode,
            promoDiscount: @event.PromoDiscount);

        await ticketRepository.UnitOfWork.SaveEntitiesAsync();

        logger.LogInformation(
            "Order {OrderId} appended to {Type} ticket {TicketId}",
            @event.OrderId, ticket.Type, ticket.Id);
    }

    private async Task<Ticket> ResolveTicketAsync(OrderStatusChangedToConfirmedIntegrationEvent @event)
    {
        // The cashier rang this up against a bill that is already on the
        // floor, so there is nothing to infer. Only an open ticket in the same
        // branch counts: a settled or voided one (or a stale id) falls through
        // to the routing below rather than losing the order.
        if (@event.TicketId is int ticketId)
        {
            var named = await ticketRepository.GetAsync(ticketId);

            if (named is not null && named.Status == TicketStatus.Open && named.BranchId == @event.BranchId)
                return named;

            logger.LogWarning(
                "Order {OrderId} named ticket {TicketId}, which is not open in branch {BranchId} — falling back to destination routing",
                @event.OrderId, ticketId, @event.BranchId);
        }

        if (@event.SessionId is int sessionId)
        {
            var sessionTicket = await ticketRepository.FindOpenBySessionAsync(sessionId);
            if (sessionTicket is not null)
                return sessionTicket;

            // The session may predate Sales (or its start event was lost) —
            // the order still has to land somewhere, so open the ticket now.
            // A stay is always somewhere: an order that names one but no
            // place is a broken contract, and dead-letters instead.
            if (@event is not { PlaceId: int stayPlace, PlaceKind: { } stayPlaceKind, PlaceName: { } stayPlaceName })
                throw new SalesDomainException($"Order {@event.OrderId} is for session {sessionId} but names no place to open its ticket at.");

            return ticketRepository.Add(Ticket.OpenForSession(sessionId, stayPlace, stayPlaceName, @event.BranchId, stayPlaceKind));
        }

        if (@event.PlaceId is int placeId)
        {
            if (string.Equals(@event.PlaceKind, "Room", StringComparison.OrdinalIgnoreCase))
            {
                // A room named without a stay: the customer scanned its
                // sticker and ordered before the clock started, or after it
                // stopped. The room's open bill takes the order so it joins
                // the session's instead of a stray counter tab opening in the
                // customer's name; a room with no bill open is a counter sale
                // like any other.
                var roomTicket = await ticketRepository.FindOpenRoomAsync(placeId, @event.BranchId);
                if (roomTicket is not null)
                {
                    logger.LogInformation("Order {OrderId} joins the open ticket {TicketId} of room {PlaceId}", @event.OrderId, roomTicket.Id, placeId);
                    return roomTicket;
                }
            }
            else
            {
                // A place with no clock running (a table, timed or not,
                // between stays): its open bill, or one opened lazily by this
                // first order — Q7: one open ticket per table
                var placeTicket = await ticketRepository.FindOpenByPlaceAsync(placeId, @event.BranchId);

                return placeTicket ?? ticketRepository.Add(Ticket.OpenForTable(placeId, @event.PlaceName, @event.BranchId));
            }
        }

        // No destination: a counter sale keyed at the POS, or an order-ahead
        // that gets paid at the counter. A customer who orders again before
        // paying joins the counter tab already open for them — one bill to
        // settle, not one per order. Nobody identified (an anonymous walk-in)
        // means a fresh one-shot ticket, named after whoever it is for when
        // somebody was named. The account behind that name is on the lines,
        // where settle looks for it.
        var buyerId = string.IsNullOrEmpty(@event.BuyerIdentityGuid) ? null : @event.BuyerIdentityGuid;
        var own = await ticketRepository.FindOpenCounterForCustomerAsync(@event.BranchId, buyerId, @event.GuestId);
        if (own is not null)
        {
            logger.LogInformation("Order {OrderId} joins the open counter ticket {TicketId} of its customer", @event.OrderId, own.Id);
            return own;
        }

        return ticketRepository.Add(Ticket.OpenForCounter(@event.BranchId, @event.CustomerName));
    }
}
