using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Sales.API.Application.Commands;
using Ninja.Sales.API.Application.IntegrationEvents.EventHandling;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.API.Application.Queries;
using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;
using Ninja.Sales.Infrastructure;
using Ninja.Sales.Infrastructure.Repositories;

namespace Ninja.Sales.UnitTests.Application;

/// <summary>
/// Sales keeps what each place is called from Spaces, and a bill opened by hand at a table is named
/// from that: the till says which table by its id, never what it is called.
/// </summary>
[TestClass]
public class PlaceNamesTest
{
    private const int Branch = 1, TableOne = 12, TableTwo = 13;
    private static readonly DateTime Noon = new(2026, 11, 13, 12, 0, 0, DateTimeKind.Utc);

    private static DbContextOptions<SalesContext> NewStore() =>
        new DbContextOptionsBuilder<SalesContext>().UseInMemoryDatabase($"sales-{Guid.NewGuid()}").Options;

    private static async Task HeardAsync(DbContextOptions<SalesContext> store, int placeId, string en, string? ar, DateTime at, bool deleted = false)
    {
        await using var context = new SalesContext(store);
        await new PlaceUpdatedIntegrationEventHandler(context, NullLogger<PlaceUpdatedIntegrationEventHandler>.Instance)
            .Handle(new PlaceUpdatedIntegrationEvent(placeId, "Table", new LocalizedText(en, ar), Branch, deleted) { CreationDate = at });
    }

    private static async Task<LocalizedText?> NameOfAsync(DbContextOptions<SalesContext> store, int placeId)
    {
        await using var context = new SalesContext(store);
        return await new PlaceNames(context).OfAsync(placeId);
    }

    [TestMethod]
    public async Task The_copy_follows_Spaces_and_a_late_older_event_changes_nothing()
    {
        var store = NewStore();
        Assert.IsNull(await NameOfAsync(store, TableOne), "never heard of");

        await HeardAsync(store, TableOne, "Table 1", "ترابيزة ١", Noon);
        Assert.AreEqual("Table 1", (await NameOfAsync(store, TableOne))!.En);

        await HeardAsync(store, TableOne, "Window table", "ترابيزة الشباك", Noon.AddMinutes(5));
        // Said again at a start, and an older event arriving late
        await HeardAsync(store, TableOne, "Window table", "ترابيزة الشباك", Noon.AddMinutes(6));
        await HeardAsync(store, TableOne, "Table 1", "ترابيزة ١", Noon.AddMinutes(1));
        var name = await NameOfAsync(store, TableOne);
        Assert.AreEqual("Window table", name!.En);
        Assert.AreEqual("ترابيزة الشباك", name.Ar);

        await HeardAsync(store, TableOne, "Window table", null, Noon.AddMinutes(9), deleted: true);
        Assert.IsNull(await NameOfAsync(store, TableOne), "a deleted place is gone from the copy");
    }

    [TestMethod]
    public async Task A_table_s_bill_opened_by_its_id_carries_the_name_Spaces_gave_it()
    {
        var store = NewStore();
        await HeardAsync(store, TableOne, "Table 1", "ترابيزة ١", Noon);

        int ticketId;
        await using (var context = new SalesContext(store))
        {
            ticketId = await new OpenTicketCommandHandler(new TicketRepository(context), new PlaceNames(context), NullLogger<OpenTicketCommandHandler>.Instance)
                .Handle(new OpenTicketCommand(TicketType.Table, Branch, null, TableOne), default);
        }

        await using var after = new SalesContext(store);
        var ticket = await after.Tickets.SingleAsync(t => t.Id == ticketId);
        Assert.AreEqual(TableOne, ticket.PlaceId);
        Assert.AreEqual("Table 1", ticket.LocationName!.En);
        Assert.AreEqual("ترابيزة ١", ticket.LocationName.Ar);

        // The bill keeps the name it was opened with: a rename is for the next bill
        await HeardAsync(store, TableOne, "Window table", null, Noon.AddMinutes(5));
        await using var later = new SalesContext(store);
        Assert.AreEqual("Table 1", (await later.Tickets.SingleAsync(t => t.Id == ticketId)).LocationName!.En);
    }

    [TestMethod]
    public async Task A_table_never_heard_of_still_gets_its_bill_without_a_name()
    {
        var store = NewStore();
        await using var context = new SalesContext(store);

        var ticketId = await new OpenTicketCommandHandler(new TicketRepository(context), new PlaceNames(context), NullLogger<OpenTicketCommandHandler>.Instance)
            .Handle(new OpenTicketCommand(TicketType.Table, Branch, null, TableOne), default);

        var ticket = await context.Tickets.SingleAsync(t => t.Id == ticketId);
        Assert.AreEqual(TableOne, ticket.PlaceId);
        Assert.IsNull(ticket.LocationName);
    }

    [TestMethod]
    public async Task Items_moved_to_a_table_open_its_bill_under_the_name_Spaces_gave_it()
    {
        var store = NewStore();
        await HeardAsync(store, TableTwo, "Table 2", "ترابيزة ٢", Noon);

        int sourceId, lineId;
        await using (var context = new SalesContext(store))
        {
            var counter = Ticket.OpenForCounter(Branch, "Mona");
            counter.AddManualLine(new LocalizedText("Latte", null), 1, 50, 0, "Omar");
            context.Tickets.Add(counter);
            await context.SaveChangesAsync();
            (sourceId, lineId) = (counter.Id, counter.Lines.Single().Id);
        }

        int targetId;
        await using (var context = new SalesContext(store))
        {
            targetId = await new MoveTicketLinesCommandHandler(new TicketRepository(context), new PlaceNames(context), NullLogger<MoveTicketLinesCommandHandler>.Instance)
                .Handle(new MoveTicketLinesCommand(sourceId, [lineId], NewTicket: new NewTicketTarget(TicketType.Table, null, TableTwo)), default);
        }

        await using var after = new SalesContext(store);
        var target = await after.Tickets.Include(t => t.Lines).SingleAsync(t => t.Id == targetId);
        Assert.AreEqual(TableTwo, target.PlaceId);
        Assert.AreEqual("Table 2", target.LocationName!.En);
        Assert.AreEqual(1, target.Lines.Count);
    }
}
