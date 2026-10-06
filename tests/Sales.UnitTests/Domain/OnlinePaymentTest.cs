namespace Ninja.Sales.UnitTests.Domain;

using System.Reflection;
using Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate;
using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;
using Ninja.Sales.Domain.Events;
using Ninja.Sales.Domain.Exceptions;
using Ninja.Sales.Domain.SeedWork;

/// <summary>
/// A table of three paying its bill from three phones: by items, equally, or
/// an amount each; never more than is left, never the same item twice, and
/// a checkout that is abandoned lets its share go.
/// </summary>
[TestClass]
public class OnlinePaymentTest
{
    private static readonly DateTime Now = new(2026, 9, 26, 20, 0, 0, DateTimeKind.Utc);

    // 14% VAT on top and 12% service: a 300 bill is 300 + 36 service + 47.04 VAT = 383.04
    private static readonly PricingRules Rules = new(0.14m, pricesIncludeVat: false, serviceChargeRate: 0.12m);

    [TestMethod]
    public void Three_people_pay_for_their_own_items_and_the_shares_add_up_to_the_total()
    {
        var (ticket, bill) = Table((1, 100m), (2, 120m), (3, 80m));
        Assert.AreEqual(383.04m, bill.Total);
        var paid = new List<OnlinePayment>();

        foreach (var line in new[] { 1, 2, 3 })
        {
            var share = OnlineShares.Items(ticket, bill, [line], paid, Now);
            paid.Add(Pay(share, $"guest-{line}"));
        }

        Assert.AreEqual(127.68m, paid[0].Amount, "100 of 300 is a third of the total");
        Assert.AreEqual(bill.Total, paid.Sum(p => p.Amount), "the last share takes the rounding, so the bill is paid to the piaster");
        Assert.AreEqual(0m, OnlineShares.Remaining(bill.Total, paid, Now));
    }

    [TestMethod]
    public void An_item_being_paid_by_someone_else_cannot_be_paid_again()
    {
        var (ticket, bill) = Table((1, 100m), (2, 120m));
        var first = OnlinePayment.Start(1, 1, OnlineShares.Items(ticket, bill, [1], [], Now), 0, "EGP", "guest-a", null, "paymob", Now);

        var ex = Assert.ThrowsExactly<SalesDomainException>(() => OnlineShares.Items(ticket, bill, [1, 2], [first], Now.AddMinutes(1)));
        Assert.Contains("already paid", ex.Message);

        // Abandoned: the hold runs out and the item is free again
        Assert.IsTrue(first.Expire(Now + OnlinePayment.Hold));
        var again = OnlineShares.Items(ticket, bill, [1, 2], [first], Now + OnlinePayment.Hold);
        Assert.AreEqual(bill.Total, again.Amount);
    }

    [TestMethod]
    public void Dividing_equally_charges_each_part_and_the_last_part_closes_the_bill()
    {
        var (_, bill) = Table((1, 100m));
        Assert.AreEqual(127.68m, bill.Total, "100 + 12 service + 15.68 VAT");
        var paid = new List<OnlinePayment>();

        paid.Add(Pay(OnlineShares.Equal(bill, 1, 3, paid, Now), "a"));
        paid.Add(Pay(OnlineShares.Equal(bill, 1, 3, paid, Now), "b"));
        var last = OnlineShares.Equal(bill, 1, 3, paid, Now);

        Assert.AreEqual(42.56m, paid[0].Amount);
        Assert.AreEqual(42.56m, last.Amount);
        Assert.AreEqual(bill.Total, paid.Sum(p => p.Amount) + last.Amount);

        // Two of three for a friend, from the start
        var two = OnlineShares.Equal(bill, 2, 3, [], Now);
        Assert.AreEqual(85.12m, two.Amount);
    }

