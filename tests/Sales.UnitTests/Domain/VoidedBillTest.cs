namespace Ninja.Sales.UnitTests.Domain;

using Ninja.Sales.Domain.AggregatesModel.ShiftAggregate;
using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

/// <summary>
/// A void freezes the bill it cancelled, as a settle freezes a receipt, so
/// the history never revalues it when the rates change later.
/// </summary>
[TestClass]
public class VoidedBillTest
{
    [TestMethod]
    public void A_voided_bill_keeps_what_it_came_to_under_the_rules_it_was_voided_under()
    {
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3", null), branchId: 1);
        ticket.AddManualLine(new LocalizedText("Latte", null), 2, 50, 0, "cashier");
        var then = new PricingRules(0.14m, pricesIncludeVat: false, serviceChargeRate: 0.12m);

        ticket.Void("Walked out", "owner", rules: then);

        // 100, 12 service, 14% VAT on 112 = 15.68
        var later = new PricingRules(0.20m, pricesIncludeVat: false, serviceChargeRate: 0m);
        var bill = ticket.GetBill(later);
        Assert.AreEqual(127.68m, bill.Total);
        Assert.AreEqual(12m, bill.ServiceCharge);
        Assert.AreEqual(15.68m, bill.Vat);
    }

    [TestMethod]
    public void A_bill_voided_before_voids_froze_it_is_still_worked_out()
    {
        var ticket = Ticket.OpenForCounter(branchId: 1);
        ticket.AddManualLine(new LocalizedText("Latte", null), 1, 50, 0, "cashier");

        ticket.Void("Mistake", "owner");

        Assert.AreEqual(57m, ticket.GetBill(new PricingRules(0.14m, pricesIncludeVat: false, serviceChargeRate: 0m)).Total);
    }

    [TestMethod]
    public void A_shift_was_open_from_its_opening_until_its_close()
    {
        var shift = new Shift(branchId: 1, openingFloat: 100, openedBy: "cashier");

        Assert.IsTrue(shift.WasOpenAt(shift.OpenedAt));
        Assert.IsTrue(shift.WasOpenAt(DateTime.UtcNow.AddHours(5)), "an open shift is open from then on");
        Assert.IsFalse(shift.WasOpenAt(shift.OpenedAt.AddMinutes(-1)));

        shift.Close(100, 0, 0, "cashier");

        Assert.IsTrue(shift.WasOpenAt(shift.ClosedAt!.Value.AddTicks(-1)));
        Assert.IsFalse(shift.WasOpenAt(shift.ClosedAt.Value), "a sale at the close is not the closed shift's");
    }
}
