namespace Ninja.Ordering.UnitTests.Domain;

using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;
using Ninja.Ordering.Domain.Events;
using Order = Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order;

/// <summary>
/// An order paid ahead online: checked and priced, it waits for the customer's
/// payment unseen by the till, goes to the till once paid, and is cancelled
/// unpaid when its time runs out. Nothing is collected for it at the door.
/// </summary>
[TestClass]
public class PayAheadTest
{
    private static readonly Guid Payment = Guid.NewGuid();

    private static Delivery ToTahrir() => new(30.0444, 31.2357, "Tahrir St", "12", null, null, null, "01001234567", 20, 1800);

    /// <summary>A guest's delivery of two lattes (2 × 50 + 20 fee = 120), paid ahead, checked and priced</summary>
    private static Order AwaitingPayment(bool delivery = true)
    {
        var order = new Order(string.Empty, string.Empty, 1, guestId: "device-1", guestName: "Mona", guestPhone: "01001234567",
            guestOrdersAnywhere: true, delivery: delivery ? ToTahrir() : null, paysOnline: true);
        order.AddOrderItem(1, new() { En = "Latte" }, 50, 0, null, units: 2);
        order.SetValidatedStatus();
        return order;
    }

    [TestMethod]
    public void Priced_it_waits_for_its_payment_and_the_till_does_not_hear_of_it()
    {
        var order = AwaitingPayment();

        Assert.AreEqual(OrderStatus.AwaitingPayment, order.OrderStatus);
        Assert.IsNotNull(order.PaymentDueBy);
        Assert.IsTrue(order.PaymentDueBy > DateTime.UtcNow + Order.PayAheadWindow - TimeSpan.FromMinutes(1));
        Assert.IsTrue(order.DomainEvents.OfType<OrderAwaitingPaymentDomainEvent>().Any(), "Sales hears of it, to take the payment");
        Assert.IsFalse(order.DomainEvents.OfType<OrderStatusChangedToSubmittedDomainEvent>().Any(), "the till rings only once it is paid");
        Assert.AreEqual(0m, order.ToCollect, "nothing is collected at the door");
        Assert.AreEqual(120m, order.GetTotal());
    }

    [TestMethod]
    public void Paid_it_goes_to_the_till_once()
    {
        var order = AwaitingPayment();
        order.ClearDomainEvents();
        var at = DateTime.UtcNow;

        Assert.IsTrue(order.MarkPaidOnline(Payment, 120m, at));

        Assert.AreEqual(OrderStatus.Submitted, order.OrderStatus);
        Assert.AreEqual(at, order.PaidOnlineAt);
        Assert.AreEqual(Payment, order.OnlinePaymentKey);
        Assert.AreEqual(1, order.DomainEvents.OfType<OrderStatusChangedToSubmittedDomainEvent>().Count());
        Assert.IsFalse(order.MarkPaidOnline(Payment, 120m, at), "the same payment again is a redelivery");
    }

    [TestMethod]
    public void A_payment_it_cannot_take_is_refused_with_its_reason_for_it_to_be_given_back()
    {
        var paid = AwaitingPayment();
        paid.MarkPaidOnline(Payment, 120m, DateTime.UtcNow);
        AssertRefused(PaymentErrors.PaidAlready, () => paid.MarkPaidOnline(Guid.NewGuid(), 120m, DateTime.UtcNow));

        AssertRefused(PaymentErrors.AmountMismatch, () => AwaitingPayment().MarkPaidOnline(Payment, 100m, DateTime.UtcNow));

        var late = AwaitingPayment();
        Assert.IsTrue(late.ExpireUnpaid(late.PaymentDueBy!.Value));
        AssertRefused(PaymentErrors.TooLate, () => late.MarkPaidOnline(Payment, 120m, DateTime.UtcNow));

        var cash = new Order("user-1", "Ali", 1, delivery: ToTahrir());
        cash.AddOrderItem(1, new() { En = "Latte" }, 50, 0, null);
        cash.SetValidatedStatus();
        AssertRefused(PaymentErrors.NotAhead, () => cash.MarkPaidOnline(Payment, 70m, DateTime.UtcNow));
    }

