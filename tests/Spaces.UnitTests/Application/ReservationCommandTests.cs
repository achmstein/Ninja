using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Spaces.API.Application.Commands;
using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Ninja.Spaces.Domain.AggregatesModel.StayAggregate;
using Ninja.Spaces.Domain.Events;
using Ninja.Spaces.Domain.Exceptions;

namespace Ninja.Spaces.UnitTests.Application;

/// <summary>
/// What the till does with a reservation: confirm it, seat the party (a
/// stay at a timed place, nothing more at a plain table), or give it up —
/// and what a walk-in may not do to a reserved place.
/// </summary>
[TestClass]
public sealed class ReservationCommandTests
{
    private static ReservationCommandHandler Handler(InMemorySpaces db)
        => new(db.ReservationRepository, db.StayRepository, db.PlaceRepository, NullLogger<ReservationCommandHandler>.Instance);

    private static Reservation Reserve(InMemorySpaces db, Place place, string? customerId = "c1", bool startOnConfirm = false, string? option = null, DateTime? @for = null)
        => db.ReservationRepository.Add(new Reservation(place, customerId, customerId is null ? "Walk-in" : "Ahmed", @for, startOnConfirm: startOnConfirm, requestedOptionCode: option, isStaffCreated: customerId is null));

    [TestMethod]
    public async Task Seating_at_a_timed_place_starts_the_clock_and_occupies_it()
    {
        var db = new InMemorySpaces();
        var room = db.AddPlace(Place.Room("Room 1", 60m, 90m, 1));
        var reservation = Reserve(db, room, option: Tariff.MultiCode, startOnConfirm: true);

        var result = await Handler(db).Handle(new SeatReservationCommand(reservation.Id), default);

        Assert.IsTrue(result.Seated);
        var stay = db.Stays.Single();
        Assert.AreEqual(stay.Id, result.StayId);
        Assert.AreEqual(stay.Id, reservation.StayId);
        Assert.AreEqual(reservation.Id, stay.ReservationId);
        Assert.AreEqual(ReservationStatus.Seated, reservation.Status);
        Assert.AreEqual(StayStatus.Running, stay.Status);
        Assert.AreEqual(Tariff.MultiCode, stay.CurrentOptionCode, "the rate the customer asked for");
        Assert.AreEqual("c1", stay.CustomerId);
        Assert.AreEqual(StayMemberRole.Owner, stay.GetMemberRole("c1"));
        Assert.AreEqual(PlaceStatus.Occupied, room.PhysicalStatus);
        Assert.IsTrue(stay.DomainEvents!.OfType<StayStartedDomainEvent>().Any(), "Sales opens the bill on this");
        Assert.AreEqual(1, db.Saves);
    }

    [TestMethod]
    public async Task The_till_s_rate_wins_over_the_customer_s()
    {
        var db = new InMemorySpaces();
        var room = db.AddPlace(Place.Room("Room 1", 60m, 90m, 1));
        var reservation = Reserve(db, room, option: Tariff.MultiCode, startOnConfirm: true);

        await Handler(db).Handle(new SeatReservationCommand(reservation.Id, Tariff.SingleCode), default);

        Assert.AreEqual(Tariff.SingleCode, db.Stays.Single().CurrentOptionCode);
    }

    [TestMethod]
    public async Task Seating_at_a_plain_table_closes_the_reservation_and_starts_nothing()
    {
        var db = new InMemorySpaces();
        var table = Place.Table("Table 4", 1);
        table.SetReservable(true);
        db.AddPlace(table);
        var reservation = Reserve(db, table, @for: DateTime.UtcNow.AddHours(2));

        var result = await Handler(db).Handle(new SeatReservationCommand(reservation.Id), default);

        Assert.IsTrue(result.Seated);
        Assert.IsNull(result.StayId);
        Assert.AreEqual(ReservationStatus.Seated, reservation.Status);
        Assert.IsNull(reservation.StayId);
        Assert.IsEmpty(db.Stays);
        Assert.AreEqual(PlaceStatus.Available, table.PhysicalStatus, "the ticket on the table says who is there, not Spaces");
        Assert.IsFalse(await db.ReservationRepository.HasOpenAsync(table.Id));
    }

