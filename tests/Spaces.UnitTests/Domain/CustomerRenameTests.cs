using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Ninja.Spaces.Domain.AggregatesModel.StayAggregate;

namespace Ninja.Spaces.UnitTests.Domain;

/// <summary>
/// A customer who renames themselves is the new name on what is still to
/// come or running; what is over keeps the name it had.
/// </summary>
[TestClass]
public sealed class CustomerRenameTests
{
    private static Place Room() => Place.Room(new LocalizedText("Room 1", null), 60m, 90m, 1);

    [TestMethod]
    public void An_open_reservation_takes_the_new_name()
    {
        var r = new Reservation(Room(), "c1", "Ahmed");

        Assert.IsTrue(r.RenameCustomer("c1", "Ahmed Fathy"));
        Assert.AreEqual("Ahmed Fathy", r.CustomerName);

        r.Confirm();
        Assert.IsTrue(r.RenameCustomer("c1", "Ahmed F."));
        Assert.AreEqual("Ahmed F.", r.CustomerName);
        Assert.IsFalse(r.RenameCustomer("c1", "Ahmed F."), "the same name again changes nothing");
    }

    [TestMethod]
    public void A_reservation_that_is_over_keeps_its_name()
    {
        var r = new Reservation(Room(), "c1", "Ahmed");
        r.Cancel();

        Assert.IsFalse(r.RenameCustomer("c1", "Ahmed Fathy"));
        Assert.AreEqual("Ahmed", r.CustomerName);
    }

    [TestMethod]
    public void Someone_elses_reservation_is_not_renamed()
    {
        var r = new Reservation(Room(), "c1", "Ahmed");

        Assert.IsFalse(r.RenameCustomer("c2", "Sara"));
        Assert.AreEqual("Ahmed", r.CustomerName);
    }

    [TestMethod]
    public void A_running_stay_renames_its_owner_and_the_party()
    {
        var room = Room();
        var stay = Stay.FromReservation(new Reservation(room, "c1", "Ahmed"), room.Tariff!);
        stay.AddMember("c2", "Sara");

        Assert.IsTrue(stay.RenameCustomer("c1", "Ahmed Fathy"));
        Assert.AreEqual("Ahmed Fathy", stay.CustomerName);
        Assert.AreEqual("Ahmed Fathy", stay.Members.Single(m => m.CustomerId == "c1").CustomerName);

        Assert.IsTrue(stay.RenameCustomer("c2", "Sara Ali"));
        Assert.AreEqual("Sara Ali", stay.Members.Single(m => m.CustomerId == "c2").CustomerName);
        Assert.AreEqual("Ahmed Fathy", stay.CustomerName, "a member's rename leaves the owner as they are");

        Assert.IsFalse(stay.RenameCustomer("c2", "Sara Ali"), "the same name again changes nothing");
    }

    [TestMethod]
    public void A_stay_that_is_over_keeps_its_names()
    {
        var room = Room();
        var stay = Stay.FromReservation(new Reservation(room, "c1", "Ahmed"), room.Tariff!);
        stay.End();

        Assert.IsFalse(stay.RenameCustomer("c1", "Ahmed Fathy"));
        Assert.AreEqual("Ahmed", stay.CustomerName);
        Assert.AreEqual("Ahmed", stay.Members.Single().CustomerName);
    }
}
