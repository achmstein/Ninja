namespace Ninja.Sales.UnitTests.Application;

using System.Text.Json;
using Ninja.Sales.API.Payments;
using Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate;
using Ninja.Sales.Domain.Exceptions;

/// <summary>
/// The money a payment still owes at its provider: recorded before it is made, retried with growing
/// pauses while the provider may yet answer, put before the owner when it keeps failing or is refused,
/// and read against the provider's own record so a move is never made twice.
/// </summary>
[TestClass]
public class PaymentMovesTest
{
    private static readonly DateTime Now = new(2026, 10, 6, 19, 0, 0, DateTimeKind.Utc);

    private static OnlinePayment Held()
    {
        var payment = OnlinePayment.StartForOrder(41, 1, 115m, 0, "EGP", "guest-1", null, "paymob", Now, hold: true);
        payment.MarkAuthorized("tx-1", Now);
        return payment;
    }

    [TestMethod]
    public void A_move_that_may_pass_is_retried_less_and_less_often_and_the_owner_is_told_once_it_keeps_failing()
    {
        var payment = Held();
        Assert.IsTrue(payment.RequestCapture("ordering", Now));
        Assert.IsFalse(payment.RequestCapture("ordering", Now), "asked once");
        Assert.AreEqual(Now, payment.MoveDueAt, "made at once");

        var pauses = new List<TimeSpan>();
        for (var i = 1; i <= 7; i++)
        {
            var at = Now.AddHours(i);
            payment.MoveFailed("Paymob did not answer the capture.", retry: true, at);
            pauses.Add(payment.MoveDueAt!.Value - at);
            Assert.AreEqual(i >= OnlinePayment.AttentionAfter, payment.AttentionSince is not null, $"after {i} failure(s)");
        }
        CollectionAssert.AreEqual(
            new[] { 30d, 60, 120, 300, 600, 1800, 3600 },
            pauses.Select(p => p.TotalSeconds).ToArray());
        Assert.AreEqual(Now.AddHours(OnlinePayment.AttentionAfter), payment.AttentionSince, "since the failure that made it the owner's");

        payment.MarkCaptured(Now.AddDays(1));
        Assert.AreEqual(PaymentMove.None, payment.Move);
        Assert.IsNull(payment.AttentionSince, "made at last: nothing left for the owner");
        Assert.IsNull(payment.Problem);
    }

    [TestMethod]
    public void A_refusal_is_the_owners_at_once_and_is_not_retried_until_they_say()
    {
        var payment = Held();
        payment.RequestCapture("ordering", Now);
        payment.MoveFailed("Paymob refused the capture (400): not capturable", retry: false, Now);

        Assert.AreEqual(Now, payment.AttentionSince);
        Assert.IsNull(payment.MoveDueAt, "not tried again by itself");
        Assert.ThrowsExactly<SalesDomainException>(payment.Dismiss, "money still owed: retried, or marked done, never just dismissed");

        payment.RetryMoveNow(Now.AddMinutes(5));
        Assert.AreEqual(Now.AddMinutes(5), payment.MoveDueAt);
    }

    [TestMethod]
    public void Cancelled_before_its_charge_was_made_the_hold_is_let_go_instead()
    {
        var payment = Held();
        payment.AttachToTicket(7);
        payment.RequestCapture("ordering", Now);

        Assert.IsTrue(payment.RequestGiveBack("ordering", "The order was cancelled", Now));
        Assert.AreEqual(PaymentMove.Void, payment.Move, "never charge what is to be given back");
        Assert.ThrowsExactly<SalesDomainException>(() => payment.RequestCapture("ordering", Now));

        Assert.IsTrue(payment.Void("ordering", Now));
        Assert.AreEqual(PaymentMove.None, payment.Move);
        Assert.IsFalse(payment.RequestGiveBack("ordering", "again", Now), "nothing left to give back");
    }

