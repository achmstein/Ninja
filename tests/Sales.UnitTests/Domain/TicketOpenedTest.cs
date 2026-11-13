using Microsoft.Extensions.Logging.Abstractions;
using Ninja.EventBus.Events;
using Ninja.Sales.API.Application.DomainEventHandlers;
using Ninja.Sales.API.Application.IntegrationEvents;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;
using Ninja.Sales.Domain.Events;

namespace Ninja.Sales.UnitTests.Domain;

/// <summary>
/// A bill opened at a table or a room says which place it is the bill of, once, when it opens:
/// Ordering keeps it, and what is rung up onto the bill goes to the kitchen under that place's name.
/// </summary>
[TestClass]
public class TicketOpenedTest
{
    private sealed class Outbox : ISalesIntegrationEventService
    {
        public List<IntegrationEvent> Queued { get; } = [];

        public Task AddAndSaveEventAsync(IntegrationEvent evt)
        {
            Queued.Add(evt);
            return Task.CompletedTask;
        }

        public Task PublishEventsThroughEventBusAsync(Guid transactionId) => Task.CompletedTask;
    }

    private static async Task<List<IntegrationEvent>> SaidOnOpeningAsync(Ticket ticket)
    {
        var outbox = new Outbox();
        var handler = new TicketOpenedDomainEventHandler(outbox, NullLogger<TicketOpenedDomainEventHandler>.Instance);
        foreach (var opened in ticket.DomainEvents.OfType<TicketOpenedDomainEvent>())
        {
            await handler.Handle(opened, default);
        }
        return outbox.Queued;
    }

    [TestMethod]
    public async Task A_room_s_bill_says_it_is_the_room_s()
    {
        var ticket = Ticket.OpenForSession(sessionId: 81, placeId: 5, new LocalizedText("Room 5", "اوضة ٥"), branchId: 1);

        Assert.AreEqual(1, ticket.DomainEvents.OfType<TicketOpenedDomainEvent>().Count(), "once, when it opens");
        var said = (TicketOpenedIntegrationEvent)(await SaidOnOpeningAsync(ticket)).Single();
        Assert.AreEqual(5, said.PlaceId);
        Assert.AreEqual("Room", said.PlaceKind);
        Assert.AreEqual("Room 5", said.PlaceName!.En);
        Assert.AreEqual("اوضة ٥", said.PlaceName.Ar);
        Assert.AreEqual(1, said.BranchId);
    }

    [TestMethod]
    public async Task A_table_s_bill_says_it_is_the_table_s()
    {
        var ticket = Ticket.OpenForTable(placeId: 12, new LocalizedText("Table 1", null), branchId: 2);

        var said = (TicketOpenedIntegrationEvent)(await SaidOnOpeningAsync(ticket)).Single();
        Assert.AreEqual(12, said.PlaceId);
        Assert.AreEqual("Table", said.PlaceKind);
        Assert.AreEqual(2, said.BranchId);
    }

    [TestMethod]
    public async Task An_empty_bill_thrown_away_says_it_is_no_longer_the_place_s()
    {
        var outbox = new Outbox();
        var handler = new TicketDiscardedDomainEventHandler(outbox, NullLogger<TicketDiscardedDomainEventHandler>.Instance);

        var table = Ticket.OpenForTable(placeId: 12, new LocalizedText("Table 1", null), branchId: 2);
        table.Discard();
        foreach (var discarded in table.DomainEvents.OfType<TicketDiscardedDomainEvent>()) await handler.Handle(discarded, default);
        var said = (TicketDiscardedIntegrationEvent)outbox.Queued.Single();
        Assert.AreEqual(2, said.BranchId);

        // A counter bill was never a place's: nothing to take back
        outbox.Queued.Clear();
        var counter = Ticket.OpenForCounter(branchId: 1);
        counter.Discard();
        foreach (var discarded in counter.DomainEvents.OfType<TicketDiscardedDomainEvent>()) await handler.Handle(discarded, default);
        Assert.IsEmpty(outbox.Queued);
    }

    [TestMethod]
    public async Task A_counter_bill_has_no_place_and_says_nothing()
    {
        Assert.IsEmpty(await SaidOnOpeningAsync(Ticket.OpenForCounter(branchId: 1, label: "Mona")));
        Assert.IsEmpty(await SaidOnOpeningAsync(Ticket.OpenForDelivery(branchId: 1)));
    }
}