    [TestMethod]
    public void Not_paid_in_time_it_is_cancelled_and_not_a_moment_before()
    {
        var order = AwaitingPayment();
        var due = order.PaymentDueBy!.Value;

        Assert.IsFalse(order.ExpireUnpaid(due.AddSeconds(-1)));
        Assert.AreEqual(OrderStatus.AwaitingPayment, order.OrderStatus);

        Assert.IsTrue(order.ExpireUnpaid(due));
        Assert.AreEqual(OrderStatus.Cancelled, order.OrderStatus);
        Assert.IsTrue(order.DomainEvents.OfType<OrderCancelledDomainEvent>().Any());
        Assert.IsFalse(order.ExpireUnpaid(due.AddMinutes(1)), "once only");
    }

    [TestMethod]
    public void Paid_but_not_accepted_in_time_it_is_cancelled_and_once_accepted_it_never_is()
    {
        var window = TimeSpan.FromMinutes(10);
        var paidAt = new DateTime(2026, 10, 6, 19, 0, 0, DateTimeKind.Utc);
        var order = AwaitingPayment();
        order.MarkPaidOnline(Payment, 120m, paidAt);

        Assert.IsFalse(order.ExpireUnaccepted(paidAt + window - TimeSpan.FromSeconds(1), window));
        Assert.AreEqual(OrderStatus.Submitted, order.OrderStatus);
        Assert.IsTrue(order.ExpireUnaccepted(paidAt + window, window));
        Assert.AreEqual(OrderStatus.Cancelled, order.OrderStatus, "the customer is not left waiting on money they paid");
        Assert.IsTrue(order.DomainEvents.OfType<OrderCancelledDomainEvent>().Any(), "Sales lets the payment go");
        Assert.IsFalse(order.ExpireUnaccepted(paidAt.AddHours(1), window), "once only");

        var accepted = AwaitingPayment();
        accepted.MarkPaidOnline(Payment, 120m, paidAt);
        accepted.SetConfirmedStatus();
        Assert.IsFalse(accepted.ExpireUnaccepted(paidAt.AddHours(1), window));

        var unpaid = AwaitingPayment();
        Assert.IsFalse(unpaid.ExpireUnaccepted(paidAt.AddHours(1), window), "not paid: its own clock (ExpireUnpaid)");
    }

    [TestMethod]
    public void The_customer_may_give_up_while_it_waits_and_only_then()
    {
        var order = AwaitingPayment(delivery: false);
        order.CancelUnpaid();
        Assert.AreEqual(OrderStatus.Cancelled, order.OrderStatus);

        var paid = AwaitingPayment(delivery: false);
        paid.MarkPaidOnline(Payment, 100m, DateTime.UtcNow);
        AssertRefused(PaymentErrors.NotDue, paid.CancelUnpaid);
    }

    [TestMethod]
    public void A_table_or_a_till_order_is_paid_on_its_bill_never_ahead()
    {
        AssertRefused(PaymentErrors.NotAhead, () => new Order("user-1", "Ali", 1, placeId: 4, placeKind: "Table", paysOnline: true));
        AssertRefused(PaymentErrors.NotAhead, () => new Order("cashier-1", "Sara", 1, source: OrderSource.Pos, paysOnline: true));
    }

    [TestMethod]
    public void The_rider_hands_in_no_cash_for_it()
    {
        var order = AwaitingPayment();
        order.MarkPaidOnline(Payment, 120m, DateTime.UtcNow);
        order.SetConfirmedStatus();
        order.AssignRider("rider-1", "Omar");
        order.MarkOutForDelivery();
        order.MarkDelivered();

        AssertRefused(DeliveryErrors.PaidOnline, () => order.MarkDeliveryCashHandedIn(120m));
    }

    private static void AssertRefused(string code, Action act)
    {
        var ex = Assert.ThrowsExactly<OrderingDomainException>(act);
        Assert.AreEqual(code, ex.Code);
    }
}
