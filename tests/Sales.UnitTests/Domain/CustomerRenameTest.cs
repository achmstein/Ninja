namespace Ninja.Sales.UnitTests.Domain;

using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;
using Ninja.Sales.Domain.Events;

/// <summary>
/// A customer who renames themselves is the new name on the bills still
/// open; a paid or voided bill keeps the names it was printed with.
/// </summary>
[TestClass]
public class CustomerRenameTest
{
    private static TicketLine Line(string? customerId, string? customerName) =>
        new(TicketLineSource.Order, new LocalizedText("Latte", null), 1, 50, customerName: customerName, customerId: customerId);

    private static Ticket Bill()
    {
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3", null), branchId: 1);
        ticket.AppendOrder(41, [Line("c1", "Ahmed"), Line("c2", "Sara"), Line(null, "Walk-in")], loyaltyDiscount: 0);
        ticket.ClearDomainEvents();
        return ticket;
    }

    [TestMethod]
    public void An_open_bill_says_the_new_name_on_that_customers_lines_only()
    {
        var ticket = Bill();

        Assert.IsTrue(ticket.RenameCustomer("c1", "Ahmed Fathy"));

        Assert.AreEqual("Ahmed Fathy", ticket.Lines.Single(l => l.CustomerId == "c1").CustomerName);
        Assert.AreEqual("Sara", ticket.Lines.Single(l => l.CustomerId == "c2").CustomerName);
        Assert.AreEqual("Walk-in", ticket.Lines.Single(l => l.CustomerId == null).CustomerName);
        Assert.IsTrue(ticket.DomainEvents!.OfType<TicketChangedDomainEvent>().Any(), "the till refetches the bill");
    }

    [TestMethod]
    public void The_same_name_again_changes_nothing()
    {
        var ticket = Bill();

        Assert.IsFalse(ticket.RenameCustomer("c1", "Ahmed"));
        Assert.IsTrue(ticket.DomainEvents is null || ticket.DomainEvents.Count == 0);
    }

    [TestMethod]
    public void A_paid_bill_keeps_the_name_it_was_printed_with()
    {
        var ticket = Bill();
        ticket.Settle([new Payment(PaymentTender.Cash, 1000, "cashier")], "cashier");

        Assert.IsFalse(ticket.RenameCustomer("c1", "Ahmed Fathy"));
        Assert.AreEqual("Ahmed", ticket.Lines.Single(l => l.CustomerId == "c1").CustomerName);
    }
}
