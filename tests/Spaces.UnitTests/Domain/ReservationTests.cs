using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Ninja.Spaces.Domain.Events;
using Ninja.Spaces.Domain.Exceptions;

namespace Ninja.Spaces.UnitTests.Domain;

[TestClass]
public sealed class ReservationTests
{
    private static Place Room() => Place.Room("Room 1", 60m, 90m, 1);

    private static Place BookableTable()
    {
        var table = Place.Table("Table 4", 1);
        table.SetReservable(true);
        return table;
    }

    [TestMethod]
    public void A_reservation_for_now_keeps_the_place_and_lapses_after_ten_minutes()
    {
        var now = DateTime.UtcNow;
        var r = new Reservation(Room(), "c1", "Ahmed");

        Assert.AreEqual(ReservationStatus.Requested, r.Status);
        Assert.IsTrue(r.IsOpen);
        Assert.IsNull(r.For);
        Assert.IsTrue(r.IsHolding(now), "a reservation for now keeps the place from the moment it is made");
        Assert.AreEqual(Reservation.HoldMinutes, Math.Round((r.ExpiresAt!.Value - r.CreatedAt).TotalMinutes));
        Assert.IsFalse(r.IsExpired(now));
        Assert.IsTrue(r.IsExpired(now.AddMinutes(11)));
        Assert.IsTrue(r.DomainEvents!.OfType<ReservationRequestedDomainEvent>().Any());
    }

    [TestMethod]
    public void A_scheduled_reservation_keeps_the_place_from_its_time_and_lapses_after_the_grace()
    {
        var now = DateTime.UtcNow;
        var at = now.AddHours(3);
        var r = new Reservation(BookableTable(), "c1", "Ahmed", @for: at, partySize: 4);

        Assert.AreEqual(at, r.For);
        Assert.AreEqual(at, r.EffectiveFor);
        Assert.AreEqual(4, r.PartySize);
        Assert.IsFalse(r.IsHolding(now), "the table is anyone's until eight o'clock");
        Assert.IsTrue(r.IsHolding(at.AddMinutes(1)));
        Assert.AreEqual(at.AddMinutes(Reservation.GraceMinutes), r.ExpiresAt);
        Assert.IsFalse(r.IsExpired(at.AddMinutes(10)));
        Assert.IsTrue(r.IsExpired(at.AddMinutes(31)));

        Assert.ThrowsExactly<SpacesDomainException>(() => new Reservation(BookableTable(), "c1", "Ahmed", @for: now.AddMinutes(-1)), "the past is not a time to book");
        Assert.ThrowsExactly<SpacesDomainException>(() => new Reservation(BookableTable(), "c1", "Ahmed", partySize: 0));
    }

    [TestMethod]
    public void A_staff_reservation_needs_no_account_and_never_lapses()
    {
        var staff = new Reservation(Room(), null, "Walk-in", isStaffCreated: true);
        Assert.IsNull(staff.CustomerId);
        Assert.IsNull(staff.ExpiresAt);
        Assert.IsFalse(staff.IsExpired(DateTime.UtcNow.AddDays(1)));
        Assert.IsNull(staff.TimeUntilExpiry(DateTime.UtcNow));

        Assert.ThrowsExactly<SpacesDomainException>(() => new Reservation(Room(), null, null), "a customer's reservation needs the customer");
    }

    [TestMethod]
    public void Only_a_reservable_place_takes_one()
    {
        Assert.ThrowsExactly<SpacesDomainException>(() => new Reservation(Place.Table("Table 4", 1), "c1", "Ahmed"));

        var off = Room();
        off.SetActive(false);
        Assert.ThrowsExactly<SpacesDomainException>(() => new Reservation(off, "c1", "Ahmed"));
    }

    [TestMethod]
    public void The_clock_options_only_mean_something_on_a_timed_place()
    {
        var timed = new Reservation(Room(), "c1", "Ahmed", startOnConfirm: true, requestedOptionCode: "MULTI");
        Assert.IsTrue(timed.StartOnConfirm);
        Assert.AreEqual(Tariff.MultiCode, timed.RequestedOptionCode);
        Assert.ThrowsExactly<SpacesDomainException>(() => new Reservation(Room(), "c1", "Ahmed", startOnConfirm: true, requestedOptionCode: "vr"));

        // Without start-on-confirm there is nothing for the option to decide
        var lazy = new Reservation(Room(), "c1", "Ahmed", requestedOptionCode: Tariff.MultiCode);
        Assert.IsNull(lazy.RequestedOptionCode);

        // A plain table has no clock to start
        var table = new Reservation(BookableTable(), "c1", "Ahmed", startOnConfirm: true, requestedOptionCode: "anything");
        Assert.IsFalse(table.StartOnConfirm);
        Assert.IsNull(table.RequestedOptionCode);
    }