    [TestMethod]
    public void A_custom_amount_can_never_be_more_than_is_left_counting_checkouts_in_progress()
    {
        var (_, bill) = Table((1, 100m));
        var holding = OnlinePayment.Start(1, 1, OnlineShares.Custom(bill, 110m, [], Now), 0, "EGP", "a", null, "paymob", Now);

        var ex = Assert.ThrowsExactly<SalesDomainException>(() => OnlineShares.Custom(bill, 20m, [holding], Now));
        Assert.Contains("17.68", ex.Message, "only what is neither paid nor held is left");
        Assert.AreEqual(17.68m, OnlineShares.Custom(bill, 17.68m, [holding], Now).Amount);
        Assert.ThrowsExactly<SalesDomainException>(() => OnlineShares.Custom(bill, 0m, [], Now));
    }

    [TestMethod]
    public void Paying_fully_takes_what_is_left_and_a_paid_bill_takes_nothing_more()
    {
        var (_, bill) = Table((1, 100m));
        var part = Pay(OnlineShares.Custom(bill, 50m, [], Now), "a");

        var rest = OnlineShares.Full(bill, [part], Now);
        Assert.AreEqual(77.68m, rest.Amount);

        var all = Pay(rest, "b");
        Assert.ThrowsExactly<SalesDomainException>(() => OnlineShares.Full(bill, [part, all], Now));
    }

    [TestMethod]
    public void The_providers_callback_marks_it_paid_once_and_a_repeat_is_nothing()
    {
        var (_, bill) = Table((1, 100m));
        var payment = OnlinePayment.Start(1, 1, OnlineShares.Full(bill, [], Now), 2.5m, "EGP", "a", " Sara ", "paymob", Now);
        Assert.AreEqual(130.18m, payment.Charged, "the share and the fee the guest carries");
        Assert.AreEqual("Sara", payment.PayerName);

        Assert.IsTrue(payment.MarkPaid("tx-1", Now.AddMinutes(1)));
        Assert.IsFalse(payment.MarkPaid("tx-1", Now.AddMinutes(2)), "a repeated callback is a no-op");
        Assert.ThrowsExactly<SalesDomainException>(() => payment.MarkPaid("tx-2", Now));
        Assert.IsFalse(payment.MarkFailed("declined"), "a late failure does not undo a payment");
        Assert.AreEqual(OnlinePaymentStatus.Paid, payment.Status);
        Assert.AreEqual(1, payment.DomainEvents!.OfType<OnlinePaymentPaidDomainEvent>().Count());
    }

    [TestMethod]
    public void An_order_paid_ahead_is_held_then_charged_once_or_let_go_and_never_both()
    {
        var held = OnlinePayment.StartForOrder(41, 1, 115m, 0, "EGP", "guest-1", null, "paymob", Now, hold: true);
        Assert.IsTrue(held.CardHold);
        Assert.IsTrue(held.MarkAuthorized("tx-1", Now.AddMinutes(1)));
        Assert.IsFalse(held.MarkAuthorized("tx-1", Now.AddMinutes(2)), "a repeated callback is a no-op");
        Assert.ThrowsExactly<SalesDomainException>(() => held.MarkAuthorized("tx-2", Now));
        Assert.ThrowsExactly<SalesDomainException>(() => held.MarkPaid("tx-3", Now), "a held payment is charged by its capture, not by another transaction");
        Assert.AreEqual(OnlinePaymentStatus.Authorized, held.Status);
        Assert.IsTrue(held.Secured);
        Assert.IsTrue(held.Holds(Now.AddDays(1)), "what it holds is not offered to anyone else");
        Assert.IsFalse(held.DomainEvents?.OfType<OnlinePaymentPaidDomainEvent>().Any() ?? false, "held is not paid");

        Assert.IsTrue(held.MarkCaptured(Now.AddMinutes(5)));
        Assert.IsFalse(held.MarkCaptured(Now.AddMinutes(6)), "a capture repeated is a no-op");
        Assert.AreEqual(OnlinePaymentStatus.Paid, held.Status);
        Assert.AreEqual(Now.AddMinutes(5), held.PaidAt);
        Assert.AreEqual(1, held.DomainEvents!.OfType<OnlinePaymentPaidDomainEvent>().Count());
        Assert.ThrowsExactly<SalesDomainException>(() => held.Void("ordering", Now), "a charged payment is refunded, not let go");
        Assert.IsFalse(held.MarkAuthorized("tx-1", Now.AddMinutes(7)), "the hold's own callback, late, changes nothing");

        var letGo = OnlinePayment.StartForOrder(42, 1, 115m, 0, "EGP", "guest-1", null, "paymob", Now, hold: true);
        letGo.MarkAuthorized("tx-9", Now);
        Assert.IsTrue(letGo.Void("ordering", Now.AddMinutes(3)));
        Assert.IsFalse(letGo.Void("ordering", Now.AddMinutes(4)));
        Assert.AreEqual(OnlinePaymentStatus.Voided, letGo.Status);
        Assert.IsFalse(letGo.Holds(Now.AddMinutes(4)));
        Assert.ThrowsExactly<SalesDomainException>(() => letGo.MarkCaptured(Now), "a hold let go is never charged");
        Assert.ThrowsExactly<SalesDomainException>(() => letGo.Refund("ordering", Now), "nothing was taken to give back");
    }

