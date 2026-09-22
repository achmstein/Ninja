using System.Reflection;
using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Ninja.Spaces.Domain.AggregatesModel.StayAggregate;
using Ninja.Spaces.Domain.Events;
using Ninja.Spaces.Domain.Exceptions;

namespace Ninja.Spaces.UnitTests.Domain;

[TestClass]
public sealed class StayTests
{
    private static Tariff RoomTariff() => Tariff.Room(60m, 90m);

    [TestMethod]
    public void A_walk_in_runs_from_the_start_on_the_default_option()
    {
        var stay = Stay.CreateWalkIn(1, RoomTariff());

        Assert.AreEqual(StayStatus.Running, stay.Status);
        Assert.IsTrue(stay.IsOpen);
        Assert.IsNull(stay.CustomerId);
        Assert.IsNull(stay.ReservationId);
        Assert.AreEqual(Tariff.SingleCode, stay.CurrentOptionCode);
        Assert.AreEqual(1, stay.Segments.Count);
        Assert.IsTrue(stay.DomainEvents!.OfType<StayStartedDomainEvent>().Any());
    }

    [TestMethod]
    public void A_walk_in_takes_the_option_the_till_picked_and_is_case_insensitive()
    {
        var stay = Stay.CreateWalkIn(1, RoomTariff(), optionCode: "Multi");
        Assert.AreEqual(Tariff.MultiCode, stay.CurrentOptionCode);
        Assert.AreEqual(90m, stay.Segments.Single().HourlyRate);
        Assert.ThrowsExactly<SpacesDomainException>(() => Stay.CreateWalkIn(1, RoomTariff(), optionCode: "vr"));
    }

    [TestMethod]
    public void Seating_a_reservation_starts_the_clock_with_the_customer_in_the_party()
    {
        var room = Place.Room("Room 1", 60m, 90m, 1);
        var reservation = new Reservation(room, "c1", "Ahmed", startOnConfirm: true, requestedOptionCode: Tariff.MultiCode, notes: "birthday");

        var stay = Stay.FromReservation(reservation, room.Tariff!);

        Assert.AreEqual(StayStatus.Running, stay.Status);
        Assert.AreEqual(reservation.Id, stay.ReservationId);
        Assert.AreEqual("c1", stay.CustomerId);
        Assert.AreEqual("birthday", stay.Notes);
        Assert.AreEqual(Tariff.MultiCode, stay.CurrentOptionCode, "the option the customer asked for");
        Assert.AreEqual(StayMemberRole.Owner, stay.GetMemberRole("c1"));
        Assert.IsTrue(stay.DomainEvents!.OfType<StayStartedDomainEvent>().Any());

        // The till's choice wins over the customer's
        var overridden = Stay.FromReservation(reservation, room.Tariff!, Tariff.SingleCode);
        Assert.AreEqual(Tariff.SingleCode, overridden.CurrentOptionCode);

        // A staff reservation for a party with no account: no owner yet, the first scan claims it
        var staff = new Reservation(room, null, "Walk-in", isStaffCreated: true);
        var unclaimed = Stay.FromReservation(staff, room.Tariff!);
        Assert.IsNull(unclaimed.CustomerId);
        Assert.AreEqual(0, unclaimed.Members.Count);
    }

    [TestMethod]
    public void Changing_to_an_option_the_tariff_does_not_have_is_refused()
    {
        var stay = Stay.CreateWalkIn(1, RoomTariff());
        Assert.ThrowsExactly<SpacesDomainException>(() => stay.ChangeOption("vr"));
        Assert.ThrowsExactly<SpacesDomainException>(() => stay.ChangeOption(Tariff.SingleCode), "already on single");
        Assert.AreEqual(Tariff.SingleCode, stay.CurrentOptionCode);
    }

    [TestMethod]
    public void Changing_the_option_closes_the_segment_and_opens_a_new_one()
    {
        var stay = Stay.CreateWalkIn(1, RoomTariff());
        stay.ChangeOption(Tariff.MultiCode);

        Assert.AreEqual(2, stay.Segments.Count);
        Assert.IsNotNull(stay.Segments.First().EndTime);
        Assert.IsNull(stay.Segments.Last().EndTime);
        Assert.AreEqual(90m, stay.Segments.Last().HourlyRate);
    }

    [TestMethod]
    public void Cost_is_per_option_rounded_to_the_tariff_step()
    {
        var stay = Stay.CreateWalkIn(1, RoomTariff());
        // 50 minutes single (rounds to 0.75h), then 100 minutes multi (rounds to 1.75h)
        Backdate(stay.Segments.First(), minutes: 50);
        stay.ChangeOption(Tariff.MultiCode);
        Backdate(stay.Segments.Last(), minutes: 100);
        stay.End();

        Assert.AreEqual(StayStatus.Ended, stay.Status);
        Assert.AreEqual(0.75m, stay.HoursFor(Tariff.SingleCode));
        Assert.AreEqual(1.75m, stay.HoursFor(Tariff.MultiCode));
        Assert.AreEqual(0.75m * 60m + 1.75m * 90m, stay.TotalCost);

        var lines = stay.CostBreakdown();
        Assert.AreEqual(2, lines.Count);
        Assert.AreEqual("single", lines[0].OptionCode);
        Assert.AreEqual(45m, lines[0].Cost);
        Assert.AreEqual("multi", lines[1].OptionCode);
        Assert.AreEqual(157.5m, lines[1].Cost);
        Assert.IsTrue(stay.DomainEvents!.OfType<StayEndedDomainEvent>().Any());
    }