    [TestMethod]
    public async Task Confirm_seats_only_when_the_customer_asked_for_the_clock_to_start_on_it()
    {
        var db = new InMemorySpaces();
        var room = db.AddPlace(Place.Room("Room 1", 60m, 90m, 1));
        var handler = Handler(db);

        var lazy = Reserve(db, room);
        var confirmed = await handler.Handle(new ConfirmReservationCommand(lazy.Id), default);
        Assert.IsFalse(confirmed.Seated);
        Assert.AreEqual(ReservationStatus.Confirmed, lazy.Status);
        Assert.IsTrue(lazy.IsHolding(DateTime.UtcNow), "still keeping the room until Seat");
        Assert.IsEmpty(db.Stays);
        lazy.Cancel();

        var eager = Reserve(db, room, startOnConfirm: true);
        var started = await handler.Handle(new ConfirmReservationCommand(eager.Id), default);
        Assert.IsTrue(started.Seated);
        Assert.IsNotNull(started.StayId);
        Assert.AreEqual(ReservationStatus.Seated, eager.Status);
        Assert.AreEqual(Tariff.SingleCode, db.Stays.Single().CurrentOptionCode, "the tariff's default when nobody picked");
    }

    [TestMethod]
    public async Task A_reserved_place_refuses_a_walk_in_until_the_reservation_is_seated_or_given_up()
    {
        var db = new InMemorySpaces();
        var room = db.AddPlace(Place.Room("Room 1", 60m, 90m, 1));
        var reservation = Reserve(db, room);
        var walkIn = new StartWalkInStayCommandHandler(db.StayRepository, db.ReservationRepository, db.PlaceRepository, NullLogger<StartWalkInStayCommandHandler>.Instance);

        await Assert.ThrowsExactlyAsync<SpacesDomainException>(() => walkIn.Handle(new StartWalkInStayCommand(room.Id), default));

        await Handler(db).Handle(new CancelReservationCommand(reservation.Id), default);
        Assert.AreEqual(ReservationStatus.Cancelled, reservation.Status);
        var wasHolding = reservation.DomainEvents!.OfType<ReservationCancelledDomainEvent>().Single().WasHolding;
        Assert.IsTrue(wasHolding, "the room was being kept, so the floor is told it is free");

        var started = await walkIn.Handle(new StartWalkInStayCommand(room.Id), default);
        Assert.AreEqual(db.Stays.Single().Id, started.StayId);
    }

    [TestMethod]
    public async Task A_booking_for_later_does_not_block_a_walk_in_now()
    {
        var db = new InMemorySpaces();
        var room = db.AddPlace(Place.Room("Room 1", 60m, 90m, 1));
        Reserve(db, room, customerId: null, @for: DateTime.UtcNow.AddHours(5));
        var walkIn = new StartWalkInStayCommandHandler(db.StayRepository, db.ReservationRepository, db.PlaceRepository, NullLogger<StartWalkInStayCommandHandler>.Instance);

        await walkIn.Handle(new StartWalkInStayCommand(room.Id), default);
        Assert.HasCount(1, db.Stays);
    }

    [TestMethod]
    public async Task A_customer_gives_up_only_their_own_reservation()
    {
        var db = new InMemorySpaces();
        var room = db.AddPlace(Place.Room("Room 1", 60m, 90m, 1));
        var reservation = Reserve(db, room, customerId: "c1");
        var handler = Handler(db);

        await Assert.ThrowsExactlyAsync<SpacesDomainException>(() => handler.Handle(new CancelReservationCommand(reservation.Id, OnlyIfCustomerId: "c2"), default));
        Assert.AreEqual(ReservationStatus.Requested, reservation.Status);

        Assert.IsTrue(await handler.Handle(new CancelReservationCommand(reservation.Id, OnlyIfCustomerId: "c1"), default));
        Assert.AreEqual(ReservationStatus.Cancelled, reservation.Status);
        await Assert.ThrowsExactlyAsync<SpacesDomainException>(() => handler.Handle(new SeatReservationCommand(reservation.Id), default), "closed is closed");
    }

    [TestMethod]
    public async Task Seating_at_a_timed_place_needs_the_place_free()
    {
        var db = new InMemorySpaces();
        var room = db.AddPlace(Place.Room("Room 1", 60m, 90m, 1));
        var reservation = Reserve(db, room, customerId: null, @for: DateTime.UtcNow.AddHours(1));
        db.StayRepository.Add(Stay.CreateWalkIn(room.Id, room.Tariff!));
        room.SetOccupied();

        await Assert.ThrowsExactlyAsync<SpacesDomainException>(() => Handler(db).Handle(new SeatReservationCommand(reservation.Id), default));
        Assert.AreEqual(ReservationStatus.Requested, reservation.Status, "the party waits; nothing was seated");
    }
}