    [TestMethod]
    public void A_charged_payment_is_refunded_and_a_checkout_still_open_is_only_closed()
    {
        var paid = OnlinePayment.StartForOrder(42, 1, 60m, 0, "EGP", "guest-1", null, "paymob", Now);
        paid.MarkPaid("tx-2", Now);
        Assert.IsTrue(paid.RequestGiveBack("ordering", "came back", Now));
        Assert.AreEqual(PaymentMove.Refund, paid.Move);

        var open = OnlinePayment.StartForOrder(43, 1, 60m, 0, "EGP", "guest-1", null, "paymob", Now);
        Assert.IsFalse(open.RequestGiveBack("ordering", "cancelled", Now), "no money moved");
        Assert.AreEqual(OnlinePaymentStatus.Failed, open.Status);
    }

    [TestMethod]
    public void A_refusal_a_cashier_heard_is_dropped_not_left_for_the_owner()
    {
        var paid = OnlinePayment.StartForOrder(44, 1, 60m, 0, "EGP", "guest-1", null, "paymob", Now);
        paid.MarkPaid("tx-3", Now);
        paid.RequestGiveBack("cashier-1", "Refunded at the till", Now);

        paid.DropMove("Refund period expired");

        Assert.AreEqual(PaymentMove.None, paid.Move);
        Assert.AreEqual(OnlinePaymentStatus.Paid, paid.Status);
        Assert.IsNull(paid.AttentionSince);
    }

    [TestMethod]
    public void The_providers_record_says_whether_a_move_was_made_already()
    {
        static ProviderTransaction Record(bool captured = false, bool voided = false, bool refunded = false)
            => new("tx-1", "4242", true, false, true, captured, voided, refunded, 115m, null);

        Assert.AreEqual(MoveRecord.Done, PaymentMoves.Settled(Record(captured: true), PaymentMove.Capture));
        Assert.AreEqual(MoveRecord.Lapsed, PaymentMoves.Settled(Record(voided: true), PaymentMove.Capture), "a hold the bank let go cannot be charged");
        Assert.AreEqual(MoveRecord.Done, PaymentMoves.Settled(Record(voided: true), PaymentMove.Void));
        Assert.AreEqual(MoveRecord.Done, PaymentMoves.Settled(Record(captured: true, refunded: true), PaymentMove.Refund));
        Assert.IsNull(PaymentMoves.Settled(Record(), PaymentMove.Capture), "still only held: charge it");
        Assert.IsNull(PaymentMoves.Settled(Record(captured: true), PaymentMove.Refund), "charged, not given back: refund it");
        Assert.IsNull(PaymentMoves.Settled(null, PaymentMove.Capture), "not known: try it");
    }

    [TestMethod]
    public void The_daily_check_says_in_the_owners_words_where_paymob_disagrees()
    {
        var paid = OnlinePayment.StartForOrder(45, 1, 115m, 0, "EGP", "guest-1", null, "paymob", Now);
        paid.MarkPaid("tx-4", Now);

        Assert.AreEqual(
            "We have this payment as paid; Paymob says it was refunded.",
            PaymentChecks.Disagreement(paid, new("tx-4", null, true, false, false, false, false, true, 115m, null)));
        Assert.IsNull(PaymentChecks.Disagreement(paid, new("tx-4", null, true, false, false, false, false, false, 115m, null)), "they agree");

        var held = Held();
        Assert.AreEqual(
            "We have this card as held; Paymob says it was let go uncharged.",
            PaymentChecks.Disagreement(held, new("tx-1", null, true, false, true, false, true, false, 115m, null)));
    }

    [TestMethod]
    public void Paymobs_transaction_is_read_as_it_writes_it()
    {
        using var json = JsonDocument.Parse("""
            {
              "id": 192837, "success": true, "pending": false, "is_auth": true, "is_captured": true,
              "captured_amount": 11500, "is_voided": false, "is_refunded": true, "refunded_amount_cents": 5000,
              "amount_cents": 11500, "order": { "id": 4242, "merchant_order_id": "abc" }, "data": { "message": "Approved" }
            }
            """);

        var read = PaymobProvider.Read(json.RootElement);

        Assert.AreEqual("192837", read.TransactionId);
        Assert.AreEqual("4242", read.ProviderReference);
        Assert.IsTrue(read.Success);
        Assert.IsTrue(read.IsAuth);
        Assert.IsTrue(read.Captured);
        Assert.IsFalse(read.Refunded, "part given back is not given back");
        Assert.AreEqual(115m, read.Amount);
        Assert.AreEqual("Approved", read.Error);
    }
}