    [TestMethod]
    public void A_one_rate_place_bills_one_line()
    {
        var table = Tariff.Flat(40m);
        var stay = Stay.CreateWalkIn(4, table, "c1", "Ahmed");
        Assert.AreEqual(Tariff.StandardCode, stay.CurrentOptionCode);

        Backdate(stay.Segments.Single(), minutes: 65); // rounds to the nearest quarter: 1h
        stay.End();

        Assert.AreEqual(40m, stay.TotalCost);
        var lines = stay.CostBreakdown();
        Assert.AreEqual(1, lines.Count);
        Assert.AreEqual(1m, lines[0].Hours);
        Assert.AreEqual(0m, stay.CostFor(Tariff.SingleCode), "no single option on a flat tariff");
    }

    [TestMethod]
    public void The_stay_keeps_the_rates_it_started_with()
    {
        var tariff = RoomTariff();
        var stay = Stay.CreateWalkIn(1, tariff, "c1", "Ahmed");

        Assert.AreEqual(60m, stay.Tariff.Require(Tariff.SingleCode).HourlyRate);
        Assert.AreNotSame(tariff, stay.Tariff, "a snapshot, not the place's own object");
    }

    [TestMethod]
    public void The_first_joiner_of_an_unclaimed_walk_in_becomes_the_owner()
    {
        var stay = Stay.CreateWalkIn(1, RoomTariff());
        stay.AddMember("c1", "Ahmed");
        stay.AddMember("c2", "Sara");

        Assert.AreEqual("c1", stay.CustomerId);
        Assert.AreEqual(StayMemberRole.Owner, stay.GetMemberRole("c1"));
        Assert.AreEqual(StayMemberRole.Member, stay.GetMemberRole("c2"));
        Assert.ThrowsExactly<SpacesDomainException>(() => stay.RemoveMember("c1"));
        stay.RemoveMember("c2");
        Assert.IsFalse(stay.HasMember("c2"));
    }

    [TestMethod]
    public void Members_can_still_be_named_after_the_clock_stops_but_not_once_cancelled()
    {
        var stay = Stay.CreateWalkIn(1, RoomTariff(), "c1", "Ahmed");
        stay.End();
        stay.AddMember("c2", "Sara");
        Assert.IsTrue(stay.HasMember("c2"));

        var cut = Stay.CreateWalkIn(1, RoomTariff());
        cut.Cancel();
        Assert.ThrowsExactly<SpacesDomainException>(() => cut.AddMember("c3", "Omar"));
    }

    [TestMethod]
    public void Only_a_running_stay_is_cut_short_and_it_closes_its_segment()
    {
        var running = Stay.CreateWalkIn(1, RoomTariff());
        running.Cancel();
        Assert.AreEqual(StayStatus.Cancelled, running.Status);
        Assert.IsNull(running.CurrentOptionCode);
        Assert.IsNotNull(running.EndedAt);
        Assert.IsNotNull(running.Segments.Single().EndTime);
        Assert.IsNull(running.TotalCost, "nothing billed");
        Assert.IsTrue(running.DomainEvents!.OfType<StayCancelledDomainEvent>().Any());
        Assert.ThrowsExactly<SpacesDomainException>(running.Cancel);

        var ended = Stay.CreateWalkIn(1, RoomTariff());
        ended.End();
        Assert.ThrowsExactly<SpacesDomainException>(ended.Cancel);
        Assert.ThrowsExactly<SpacesDomainException>(ended.End);
    }

    [TestMethod]
    public void Marking_paid_is_idempotent_on_the_receipt_number()
    {
        var stay = Stay.CreateWalkIn(1, RoomTariff());
        stay.End();
        Assert.IsTrue(stay.MarkPaid(12, "Cash", DateTime.UtcNow, ticketId: 7));
        Assert.IsFalse(stay.MarkPaid(12, "Cash", DateTime.UtcNow, ticketId: 7));
        Assert.AreEqual(7, stay.TicketId);
        Assert.AreEqual("Cash", stay.PaidWith);
    }

    /// <summary>Moves a segment's start back in time so a test can bill minutes without waiting for them.</summary>
    private static void Backdate(StaySegment segment, int minutes)
    {
        var start = typeof(StaySegment).GetProperty(nameof(StaySegment.StartTime), BindingFlags.Public | BindingFlags.Instance)!;
        start.SetValue(segment, segment.StartTime.AddMinutes(-minutes));
    }
}
