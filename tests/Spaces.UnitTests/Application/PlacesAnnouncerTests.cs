using Microsoft.EntityFrameworkCore;
using Ninja.EventBus.Abstractions;
using Ninja.EventBus.Events;
using Ninja.Spaces.API.Application.BackgroundServices;
using Ninja.Spaces.API.Application.IntegrationEvents.Events;
using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.SeedWork;
using Ninja.Spaces.Infrastructure;

namespace Ninja.Spaces.UnitTests.Application;

/// <summary>
/// Every place is said again at start, so a service that keeps a copy has all of them and nobody
/// else has to say what a place is called.
/// </summary>
[TestClass]
public sealed class PlacesAnnouncerTests
{
    private sealed class Bus : IEventBus
    {
        public List<IntegrationEvent> Said { get; } = [];

        public Task PublishAsync(IntegrationEvent @event)
        {
            Said.Add(@event);
            return Task.CompletedTask;
        }
    }

    [TestMethod]
    public async Task Every_place_is_said_once_with_what_it_is_called()
    {
        var options = new DbContextOptionsBuilder<SpacesContext>().UseInMemoryDatabase($"spaces-{Guid.NewGuid()}").Options;
        await using (var seed = new SpacesContext(options))
        {
            seed.Places.Add(Place.Table(new LocalizedText("Table 4", "ترابيزة ٤"), 1));
            seed.Places.Add(Place.Room(new LocalizedText("Room 5", "اوضة ٥"), 50m, 80m, 2));
            await seed.SaveChangesAsync();
        }

        var bus = new Bus();
        await using var context = new SpacesContext(options);
        var said = await PlacesAnnouncer.AnnounceAsync(context, bus);

        Assert.AreEqual(2, said);
        var events = bus.Said.Cast<PlaceUpdatedIntegrationEvent>().ToList();
        var room = events.Single(e => e.Kind == "Room");
        Assert.AreEqual("Room 5", room.Name.En);
        Assert.AreEqual("اوضة ٥", room.Name.Ar);
        Assert.AreEqual(2, room.BranchId);
        Assert.IsFalse(room.Deleted);
        Assert.AreEqual("Table 4", events.Single(e => e.Kind == "Table").Name.En);
    }

    [TestMethod]
    public async Task A_business_with_no_places_says_nothing()
    {
        var options = new DbContextOptionsBuilder<SpacesContext>().UseInMemoryDatabase($"spaces-{Guid.NewGuid()}").Options;
        var bus = new Bus();
        await using var context = new SpacesContext(options);

        Assert.AreEqual(0, await PlacesAnnouncer.AnnounceAsync(context, bus));
        Assert.IsEmpty(bus.Said);
    }
}
