namespace Ninja.Sales.UnitTests.Domain;

using Ninja.Sales.Domain.AggregatesModel.ShiftAggregate;
using Ninja.Sales.Domain.Events;
using Ninja.Sales.Domain.Exceptions;

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
    public void Cash_taken_against_tabs_sits_in_the_drawer()
    {
        // Float 200, cash sales 500 with 20 change, a customer paid 100 of
        // their tab in cash → 780 expected; card tab payments never touch it
        var shift = new Shift(branchId: 1, openingFloat: 200, openedBy: "cashier");

        shift.Close(closingCount: 780, cashPayments: 500, changeGiven: 20, closedBy: "cashier", cashRefunds: 0, cashTabPayments: 100);

        Assert.AreEqual(780m, shift.ExpectedCash);
        Assert.AreEqual(0m, shift.OverShort);
    }

    [TestMethod]
    public void Opening_and_closing_announce_themselves()
    {
        // Tenant.API turns the branch flags on and off from these two events
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
    public void A_wage_or_an_advance_names_the_employee_leaves_the_drawer_and_is_announced()
    {
        var shift = new Shift(branchId: 1, openingFloat: 0, openedBy: "cashier", openedByUserId: "sub-1");
        shift.ClearDomainEvents();

        shift.AddMovement(CashMovementType.PayOut, 100, "يومية أحمد", "cashier", CashMovementKind.Wage, employeeId: 7, employeeName: "أحمد");

        var movement = shift.Movements.Single();
        Assert.IsTrue(movement.IsStaffPayOut);
        Assert.AreEqual(7, movement.EmployeeId);
        Assert.AreEqual("sub-1", shift.OpenedByUserId);
        Assert.AreEqual(1, shift.DomainEvents!.OfType<CashPaidOutToStaffDomainEvent>().Count());

        // A supplier pay-out says nothing to Payroll
        shift.ClearDomainEvents();
        shift.AddMovement(CashMovementType.PayOut, 50, "metro", "cashier", CashMovementKind.Supplier);
        Assert.AreEqual(0, shift.DomainEvents?.Count ?? 0);

        Assert.ThrowsExactly<SalesDomainException>(() =>
            shift.AddMovement(CashMovementType.PayOut, 100, "يومية", "cashier", CashMovementKind.Wage));
        Assert.ThrowsExactly<SalesDomainException>(() =>
            shift.AddMovement(CashMovementType.PayIn, 100, "سلفة", "cashier", CashMovementKind.Advance, employeeId: 7));
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
