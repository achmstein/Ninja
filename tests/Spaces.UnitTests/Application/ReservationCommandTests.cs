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
/// stay at a timed place; the table itself at a plain one, until the staff
/// complete it), or give it up — and what a walk-in may not do to a
/// reserved place.
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
    public async Task Seating_at_a_plain_table_keeps_the_table_for_the_party_and_starts_no_clock()
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
        Assert.AreEqual(PlaceStatus.Occupied, table.PhysicalStatus, "the table is theirs: nobody else books it while they sit");
        Assert.IsFalse(await db.ReservationRepository.HasOpenAsync(table.Id));
        Assert.AreSame(reservation, await db.ReservationRepository.GetSeatedAtAsync(table.Id));

        // Another party cannot be seated on top of them
        var next = Reserve(db, table, customerId: "c2", @for: DateTime.UtcNow.AddHours(5));
        await Assert.ThrowsExactlyAsync<SpacesDomainException>(() => Handler(db).Handle(new SeatReservationCommand(next.Id), default));
    }

    [TestMethod]
    public async Task The_party_leaving_a_plain_table_frees_it()
    {
        var db = new InMemorySpaces();
        var table = Place.Table("Table 4", 1);
        table.SetReservable(true);
        db.AddPlace(table);
        var reservation = Reserve(db, table);
        await Handler(db).Handle(new SeatReservationCommand(reservation.Id), default);

        Assert.IsTrue(await Handler(db).Handle(new CompleteReservationCommand(reservation.Id), default));

        Assert.AreEqual(ReservationStatus.Completed, reservation.Status);
        Assert.AreEqual(PlaceStatus.Available, table.PhysicalStatus);
        Assert.IsNull(await db.ReservationRepository.GetSeatedAtAsync(table.Id));
        await Assert.ThrowsExactlyAsync<SpacesDomainException>(() => Handler(db).Handle(new CompleteReservationCommand(reservation.Id), default));
    }

    [TestMethod]
    public async Task A_party_at_a_timed_place_leaves_through_its_stay_which_closes_the_reservation()
    {
        var db = new InMemorySpaces();
        var room = db.AddPlace(Place.Room("Room 1", 60m, 90m, 1));
        var reservation = Reserve(db, room);
        var seated = await Handler(db).Handle(new SeatReservationCommand(reservation.Id), default);

        // Not from the reservation's side: the clock is what is running
        await Assert.ThrowsExactlyAsync<SpacesDomainException>(() => Handler(db).Handle(new CompleteReservationCommand(reservation.Id), default));
        Assert.AreEqual(ReservationStatus.Seated, reservation.Status);

        var stays = new EndStayCommandHandler(db.StayRepository, db.PlaceRepository, db.ReservationRepository, NullLogger<EndStayCommandHandler>.Instance);
        await stays.Handle(new EndStayCommand(seated.StayId!.Value), default);

        Assert.AreEqual(ReservationStatus.Completed, reservation.Status, "the stay's end is the party leaving");
        Assert.AreEqual(PlaceStatus.Available, room.PhysicalStatus);
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
