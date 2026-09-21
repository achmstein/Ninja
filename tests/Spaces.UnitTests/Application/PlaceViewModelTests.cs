using Ninja.Spaces.API.Application.Queries;
using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Ninja.Spaces.Domain.AggregatesModel.StayAggregate;

namespace Ninja.Spaces.UnitTests.Application;

/// <summary>What a place looks like to the floor and the scan page, given what is on it.</summary>
[TestClass]
public sealed class PlaceViewModelTests
{
    private static Place Room() => InMemorySpaces.WithId(Place.Room("Room 1", 60m, 90m, 1), 7);

    [TestMethod]
    public void A_reservation_for_now_shows_the_place_held_and_a_booking_for_later_does_not()
    {
        var now = DateTime.UtcNow;
        var room = Room();

        var free = room.ToViewModel(running: null, openReservations: [], now);
        Assert.AreEqual(PlaceDisplayStatus.Available, free.Status);
        Assert.IsNull(free.CurrentReservation);
        Assert.IsNull(free.CurrentStay);

        var later = new Reservation(room, "c1", "Ahmed", @for: now.AddHours(3), partySize: 2);
        var due = room.ToViewModel(null, [later], now);
        Assert.AreEqual(PlaceDisplayStatus.Available, due.Status, "the room is anyone's until then");
        Assert.IsNotNull(due.CurrentReservation);
        Assert.IsFalse(due.CurrentReservation!.IsHolding);
        Assert.AreEqual(later.For, due.CurrentReservation.For);
        Assert.AreEqual(2, due.CurrentReservation.PartySize);

        var soon = new Reservation(room, "c2", "Sara");
        var held = room.ToViewModel(null, [later, soon], now);
        Assert.AreEqual(PlaceDisplayStatus.Held, held.Status);
        Assert.AreEqual(soon.Id, held.CurrentReservation!.ReservationId, "the one keeping the place now comes first");
        Assert.IsTrue(held.CurrentReservation.IsHolding);
        Assert.IsNotNull(held.CurrentReservation.ExpiresAt);
    }

    [TestMethod]
    public void A_running_clock_wins_over_a_reservation()
    {
        var now = DateTime.UtcNow;
        var room = Room();
        var stay = Stay.CreateWalkIn(room.Id, room.Tariff!, "c1", "Ahmed");
        var later = new Reservation(room, "c2", "Sara", @for: now.AddHours(3));

        var vm = room.ToViewModel(stay, [later], now);

        Assert.AreEqual(PlaceDisplayStatus.Occupied, vm.Status);
        Assert.IsNotNull(vm.CurrentStay);
        Assert.AreEqual(StayStatus.Running, vm.CurrentStay!.Status);
        Assert.IsNotNull(vm.CurrentReservation, "the floor still sees who is due later");
    }

    [TestMethod]
    public void Out_of_service_beats_everything()
    {
        var room = Room();
        room.SetOutOfService();
        var vm = room.ToViewModel(null, [new Reservation(room, "c1", "Ahmed")], DateTime.UtcNow);
        Assert.AreEqual(PlaceDisplayStatus.OutOfService, vm.Status);
    }

    [TestMethod]
    public void A_reservation_reads_its_option_name_from_the_place_and_drops_the_expiry_once_closed()
    {
        var now = DateTime.UtcNow;
        var room = Room();
        var r = new Reservation(room, "c1", "Ahmed", startOnConfirm: true, requestedOptionCode: "multi");

        var open = r.ToViewModel(now);
        Assert.AreEqual("Multi", open.RequestedOptionName!.En);
        Assert.IsTrue(open.PlaceIsTimed);
        Assert.IsTrue(open.IsHolding);
        Assert.IsNotNull(open.ExpiresAt);

        r.Seat(stayId: 42);
        var seated = r.ToViewModel(now);
        Assert.AreEqual(ReservationStatus.Seated, seated.Status);
        Assert.AreEqual(42, seated.StayId);
        Assert.IsNull(seated.ExpiresAt, "nothing left to lapse");
        Assert.IsFalse(seated.IsHolding);
    }

    [TestMethod]
    public void The_place_view_says_whether_the_owner_opened_it_to_bookings()
    {
        var table = InMemorySpaces.WithId(Place.Table("Table 4", 1), 9);
        Assert.IsFalse(table.ToViewModel(null, [], DateTime.UtcNow).Reservable);
        Assert.IsFalse(table.ToViewModel(null, [], DateTime.UtcNow).CanReserve);

        table.SetReservable(true);
        var vm = table.ToViewModel(null, [], DateTime.UtcNow);
        Assert.IsTrue(vm.Reservable);
        Assert.IsTrue(vm.CanReserve);
        Assert.IsFalse(vm.IsTimed);
    }
}
