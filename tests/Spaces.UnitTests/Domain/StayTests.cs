using System.Reflection;
using Chillax.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Chillax.Spaces.Domain.AggregatesModel.StayAggregate;
using Chillax.Spaces.Domain.Events;
using Chillax.Spaces.Domain.Exceptions;

namespace Chillax.Spaces.UnitTests.Domain;

[TestClass]
public sealed class StayTests
{
    private static Tariff RoomTariff() => Tariff.Room(60m, 90m);

    [TestMethod]
    public void A_customer_hold_lapses_after_ten_minutes_a_staff_hold_never()
    {
        var customer = new Stay(1, RoomTariff(), "c1", "Ahmed");
        var staff = new Stay(1, RoomTariff(), null, "Walk-in", isStaffCreated: true);

        Assert.AreEqual(StayStatus.Held, customer.Status);
        Assert.IsNotNull(customer.ExpiresAt);
        Assert.AreEqual(Stay.HoldMinutes, Math.Round((customer.ExpiresAt!.Value - customer.CreatedAt).TotalMinutes));
        Assert.IsFalse(customer.IsExpired());

        Assert.IsNull(staff.ExpiresAt);
        Assert.IsFalse(staff.IsExpired());
        Assert.IsTrue(customer.DomainEvents!.OfType<StayHeldDomainEvent>().Any());
    }

    [TestMethod]
    public void A_hold_needs_a_customer_unless_staff_made_it()
    {
        Assert.ThrowsExactly<SpacesDomainException>(() => new Stay(1, RoomTariff(), null, null));
    }

    [TestMethod]
    public void Confirm_starts_the_clock_only_when_the_customer_asked_for_it()
    {
        var plain = new Stay(1, RoomTariff(), "c1", "Ahmed");
        Assert.IsFalse(plain.Confirm());
        Assert.AreEqual(StayStatus.Held, plain.Status);

        var eager = new Stay(1, RoomTariff(), "c1", "Ahmed", startOnConfirm: true);
        Assert.IsTrue(eager.Confirm());
        Assert.AreEqual(StayStatus.Running, eager.Status);
        Assert.AreEqual(Tariff.SingleCode, eager.CurrentOptionCode, "the clock starts on the tariff's first option");
        Assert.IsNotNull(eager.StartedAt);
        Assert.IsTrue(eager.DomainEvents!.OfType<StayStartedDomainEvent>().Any());
        Assert.AreEqual(StayMemberRole.Owner, eager.GetMemberRole("c1"));
    }

    [TestMethod]
    public void Start_takes_the_option_the_till_picked_and_is_case_insensitive()
    {
        var stay = new Stay(1, RoomTariff(), "c1", "Ahmed");
        stay.Start("Multi");
        Assert.AreEqual(Tariff.MultiCode, stay.CurrentOptionCode);
        Assert.AreEqual(90m, stay.Segments.Single().HourlyRate);
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
        var stay = new Stay(1, tariff, "c1", "Ahmed");
        var later = Tariff.Room(999m, 999m);

        Assert.AreEqual(60m, stay.Tariff.Require(Tariff.SingleCode).HourlyRate);
        Assert.AreNotSame(tariff, stay.Tariff, "a snapshot, not the place's own object");
        _ = later;
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
    public void Members_can_still_be_named_after_the_clock_stops_but_not_on_a_hold()
    {
        var held = new Stay(1, RoomTariff(), "c1", "Ahmed");
        Assert.ThrowsExactly<SpacesDomainException>(() => held.AddMember("c2", "Sara"));

        var stay = Stay.CreateWalkIn(1, RoomTariff(), "c1", "Ahmed");
        stay.End();
        stay.AddMember("c2", "Sara");
        Assert.IsTrue(stay.HasMember("c2"));
    }

    [TestMethod]
    public void Cancelling_remembers_whether_a_clock_was_running()
    {
        var held = new Stay(1, RoomTariff(), "c1", "Ahmed");
        held.Cancel();
        Assert.AreEqual(StayStatus.Held, held.DomainEvents!.OfType<StayCancelledDomainEvent>().Single().PreviousStatus);

        var running = Stay.CreateWalkIn(1, RoomTariff());
        running.Cancel();
        Assert.AreEqual(StayStatus.Running, running.DomainEvents!.OfType<StayCancelledDomainEvent>().Single().PreviousStatus);
        Assert.IsNull(running.CurrentOptionCode);

        var ended = Stay.CreateWalkIn(1, RoomTariff());
        ended.End();
        Assert.ThrowsExactly<SpacesDomainException>(ended.Cancel);
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