    [TestMethod]
    public void Money_that_arrives_after_the_hold_ran_out_is_still_paid()
    {
        var (_, bill) = Table((1, 100m));
        var payment = OnlinePayment.Start(1, 1, OnlineShares.Full(bill, [], Now), 0, "EGP", "a", null, "paymob", Now);
        payment.Expire(Now.AddHours(1));

        Assert.IsTrue(payment.MarkPaid("tx-1", Now.AddHours(1)));
        Assert.IsTrue(payment.Holds(Now.AddDays(1)));
    }

    [TestMethod]
    public void A_refund_gives_the_share_back_to_the_bill()
    {
        var (_, bill) = Table((1, 100m));
        var payment = Pay(OnlineShares.Full(bill, [], Now), "a");

        payment.Refund("owner", Now);

        Assert.AreEqual(bill.Total, OnlineShares.Remaining(bill.Total, [payment], Now));
        Assert.ThrowsExactly<SalesDomainException>(() => payment.Refund("owner", Now));
    }

    [TestMethod]
    public void The_guest_fee_covers_what_the_provider_keeps()
    {
        // 2.75% + 3: on 100 the guest pays 105.91, and 2.75% of that plus 3 is the 5.91
        var fee = OnlineShares.GuestFee(100m, 2.75m, 3m);
        Assert.AreEqual(5.91m, fee);
        Assert.AreEqual(0m, OnlineShares.GuestFee(100m, 0m, 0m));
    }

    [TestMethod]
    public void Paid_online_settles_the_ticket_as_an_online_tender()
    {
        var (ticket, bill) = Table((1, 100m));
        var payment = Pay(OnlineShares.Full(bill, [], Now), "a");

        ticket.Settle([new Payment(PaymentTender.Online, payment.Amount, "online")], "online", rules: Rules);

        Assert.AreEqual(TicketStatus.Settled, ticket.Status);
        Assert.AreEqual("Online", Payment.DescribeTenders(ticket.Payments));
    }

    private static OnlinePayment Pay(OnlineShare share, string payer)
    {
        var payment = OnlinePayment.Start(1, 1, share, 0, "EGP", payer, null, "paymob", Now);
        payment.MarkPaid($"tx-{payer}-{share.Amount}", Now);
        return payment;
    }

    private static (Ticket Ticket, Bill Bill) Table(params (int Id, decimal Price)[] lines)
    {
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3", null), branchId: 1);
        var built = lines.Select(l =>
        {
            var line = new TicketLine(TicketLineSource.Order, new LocalizedText($"Item {l.Id}", null), 1, l.Price, orderId: null);
            // Ids are the database's; the shares name lines by them
            typeof(Entity).GetProperty(nameof(Entity.Id))!.SetValue(line, l.Id);
            return line;
        }).ToList();
        ticket.AppendOrder(1, built, 0);
        return (ticket, ticket.GetBill(Rules));
    }
}
