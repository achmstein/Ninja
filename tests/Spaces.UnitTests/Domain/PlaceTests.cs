using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.Events;
using Ninja.Spaces.Domain.Exceptions;
using Ninja.Spaces.Domain.SeedWork;

namespace Ninja.Spaces.UnitTests.Domain;

[TestClass]
public sealed class PlaceTests
{
    [TestMethod]
    public void Capabilities_follow_the_tariff_not_the_kind()
    {
        var table = Place.Table("Table 4", 1);
        Assert.IsFalse(table.IsTimed);
        Assert.IsFalse(table.CanReserve, "a plain table is not booked until the owner says so");
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
    public void Reservable_is_the_owner_s_switch_and_a_tariff_turns_it_on()
    {
        // A plain table can be booked without a clock
        var table = Place.Table("Table 4", 1);
        table.SetReservable(true);
        Assert.IsTrue(table.CanReserve);
        Assert.IsFalse(table.IsTimed);

        // A timed place can stop taking bookings and keep its clock
        var room = Place.Room("Room 1", 50m, 80m, 1);
        room.SetReservable(false);
        Assert.IsFalse(room.CanReserve);
        Assert.IsTrue(room.IsTimed);

        // Giving a place a tariff opts it in; changing the tariff later does not flip it back
        var station = new Place(PlaceKind.Station, "Pool 1", 1);
        Assert.IsFalse(station.Reservable);
        station.SetTariff(Tariff.Flat(80m));
        Assert.IsTrue(station.Reservable);
        station.SetReservable(false);
        station.SetTariff(Tariff.Flat(90m));
        Assert.IsFalse(station.Reservable);

        // Explicit at creation wins over the default
        var booth = new Place(PlaceKind.Table, "Booth", 1, reservable: true);
        Assert.IsTrue(booth.CanReserve);
        var vip = Place.Room("VIP", 150m, 200m, 1);
        Assert.IsTrue(vip.Reservable);
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
        place.SetReservable(true); // already on since the tariff: no event
        place.SetReservable(false);
        place.SetOccupied();   // physical status is not projected

        Assert.AreEqual(4, place.DomainEvents!.OfType<PlaceChangedDomainEvent>().Count());
    }
}