    [TestMethod]
    public void Confirm_is_idempotent_and_keeps_it_open()
    {
        var r = new Reservation(Room(), "c1", "Ahmed");
        r.Confirm();
        Assert.AreEqual(ReservationStatus.Confirmed, r.Status);
        Assert.IsTrue(r.IsOpen);
        Assert.IsTrue(r.IsHolding(DateTime.UtcNow));
        r.Confirm();
        Assert.AreEqual(ReservationStatus.Confirmed, r.Status);
    }

    [TestMethod]
    public void Seating_is_the_party_being_here_and_remembers_the_stay_that_took_over()
    {
        var timed = new Reservation(Room(), "c1", "Ahmed");
        timed.Seat(stayId: 42);
        Assert.AreEqual(ReservationStatus.Seated, timed.Status);
        Assert.AreEqual(42, timed.StayId);
        Assert.IsNotNull(timed.SeatedAt);
        Assert.IsFalse(timed.IsOpen);
        Assert.IsTrue(timed.IsSeated);
        Assert.IsFalse(timed.IsHolding(DateTime.UtcNow));
        Assert.IsTrue(timed.DomainEvents!.OfType<ReservationSeatedDomainEvent>().Any());

        var table = new Reservation(BookableTable(), "c1", "Ahmed");
        table.Confirm();
        table.Seat();
        Assert.AreEqual(ReservationStatus.Seated, table.Status);
        Assert.IsNull(table.StayId, "no clock at a plain table");

        Assert.ThrowsExactly<SpacesDomainException>(() => table.Seat());
        Assert.ThrowsExactly<SpacesDomainException>(table.Confirm);
        Assert.ThrowsExactly<SpacesDomainException>(table.Cancel);
    }

    [TestMethod]
    public void Completing_is_the_party_leaving_and_only_a_seated_party_leaves()
    {
        var table = new Reservation(BookableTable(), "c1", "Ahmed");
        Assert.ThrowsExactly<SpacesDomainException>(table.Complete);
        table.Seat();
        table.ClearDomainEvents();

        table.Complete();
        Assert.AreEqual(ReservationStatus.Completed, table.Status);
        Assert.IsFalse(table.IsSeated);
        Assert.IsNotNull(table.ClosedAt);
        Assert.IsNotNull(table.SeatedAt, "when they came stays on the record");
        Assert.IsTrue(table.DomainEvents!.OfType<ReservationCompletedDomainEvent>().Any());
        Assert.ThrowsExactly<SpacesDomainException>(table.Complete);

        var cancelled = new Reservation(Room(), "c1", "Ahmed");
        cancelled.Cancel();
        Assert.ThrowsExactly<SpacesDomainException>(cancelled.Complete);
    }

    [TestMethod]
    public void Cancelling_says_whether_the_place_was_being_kept()
    {
        var now = new Reservation(Room(), "c1", "Ahmed");
        now.Cancel();
        Assert.AreEqual(ReservationStatus.Cancelled, now.Status);
        Assert.IsNotNull(now.ClosedAt);
        Assert.IsTrue(now.DomainEvents!.OfType<ReservationCancelledDomainEvent>().Single().WasHolding);

        var later = new Reservation(BookableTable(), "c1", "Ahmed", @for: DateTime.UtcNow.AddHours(5));
        later.Cancel();
        Assert.IsFalse(later.DomainEvents!.OfType<ReservationCancelledDomainEvent>().Single().WasHolding, "nobody was waiting on that table yet");

        Assert.ThrowsExactly<SpacesDomainException>(later.Cancel);
    }

    [TestMethod]
    public void Lapsing_is_quiet()
    {
        var r = new Reservation(Room(), "c1", "Ahmed");
        r.ClearDomainEvents();
        r.Expire();
        Assert.AreEqual(ReservationStatus.Expired, r.Status);
        Assert.IsNotNull(r.ClosedAt);
        Assert.AreEqual(0, r.DomainEvents!.Count, "nothing to bill, nobody to tell");
        Assert.ThrowsExactly<SpacesDomainException>(r.Expire);
    }
}
