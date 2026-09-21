using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Spaces.API.Application.Commands;
using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Ninja.Spaces.Domain.AggregatesModel.StayAggregate;
using Ninja.Spaces.Domain.Exceptions;

namespace Ninja.Spaces.UnitTests.Application;

/// <summary>The rules around making a reservation: who may, where, and when the place is already spoken for.</summary>
[TestClass]
public sealed class ReservePlaceCommandTests
{
    private static ReservePlaceCommandHandler Handler(InMemorySpaces db, bool reservationsEnabled = true)
        => new(db.PlaceRepository, db.ReservationRepository, db.StayRepository, new FakeBranchSettings(reservationsEnabled), NullLogger<ReservePlaceCommandHandler>.Instance);

    private static Place Room(InMemorySpaces db) => db.AddPlace(Place.Room("Room 1", 60m, 90m, 1));

    private static Place BookableTable(InMemorySpaces db)
    {
        var table = Place.Table("Table 4", 1);
        table.SetReservable(true);
        return db.AddPlace(table);
    }

    [TestMethod]
    public async Task A_customer_reserves_a_room_for_now_and_the_place_is_kept()
    {
        var db = new InMemorySpaces();
        var room = Room(db);

        var id = await Handler(db).Handle(new ReservePlaceCommand(room.Id, "c1", "Ahmed", StartOnConfirm: true, RequestedOptionCode: "multi"), default);

        var r = db.Reservations.Single();
        Assert.AreEqual(id, r.Id);
        Assert.AreEqual(ReservationStatus.Requested, r.Status);
        Assert.AreEqual("c1", r.CustomerId);
        Assert.IsNull(r.For);
        Assert.IsTrue(r.IsHolding(DateTime.UtcNow));
        Assert.IsTrue(r.StartOnConfirm);
        Assert.AreEqual(Tariff.MultiCode, r.RequestedOptionCode);
        Assert.AreEqual(1, db.Saves);
        Assert.IsTrue(await db.ReservationRepository.IsHeldAsync(room.Id, DateTime.UtcNow));
    }

    [TestMethod]
    public async Task A_plain_table_takes_a_booking_for_later_with_no_clock_involved()
    {
        var db = new InMemorySpaces();
        var table = BookableTable(db);
        var at = DateTime.UtcNow.AddHours(4);

        await Handler(db).Handle(new ReservePlaceCommand(table.Id, "c1", "Ahmed", For: at, PartySize: 4, StartOnConfirm: true), default);

        var r = db.Reservations.Single();
        Assert.AreEqual(at, r.For);
        Assert.AreEqual(4, r.PartySize);
        Assert.IsFalse(r.StartOnConfirm, "no tariff, nothing to start");
        Assert.IsFalse(r.IsHolding(DateTime.UtcNow), "the table is anyone's until then");
        Assert.IsFalse(await db.ReservationRepository.IsHeldAsync(table.Id, DateTime.UtcNow));
    }

    [TestMethod]
    public async Task A_table_the_owner_did_not_open_to_bookings_refuses()
    {
        var db = new InMemorySpaces();
        var table = db.AddPlace(Place.Table("Table 1", 1));

        await Assert.ThrowsExactlyAsync<SpacesDomainException>(() => Handler(db).Handle(new ReservePlaceCommand(table.Id, "c1", "Ahmed"), default));
        Assert.IsEmpty(db.Reservations);
    }

    [TestMethod]
    public async Task One_open_reservation_or_running_stay_per_customer_but_staff_reserve_for_anyone()
    {
        var db = new InMemorySpaces();
        var room1 = Room(db);
        var room2 = db.AddPlace(Place.Room("Room 2", 60m, 90m, 1));
        var handler = Handler(db);

        await handler.Handle(new ReservePlaceCommand(room1.Id, "c1", "Ahmed"), default);
        await Assert.ThrowsExactlyAsync<SpacesDomainException>(() => handler.Handle(new ReservePlaceCommand(room2.Id, "c1", "Ahmed"), default), "one at a time");

        // A running clock somewhere counts the same
        db.StayRepository.Add(Stay.CreateWalkIn(room2.Id, room2.Tariff!, "c2", "Sara"));
        await Assert.ThrowsExactlyAsync<SpacesDomainException>(() => handler.Handle(new ReservePlaceCommand(room1.Id, "c2", "Sara", For: DateTime.UtcNow.AddHours(5)), default));

        // The till reserves on behalf of whoever is at the counter, as often as it likes
        await handler.Handle(new ReservePlaceCommand(room2.Id, null, "Walk-in", For: DateTime.UtcNow.AddHours(5), IsStaff: true), default);
        await handler.Handle(new ReservePlaceCommand(room2.Id, null, "Another", For: DateTime.UtcNow.AddHours(9), IsStaff: true), default);
        Assert.AreEqual(3, db.Reservations.Count);
        Assert.IsTrue(db.Reservations.Skip(1).All(r => r.ExpiresAt is null), "staff reservations never lapse");
    }

    [TestMethod]
    public async Task A_branch_with_reservations_paused_refuses_customers_and_not_the_till()
    {
        var db = new InMemorySpaces();
        var room = Room(db);

        await Assert.ThrowsExactlyAsync<SpacesDomainException>(() => Handler(db, reservationsEnabled: false).Handle(new ReservePlaceCommand(room.Id, "c1", "Ahmed"), default));
        await Handler(db, reservationsEnabled: false).Handle(new ReservePlaceCommand(room.Id, null, "Phone", IsStaff: true), default);
        Assert.HasCount(1, db.Reservations);
    }

    [TestMethod]
    public async Task A_reservation_for_now_needs_the_place_free_now_a_booking_for_later_does_not()
    {
        var db = new InMemorySpaces();
        var room = Room(db);
        db.StayRepository.Add(Stay.CreateWalkIn(room.Id, room.Tariff!));
        room.SetOccupied();

        await Assert.ThrowsExactlyAsync<SpacesDomainException>(() => Handler(db).Handle(new ReservePlaceCommand(room.Id, "c1", "Ahmed"), default), "somebody is in it");
        await Handler(db).Handle(new ReservePlaceCommand(room.Id, "c1", "Ahmed", For: DateTime.UtcNow.AddHours(3)), default);
        Assert.HasCount(1, db.Reservations);
    }

    [TestMethod]
    public async Task Two_reservations_on_one_place_collide_within_the_slot_and_not_beyond_it()
    {
        var db = new InMemorySpaces();
        var table = BookableTable(db);
        var handler = Handler(db);
        var eight = DateTime.UtcNow.Date.AddDays(1).AddHours(20);

        await handler.Handle(new ReservePlaceCommand(table.Id, null, "The Ahmeds", For: eight, IsStaff: true), default);
        await Assert.ThrowsExactlyAsync<SpacesDomainException>(
            () => handler.Handle(new ReservePlaceCommand(table.Id, null, "The Saras", For: eight.AddMinutes(90), IsStaff: true), default),
            "ninety minutes later is inside the two-hour slot");
        await handler.Handle(new ReservePlaceCommand(table.Id, null, "The Saras", For: eight.AddHours(2), IsStaff: true), default);
        Assert.HasCount(2, db.Reservations);

        // A reservation for now collides with a booking due within the slot
        var soon = DateTime.UtcNow.AddMinutes(45);
        var room = Room(db);
        await handler.Handle(new ReservePlaceCommand(room.Id, null, "Later", For: soon, IsStaff: true), default);
        await Assert.ThrowsExactlyAsync<SpacesDomainException>(() => handler.Handle(new ReservePlaceCommand(room.Id, "c9", "Now", IsStaff: false), default));
    }
}
