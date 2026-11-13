using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Ordering.API.Application.IntegrationEvents;
using Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;
using Ninja.Ordering.API.Application.IntegrationEvents.Events;
using Ninja.Ordering.API.Application.Queries;
using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;
using Ninja.Ordering.Infrastructure;
using Order = Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order;

namespace Ninja.Ordering.UnitTests.Application;

/// <summary>
/// An order rung up onto an open bill belongs to the place the bill is the bill of. Ordering learns
/// that from Sales when the bill opens, so the kitchen's card says "Room 5" whichever till sent the
/// order and whether or not the till said where the bill is.
/// </summary>
[TestClass]
public class TicketPlaceTest
{
    private const int Branch = 1, Ticket = 171, RoomFive = 5;
    private static readonly LocalizedText RoomFiveName = new("Room 5", "اوضة ٥");

    private sealed class Store
    {
        private readonly string _name = $"ordering-{Guid.NewGuid()}";
        private readonly InMemoryDatabaseRoot _root = new();

        public OrderingContext NewContext() =>
            new(new DbContextOptionsBuilder<OrderingContext>().UseInMemoryDatabase(_name, _root).Options, Substitute.For<IMediator>());
    }

    private static async Task OpenedAsync(Store store, int ticketId = Ticket, int placeId = RoomFive, LocalizedText? name = null)
    {
        await using var context = store.NewContext();
        await new TicketOpenedIntegrationEventHandler(new TicketPlaces(context), NullLogger<TicketOpenedIntegrationEventHandler>.Instance)
            .Handle(new TicketOpenedIntegrationEvent(ticketId, Branch, placeId, "Room", name ?? RoomFiveName));
    }

    private static async Task<Order> RungUpAsync(Store store, int? ticketId, int? placeId = null, LocalizedText? placeName = null)
    {
        Order? made = null;
        var orders = Substitute.For<IOrderRepository>();
        orders.Add(Arg.Do<Order>(o => made = o)).Returns(call => call.Arg<Order>());
        await using var context = store.NewContext();
        var handler = new CreateOrderCommandHandler(
            Substitute.For<IOrderingIntegrationEventService>(), orders, NullLogger<CreateOrderCommandHandler>.Instance,
            ticketPlaces: new TicketPlaces(context));

        await handler.Handle(new CreateOrderCommand(
            [], userId: string.Empty, userName: string.Empty, branchId: Branch, customerNote: null,
            source: OrderSource.Pos, ticketId: ticketId, placeId: placeId, placeKind: placeId is null ? null : "Table", placeName: placeName), default);
        return made!;
    }

    [TestMethod]
    public async Task An_order_rung_up_onto_a_room_s_bill_is_the_room_s()
    {
        var store = new Store();
        await OpenedAsync(store);

        var order = await RungUpAsync(store, Ticket);

        Assert.AreEqual(RoomFive, order.PlaceId);
        Assert.AreEqual("Room", order.PlaceKind);
        Assert.AreEqual("Room 5", order.PlaceName!.En);
        Assert.AreEqual("اوضة ٥", order.PlaceName.Ar);
        Assert.AreEqual(Ticket, order.TicketId);
    }

    [TestMethod]
    public async Task What_the_till_says_itself_stands_and_a_bill_with_no_place_gives_none()
    {
        var store = new Store();
        await OpenedAsync(store);

        var said = await RungUpAsync(store, Ticket, placeId: 12, placeName: new LocalizedText("Table 1", null));
        Assert.AreEqual(12, said.PlaceId);
        Assert.AreEqual("Table 1", said.PlaceName!.En);

        var counterBill = await RungUpAsync(store, ticketId: 999);
        Assert.IsNull(counterBill.PlaceId, "a counter bill, or one not heard of yet: taken as sent");

        var walkIn = await RungUpAsync(store, ticketId: null);
        Assert.IsNull(walkIn.PlaceId);
    }

    [TestMethod]
    public async Task Orders_already_on_the_bill_are_given_its_place_when_the_bill_is_heard_of()
    {
        var store = new Store();
        int unplaced, elsewhere, other;
        await using (var context = store.NewContext())
        {
            var first = new Order(string.Empty, string.Empty, Branch, source: OrderSource.Pos, ticketId: Ticket);
            var saidItself = new Order(string.Empty, string.Empty, Branch, source: OrderSource.Pos, ticketId: Ticket, placeId: 12, placeKind: "Table", placeName: new LocalizedText("Table 1", null));
            var anotherBill = new Order(string.Empty, string.Empty, Branch, source: OrderSource.Pos, ticketId: 172);
            context.Orders.AddRange(first, saidItself, anotherBill);
            await context.SaveChangesAsync();
            (unplaced, elsewhere, other) = (first.Id, saidItself.Id, anotherBill.Id);
        }

        await OpenedAsync(store);
        // Sales says it again at every start: hearing it twice changes nothing
        await OpenedAsync(store);

        await using var after = store.NewContext();
        var given = await after.Orders.SingleAsync(o => o.Id == unplaced);
        Assert.AreEqual(RoomFive, given.PlaceId, "the card the kitchen already has gains its room");
        Assert.AreEqual("Room 5", given.PlaceName!.En);
        Assert.AreEqual(12, (await after.Orders.SingleAsync(o => o.Id == elsewhere)).PlaceId, "an order that says its place keeps it");
        Assert.IsNull((await after.Orders.SingleAsync(o => o.Id == other)).PlaceId, "another bill's order is not this bill's");
        Assert.AreEqual(1, await after.TicketPlaces.CountAsync());
    }

    [TestMethod]
    public async Task A_settled_or_voided_bill_is_let_go()
    {
        var store = new Store();
        await OpenedAsync(store, ticketId: 1);
        await OpenedAsync(store, ticketId: 2);

        await using (var context = store.NewContext())
        {
            await new TicketSettledIntegrationEventHandler(Substitute.For<IMediator>(), NullLogger<TicketSettledIntegrationEventHandler>.Instance, new TicketPlaces(context))
                .Handle(new TicketSettledIntegrationEvent(1, Branch, 7, []));
        }
        await using (var context = store.NewContext())
        {
            await new TicketVoidedIntegrationEventHandler(Substitute.For<IMediator>(), NullLogger<TicketVoidedIntegrationEventHandler>.Instance, new TicketPlaces(context))
                .Handle(new TicketVoidedIntegrationEvent(2, Branch, "mistake", "owner", []));
        }

        await using var after = store.NewContext();
        Assert.AreEqual(0, await after.TicketPlaces.CountAsync());
        Assert.IsNull((await RungUpAsync(store, ticketId: 1)).PlaceId);
    }
}
