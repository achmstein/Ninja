namespace Chillax.Sales.UnitTests.Domain;

using Chillax.Sales.Domain.AggregatesModel.ShiftAggregate;
using Chillax.Sales.Domain.Events;
using Chillax.Sales.Domain.Exceptions;

[TestClass]
public class ShiftAggregateTest
{
    [TestMethod]
    public void Close_computes_expected_cash_and_over_short()
    {
        // Float 200, +50 pay-in, −30 pay-out, cash sales 500 with 20 change
        // handed back → expected 700; counted 690 → 10 short
        var shift = new Shift(branchId: 1, openingFloat: 200, openedBy: "cashier");
        shift.AddMovement(CashMovementType.PayIn, 50, "change top-up", "cashier");
        shift.AddMovement(CashMovementType.PayOut, 30, "supplier", "cashier");

        shift.Close(closingCount: 690, cashPayments: 500, changeGiven: 20, closedBy: "cashier");

        Assert.AreEqual(700m, shift.ExpectedCash);
        Assert.AreEqual(-10m, shift.OverShort);
        Assert.AreEqual(ShiftStatus.Closed, shift.Status);
    }

    [TestMethod]
    public void Opening_and_closing_announce_themselves()
    {
        // Branch.API turns the branch flags on and off from these two events
        var shift = new Shift(branchId: 1, openingFloat: 0, openedBy: "cashier");

        var opened = shift.DomainEvents!.OfType<ShiftOpenedDomainEvent>().Single();
        Assert.AreSame(shift, opened.Shift);
        Assert.IsFalse(shift.DomainEvents!.OfType<ShiftClosedDomainEvent>().Any());

        shift.Close(0, 0, 0, "cashier");

        var closed = shift.DomainEvents!.OfType<ShiftClosedDomainEvent>().Single();
        Assert.AreSame(shift, closed.Shift);
    }

    [TestMethod]
    public void A_closed_shift_is_frozen()
    {
        var shift = new Shift(branchId: 1, openingFloat: 0, openedBy: "cashier");
        shift.Close(0, 0, 0, "cashier");

        Assert.ThrowsExactly<SalesDomainException>(() =>
            shift.AddMovement(CashMovementType.PayIn, 10, "late", "cashier"));
        Assert.ThrowsExactly<SalesDomainException>(() =>
            shift.Close(0, 0, 0, "cashier"));
    }

    [TestMethod]
    public void Movements_need_a_reason_and_a_positive_amount()
    {
        var shift = new Shift(branchId: 1, openingFloat: 0, openedBy: "cashier");

        Assert.ThrowsExactly<SalesDomainException>(() =>
            shift.AddMovement(CashMovementType.PayOut, 0, "supplier", "cashier"));
        Assert.ThrowsExactly<SalesDomainException>(() =>
            shift.AddMovement(CashMovementType.PayOut, 10, " ", "cashier"));
    }

    [TestMethod]
    public void Negative_float_or_count_is_refused()
    {
        Assert.ThrowsExactly<SalesDomainException>(() =>
            new Shift(branchId: 1, openingFloat: -1, openedBy: "cashier"));

        var shift = new Shift(branchId: 1, openingFloat: 0, openedBy: "cashier");
        Assert.ThrowsExactly<SalesDomainException>(() => shift.Close(-1, 0, 0, "cashier"));
    }
}
