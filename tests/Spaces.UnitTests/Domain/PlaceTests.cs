using Chillax.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Chillax.Spaces.Domain.Events;
using Chillax.Spaces.Domain.Exceptions;
using Chillax.Spaces.Domain.SeedWork;

namespace Chillax.Spaces.UnitTests.Domain;

[TestClass]
public sealed class PlaceTests
{
    [TestMethod]
    public void Capabilities_follow_the_tariff_not_the_kind()
    {
        var table = Place.Table("Table 4", 1);
        Assert.IsFalse(table.IsTimed);
        Assert.IsFalse(table.CanReserve);
        Assert.IsFalse(table.HasOptions);
        Assert.IsFalse(table.TakesControllerRequests);

        table.SetTariff(Tariff.Flat(40m));
        Assert.IsTrue(table.IsTimed);
        Assert.IsTrue(table.CanReserve, "a timed table books like a room");
        Assert.IsFalse(table.HasOptions, "one rate, nothing to choose");
        Assert.IsFalse(table.TakesControllerRequests, "still not a console room");

        var room = Place.Room("Room 1", 50m, 80m, 1);
        Assert.IsTrue(room.IsTimed);
        Assert.IsTrue(room.HasOptions);
        Assert.IsTrue(room.TakesControllerRequests);

        var station = new Place(PlaceKind.Station, "Pool 1", 1, Tariff.Flat(80m));
        Assert.IsTrue(station.CanReserve);
        Assert.IsFalse(station.TakesControllerRequests);
    }

    [TestMethod]
    public void A_deactivated_place_cannot_be_reserved()
    {
        var room = Place.Room("Room 1", 50m, 80m, 1);
        room.SetActive(false);
        Assert.IsFalse(room.CanReserve);
        Assert.IsTrue(room.IsTimed, "the tariff stays; the place just refuses customers");
    }

    [TestMethod]
    public void The_tariff_cannot_be_removed_while_the_place_is_occupied()
    {
        var room = Place.Room("Room 1", 50m, 80m, 1);
        room.SetOccupied();
        Assert.ThrowsExactly<SpacesDomainException>(() => room.SetTariff(null));
        Assert.ThrowsExactly<SpacesDomainException>(room.SetOutOfService);

        room.SetAvailable();
        room.SetTariff(null);
        Assert.IsFalse(room.IsTimed);
    }

    [TestMethod]
    public void An_out_of_service_place_refuses_to_be_occupied()
    {
        var room = Place.Room("Room 1", 50m, 80m, 1);
        room.SetOutOfService();
        Assert.ThrowsExactly<SpacesDomainException>(room.SetOccupied);
        Assert.IsFalse(room.IsPhysicallyAvailable());
    }

    [TestMethod]
    public void A_tariff_validates_its_options_and_rounds_to_its_step()
    {
        Assert.ThrowsExactly<SpacesDomainException>(() => new Tariff([]));
        Assert.ThrowsExactly<SpacesDomainException>(() => new RateOption("single", "Single", 0m));
        Assert.ThrowsExactly<SpacesDomainException>(() => new Tariff([
            new RateOption("single", "Single", 50m),
            new RateOption("SINGLE", "Again", 60m),
        ]), "codes are unique regardless of case");

        var tariff = Tariff.Room(50m, 80m);
        Assert.AreEqual("single", tariff.Default.Code);
        Assert.AreEqual(80m, tariff.Require("MULTI").HourlyRate);
        Assert.IsNull(tariff.Find("vr"));
        Assert.ThrowsExactly<SpacesDomainException>(() => tariff.Require("vr"));

        Assert.AreEqual(0m, tariff.RoundHours(0));
        Assert.AreEqual(0.25m, tariff.RoundHours(8));
        Assert.AreEqual(0m, tariff.RoundHours(7));
        Assert.AreEqual(1m, tariff.RoundHours(65));
        Assert.AreEqual(1.25m, tariff.RoundHours(68));

        var hourly = new Tariff([new RateOption("standard", "Standard", 80m)], roundingMinutes: 60);
        Assert.AreEqual(1m, hourly.RoundHours(80));
        Assert.AreEqual(2m, hourly.RoundHours(95));
    }

    [TestMethod]
    public void Changes_other_services_project_raise_one_event()
    {
        var place = Place.Table(new LocalizedText("Table 4", "ترابيزة ٤"), 1);
        place.ClearDomainEvents();

        place.UpdateDetails("Table 4b", null);
        place.SetTariff(Tariff.Flat(40m));
        place.SetActive(true); // unchanged: no event
        place.SetActive(false);
        place.SetOccupied();   // physical status is not projected

        Assert.AreEqual(3, place.DomainEvents!.OfType<PlaceChangedDomainEvent>().Count());
    }
}
