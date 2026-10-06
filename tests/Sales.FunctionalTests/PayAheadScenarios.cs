using System.Net;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Ninja.Sales.API.Application.IntegrationEvents.EventHandling;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.API.Payments;
using Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate;
using Ninja.Sales.Infrastructure;
using Ninja.Sales.Infrastructure.Projections;
using Ninja.Testing;

namespace Ninja.Sales.FunctionalTests;

public record PayAheadOptions(bool Available, string Currency, string FeeMode, decimal FeePercent, decimal FeeFixed, bool Simulated);
public record OrderToPay(int OrderId, decimal Amount, decimal Fee, decimal Charged, string Currency, string Status, DateTime DueBy, Guid? PaymentKey, string? PaymentStatus, bool Simulated);
public record PayAheadStatus(Guid Key, int? TicketId, int? OrderId, string Status, decimal Amount);
public record AttentionRow(Guid Key, int? OrderId, string Status, string Move, string? Problem, int Attempts);

/// <summary>
/// Orders paid ahead online: the customer's card is held (not charged) at the
/// checkout, before the business sees the order; it is charged when the till
/// accepts the order, and its bill settles itself with it; an order turned
/// down or cancelled lets the hold go at no cost, and one already charged is
/// refunded with a credit note. A capture Paymob refuses is tried again until
/// it goes through. A delivery paid at the door is never paid online.
/// </summary>
[TestClass]
public sealed class PayAheadScenarios
{
    private const string Version = "api-version=1.0";
    private const int HoldIntegration = 456;
    private static int _nextOrder = 980_000;

    private static async Task PayAheadOnAsync(bool on = true)
    {
        await PaymentScenarios.SetUpBusinessAsync();
        using var scope = Suite.Sales.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SalesContext>();
        var row = await db.TenantFeatures.SingleAsync();
        row.PayAhead = on;
        await db.SaveChangesAsync();
    }

    /// <summary>Ordering priced a delivery of two lattes (95) and its fee (20), paid ahead by a guest</summary>
    private static async Task<(int OrderId, Caller Guest)> AwaitingPaymentAsync()
    {
        var orderId = Interlocked.Increment(ref _nextOrder);
        var guestId = $"guest-ahead-{orderId}";
        await HandleAsync<OrderAwaitingPaymentIntegrationEventHandler, OrderAwaitingPaymentIntegrationEvent>(new(
            orderId, Suite.Branch, 115m, null, guestId, "Mona Adel", "01001234567", IsDelivery: true, DateTime.UtcNow.AddMinutes(20)));
        return (orderId, PaymentScenarios.Guest(guestId));
    }

    private static OrderStatusChangedToConfirmedIntegrationEvent Confirmed(int orderId, Guid? paidOnlineKey) => new(
        orderId,
        BuyerName: "Mona Adel",
        BuyerIdentityGuid: "",
        OrderTotal: 115m,
        PointsToRedeem: 0,
        GuestId: null,
        BranchId: Suite.Branch,
        SessionId: null,
        Source: "Guest",
        GuestPhone: "01001234567",
        LoyaltyDiscount: 0,
        Items: [new(12, new("Latte", "لاتيه"), 2, 47.50m, 0m, null)],
        CustomerName: "Mona Adel",
        DeliveryFee: 20m,
        IsDelivery: true)
    {
        PaidOnlineKey = paidOnlineKey,
    };

    private static async Task HandleAsync<THandler, TEvent>(TEvent @event)
        where THandler : Ninja.EventBus.Abstractions.IIntegrationEventHandler<TEvent>
        where TEvent : Ninja.EventBus.Events.IntegrationEvent
    {
        using var scope = Suite.Sales.Services.CreateScope();
        await ActivatorUtilities.CreateInstance<THandler>(scope.ServiceProvider).Handle(@event);
    }

    private static Task ConfirmAsync(int orderId, Guid key)
        => HandleAsync<OrderStatusChangedToConfirmedIntegrationEventHandler, OrderStatusChangedToConfirmedIntegrationEvent>(Confirmed(orderId, key));

    private static Task CancelAsync(int orderId)
        => HandleAsync<OrderStatusChangedToCancelledIntegrationEventHandler, OrderStatusChangedToCancelledIntegrationEvent>(new(orderId));

    private static async Task<(OnlinePayment Payment, OrderPaymentDue Due)> StateAsync(int orderId, Guid key)
    {
        using var scope = Suite.Sales.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SalesContext>();
        return (await db.OnlinePayments.AsNoTracking().SingleAsync(p => p.Key == key), await db.OrderPaymentsDue.AsNoTracking().SingleAsync(d => d.OrderId == orderId));
    }

    private static int Calls(string path) => SalesUnderTest.Paymob.Requests.Count(r => r.Path == path);

    /// <summary>The customer pays: the card is held on the business's holding integration (Paymob calls back is_auth)</summary>
    private static async Task<Guid> HoldAsync(int orderId, Caller guest)
    {
        var started = await guest.PostAsync<Started>($"/api/sales/payments/orders/{orderId}?{Version}", new { payerName = "Mona" });
        Assert.AreEqual(115m, started.Amount, "the whole order, its fee in");
        var intention = SalesUnderTest.Paymob.Requests.Last(r => r.Path == "/v1/intention/");
        var methods = intention.Body!["payment_methods"]!.AsArray().Select(n => n!.GetValue<int>()).ToList();
        CollectionAssert.Contains(methods, HoldIntegration, "the card that holds, not the one that charges");
        CollectionAssert.DoesNotContain(methods, 123);
        Assert.AreEqual(HttpStatusCode.OK, await PaymentScenarios.CallbackAsync(PaymentScenarios.OrderFor(started.Key), started.Key, started.Charged, isAuth: true));
        return started.Key;
    }

    private static async Task<int> BillOfAsync(Guid key)
    {
        using var scope = Suite.Sales.Services.CreateScope();
        return (await scope.ServiceProvider.GetRequiredService<SalesContext>().OnlinePayments.AsNoTracking().SingleAsync(p => p.Key == key)).TicketId!.Value;
    }

    [TestMethod]
    public async Task The_checkout_is_told_whether_paying_ahead_is_on()
    {
        await PayAheadOnAsync(on: false);
        Assert.IsFalse((await Suite.Sales.AsAnonymous().GetAsync<PayAheadOptions>($"/api/sales/payments/ahead?{Version}")).Available, "the owner's switch is off");

        await PayAheadOnAsync();
        var on = await Suite.Sales.AsAnonymous().GetAsync<PayAheadOptions>($"/api/sales/payments/ahead?{Version}");
        Assert.IsTrue(on.Available);
        Assert.AreEqual("EGP", on.Currency);
    }

    [TestMethod]
    public async Task The_card_is_held_until_the_branch_accepts_then_charged_and_the_bill_settles_itself()
    {
        await PayAheadOnAsync();
        var (orderId, guest) = await AwaitingPaymentAsync();
        Assert.AreEqual("Due", (await guest.GetAsync<OrderToPay>($"/api/sales/payments/orders/{orderId}?{Version}")).Status);

        var key = await HoldAsync(orderId, guest);
        var (payment, due) = await StateAsync(orderId, key);
        Assert.AreEqual(OnlinePaymentStatus.Authorized, payment.Status, "held, not charged");
        Assert.AreEqual(OrderPaymentDueStatus.Paid, due.Status, "secured: Ordering is told, and the order goes to the till");
        Assert.AreEqual(orderId, (await guest.GetAsync<PayAheadStatus>($"/api/sales/payments/{key}?{Version}")).OrderId);

        // Paymob reports the hold's follow-up transactions too; they change nothing
        Assert.AreEqual(HttpStatusCode.OK, await PaymentScenarios.CallbackAsync(PaymentScenarios.OrderFor(key), key, 115m, followUp: true));
        Assert.AreEqual(OnlinePaymentStatus.Authorized, (await StateAsync(orderId, key)).Payment.Status);

        var captures = Calls("/api/acceptance/capture");
        await ConfirmAsync(orderId, key);

        Assert.AreEqual(captures + 1, Calls("/api/acceptance/capture"), "charged when the branch accepted");
        var capture = SalesUnderTest.Paymob.Requests.Last(r => r.Path == "/api/acceptance/capture");
        Assert.AreEqual(11500, capture.Body!["amount_cents"]!.GetValue<long>());
        (payment, _) = await StateAsync(orderId, key);
        Assert.AreEqual(OnlinePaymentStatus.Paid, payment.Status);
        var bill = await Suite.Sales.As(Persona.Cashier(Suite.Branch), Suite.Branch).GetAsync<TicketView>($"/api/tickets/{payment.TicketId}?{Version}");
        Assert.AreEqual("Settled", bill.Status);
        Assert.AreEqual("Online", bill.Payments.Single().Tender, "nothing for the drawer");
    }

    /// <summary>Paymob's record of a transaction as its inquiry reads it</summary>
    private static JsonObject Record(string id, bool captured = false, bool voided = false, bool refunded = false, bool auth = true) => new()
    {
        ["id"] = long.Parse(id),
        ["success"] = true,
        ["pending"] = false,
        ["is_auth"] = auth,
        ["is_captured"] = captured,
        ["captured_amount"] = captured ? 11500 : 0,
        ["is_voided"] = voided,
        ["is_refunded"] = refunded,
        ["refunded_amount_cents"] = refunded ? 11500 : 0,
        ["amount_cents"] = 11500,
        ["order"] = new JsonObject { ["id"] = 4242 },
    };

    private static async Task<string> TransactionOfAsync(int orderId, Guid key) => (await StateAsync(orderId, key)).Payment.TransactionId!;

    private static Func<string, JsonNode?, HttpResponseMessage?> Capture(Func<HttpResponseMessage> answer)
        => (path, _) => path == "/api/acceptance/capture" ? answer() : null;

    private static async Task<T> WithPaymobAsync<T>(Func<string, JsonNode?, HttpResponseMessage?> answer, Func<Task<T>> act)
    {
        SalesUnderTest.Paymob.Answer = answer;
        try
        {
            return await act();
        }
        finally
        {
            SalesUnderTest.Paymob.Answer = null;
        }
    }

    private static Task WithPaymobAsync(Func<string, JsonNode?, HttpResponseMessage?> answer, Func<Task> act)
        => WithPaymobAsync(answer, async () => { await act(); return 0; });

    private static Task<TicketView> BillAsync(int ticketId)
        => Suite.Sales.As(Persona.Cashier(Suite.Branch), Suite.Branch).GetAsync<TicketView>($"/api/tickets/{ticketId}?{Version}");

    [TestMethod]
    public async Task Paymob_not_answering_a_charge_it_made_is_found_charged_and_never_charged_twice()
    {
        await PayAheadOnAsync();
        var (orderId, guest) = await AwaitingPaymentAsync();
        var key = await HoldAsync(orderId, guest);
        SalesUnderTest.Paymob.Transactions[await TransactionOfAsync(orderId, key)] = Record(await TransactionOfAsync(orderId, key), captured: true);
        var captures = Calls("/api/acceptance/capture");

        // The charge goes through at Paymob, its answer is lost on the way back
        await WithPaymobAsync(Capture(() => throw new HttpRequestException("connection reset")), () => ConfirmAsync(orderId, key));

        var (payment, _) = await StateAsync(orderId, key);
        Assert.AreEqual(OnlinePaymentStatus.Paid, payment.Status, "Paymob was asked, and says it is charged");
        Assert.AreEqual(captures + 1, Calls("/api/acceptance/capture"), "asked, not charged again");
        Assert.AreEqual("Settled", (await BillAsync(payment.TicketId!.Value)).Status);
    }

    [TestMethod]
    public async Task A_charge_paymob_cannot_make_now_is_tried_again_until_it_goes_through()
    {
        await PayAheadOnAsync();
        var (orderId, guest) = await AwaitingPaymentAsync();
        var key = await HoldAsync(orderId, guest);

        await WithPaymobAsync(Capture(() => new HttpResponseMessage(HttpStatusCode.BadGateway)), () => ConfirmAsync(orderId, key));

        var (payment, _) = await StateAsync(orderId, key);
        Assert.AreEqual(OnlinePaymentStatus.Authorized, payment.Status, "still held, on its bill");
        Assert.AreEqual(PaymentMove.Capture, payment.Move);
        Assert.IsGreaterThan(DateTime.UtcNow, payment.MoveDueAt!.Value, "tried again after a pause");
        Assert.IsNull(payment.AttentionSince, "one failure that may pass is nothing for the owner yet");
        Assert.AreEqual("Open", (await BillAsync(payment.TicketId!.Value)).Status, "the order is made all the same");

        await PaymentScenarios.DueNowAsync(key);
        await PaymentScenarios.TurnTheClockworkAsync();

        (payment, _) = await StateAsync(orderId, key);
        Assert.AreEqual(OnlinePaymentStatus.Paid, payment.Status);
        Assert.AreEqual(PaymentMove.None, payment.Move);
        Assert.AreEqual("Settled", (await BillAsync(payment.TicketId!.Value)).Status);
    }

    [TestMethod]
    public async Task A_charge_paymob_refuses_waits_on_the_owner_who_marks_it_done_from_the_dashboard()
    {
        await PayAheadOnAsync();
        var (orderId, guest) = await AwaitingPaymentAsync();
        var key = await HoldAsync(orderId, guest);

        await WithPaymobAsync(
            Capture(() => FakePaymob.Json(new JsonObject { ["detail"] = "Transaction is not capturable" }, HttpStatusCode.BadRequest)),
            () => ConfirmAsync(orderId, key));

        var (payment, _) = await StateAsync(orderId, key);
        Assert.AreEqual(PaymentMove.Capture, payment.Move);
        Assert.IsNotNull(payment.AttentionSince, "refused outright: the owner is told at once");
        Assert.IsNull(payment.MoveDueAt, "and it is not tried again by itself");

        var owner = PaymentScenarios.Owner;
        var list = await owner.GetAsync<List<AttentionRow>>($"/api/sales/payments/attention?{Version}");
        var row = list.Single(r => r.Key == key);
        Assert.AreEqual("Capture", row.Move);
        Assert.Contains("not capturable", row.Problem!);

        // Charged by hand in Paymob's dashboard: the owner says so, and the bill settles as if it had gone through
        var (done, body) = await owner.RefusedAsync(HttpMethod.Post, $"/api/sales/payments/{key}/done?{Version}", null);
        Assert.AreEqual(HttpStatusCode.NoContent, done, body);
        (payment, _) = await StateAsync(orderId, key);
        Assert.AreEqual(OnlinePaymentStatus.Paid, payment.Status);
        Assert.IsNull(payment.AttentionSince);
        Assert.AreEqual("Settled", (await BillAsync(payment.TicketId!.Value)).Status);
        Assert.IsFalse((await owner.GetAsync<List<AttentionRow>>($"/api/sales/payments/attention?{Version}")).Any(r => r.Key == key));
    }

    [TestMethod]
    public async Task A_hold_the_bank_let_go_before_it_was_charged_leaves_the_bill_to_the_till_and_tells_the_owner()
    {
        await PayAheadOnAsync();
        var (orderId, guest) = await AwaitingPaymentAsync();
        var key = await HoldAsync(orderId, guest);
        var transaction = await TransactionOfAsync(orderId, key);
        SalesUnderTest.Paymob.Transactions[transaction] = Record(transaction, voided: true);

        await WithPaymobAsync(
            Capture(() => FakePaymob.Json(new JsonObject { ["detail"] = "Transaction was voided" }, HttpStatusCode.BadRequest)),
            () => ConfirmAsync(orderId, key));

        var (payment, _) = await StateAsync(orderId, key);
        Assert.AreEqual(OnlinePaymentStatus.Voided, payment.Status, "nothing was taken, nor can be");
        Assert.IsNotNull(payment.AttentionSince);
        Assert.AreEqual(Ninja.Sales.API.Payments.RecordPaymentMoveCommandHandler.LapsedProblem, payment.Problem);
        Assert.AreEqual("Open", (await BillAsync(payment.TicketId!.Value)).Status, "the till collects it another way");
    }

    [TestMethod]
    public async Task A_late_callback_is_caught_up_with_when_the_customer_comes_back()
    {
        await PayAheadOnAsync();
        var (orderId, guest) = await AwaitingPaymentAsync();
        var started = await guest.PostAsync<Started>($"/api/sales/payments/orders/{orderId}?{Version}", new { });

        // The customer paid; Paymob's callback has not come
        SalesUnderTest.Paymob.Checkouts[started.Key.ToString("N")] = Record("770001");
        using (var scope = Suite.Sales.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<SalesContext>().OnlinePayments.Where(p => p.Key == started.Key)
                .ExecuteUpdateAsync(set => set.SetProperty(p => p.CreatedAt, DateTime.UtcNow.AddMinutes(-1)));

        var status = await guest.GetAsync<PayAheadStatus>($"/api/sales/payments/{started.Key}?{Version}");

        Assert.AreEqual("Authorized", status.Status, "back from the checkout, Paymob was asked");
        var (payment, due) = await StateAsync(orderId, started.Key);
        Assert.AreEqual("770001", payment.TransactionId);
        Assert.AreEqual(OrderPaymentDueStatus.Paid, due.Status, "the order goes to the till without waiting on the callback");
        var asked = SalesUnderTest.Paymob.Requests.Last(r => r.Path == "/api/ecommerce/orders/transaction_inquiry");
        Assert.AreEqual("Bearer tok_test", asked.Authorization, "with a token for the business's API key");
    }

    [TestMethod]
    public async Task The_daily_check_shows_the_owner_a_payment_paymob_has_otherwise()
    {
        await PayAheadOnAsync();
        var (orderId, guest) = await AwaitingPaymentAsync();
        var key = await HoldAsync(orderId, guest);
        await ConfirmAsync(orderId, key);
        var transaction = await TransactionOfAsync(orderId, key);
        // Refunded by hand in Paymob's dashboard, nobody telling us
        SalesUnderTest.Paymob.Transactions[transaction] = Record(transaction, captured: true, refunded: true);
        using (var scope = Suite.Sales.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<SalesContext>().PaymentSettings
                .ExecuteUpdateAsync(set => set.SetProperty(s => s.ReconciledAt, (DateTime?)null));

        await PaymentScenarios.TurnTheClockworkAsync();

        var (payment, _) = await StateAsync(orderId, key);
        Assert.IsNotNull(payment.AttentionSince);
        Assert.AreEqual("We have this payment as paid; Paymob says it was refunded.", payment.Problem);

        var (dismissed, body) = await PaymentScenarios.Owner.RefusedAsync(HttpMethod.Post, $"/api/sales/payments/{key}/dismiss?{Version}", null);
        Assert.AreEqual(HttpStatusCode.NoContent, dismissed, body);
        Assert.IsNull((await StateAsync(orderId, key)).Payment.AttentionSince);
    }

    [TestMethod]
    public async Task Two_at_once_never_make_the_same_move()
    {
        await PayAheadOnAsync();
        var (orderId, guest) = await AwaitingPaymentAsync();
        var key = await HoldAsync(orderId, guest);
        await WithPaymobAsync(Capture(() => new HttpResponseMessage(HttpStatusCode.BadGateway)), () => ConfirmAsync(orderId, key));
        var captures = Calls("/api/acceptance/capture");

        // Another instance has it
        using var scope = Suite.Sales.Services.CreateScope();
        var payments = scope.ServiceProvider.GetRequiredService<IOnlinePaymentRepository>();
        Assert.IsTrue(await payments.LeaseMoveAsync(key, DateTime.UtcNow, DateTime.UtcNow.AddMinutes(2)));
        Assert.IsFalse(await payments.LeaseMoveAsync(key, DateTime.UtcNow, DateTime.UtcNow.AddMinutes(2)), "one at a time");

        var result = await Suite.Sales.Services.GetRequiredService<PaymentMoves>().RunAsync(key, CancellationToken.None);

        Assert.AreEqual(MoveOutcome.Busy, result.Outcome);
        Assert.AreEqual(captures, Calls("/api/acceptance/capture"), "Paymob is not asked twice");
    }

    [TestMethod]
    public async Task Only_whoever_placed_it_pays_it_and_a_second_checkout_lets_the_first_go()
    {
        await PayAheadOnAsync();
        var (orderId, guest) = await AwaitingPaymentAsync();

        var (stranger, _) = await PaymentScenarios.Guest("someone-else").RefusedAsync(HttpMethod.Post, $"/api/sales/payments/orders/{orderId}?{Version}", new { });
        Assert.AreEqual(HttpStatusCode.NotFound, stranger, "an order's existence is not confirmed to a stranger");

        var first = await guest.PostAsync<Started>($"/api/sales/payments/orders/{orderId}?{Version}", new { });
        var second = await guest.PostAsync<Started>($"/api/sales/payments/orders/{orderId}?{Version}", new { });
        Assert.AreEqual(OnlinePaymentStatus.Failed, (await StateAsync(orderId, first.Key)).Payment.Status, "started again: the earlier checkout is let go");
        Assert.AreNotEqual(first.Key, second.Key);
    }

    [TestMethod]
    public async Task Turned_down_before_it_was_accepted_the_hold_is_let_go_and_nothing_is_refunded()
    {
        await PayAheadOnAsync();
        var (orderId, guest) = await AwaitingPaymentAsync();
        var key = await HoldAsync(orderId, guest);
        var (voids, refunds) = (Calls("/api/acceptance/void_refund/void"), Calls("/api/acceptance/void_refund/refund"));

        await CancelAsync(orderId);

        var (payment, due) = await StateAsync(orderId, key);
        Assert.AreEqual(OnlinePaymentStatus.Voided, payment.Status);
        Assert.AreEqual(OrderPaymentDueStatus.Cancelled, due.Status);
        Assert.AreEqual(voids + 1, Calls("/api/acceptance/void_refund/void"), "the hold is let go at the provider");
        Assert.AreEqual(refunds, Calls("/api/acceptance/void_refund/refund"), "nothing was charged, so nothing is refunded");
    }

    [TestMethod]
    public async Task A_delivery_paid_ahead_that_came_back_is_refunded_with_a_credit_note()
    {
        await PayAheadOnAsync();
        var (orderId, guest) = await AwaitingPaymentAsync();
        var key = await HoldAsync(orderId, guest);
        await ConfirmAsync(orderId, key);
        var refunds = Calls("/api/acceptance/void_refund/refund");

        await CancelAsync(orderId);

        var (payment, _) = await StateAsync(orderId, key);
        Assert.AreEqual(OnlinePaymentStatus.Refunded, payment.Status, "charged on acceptance, so given back");
        Assert.AreEqual(refunds + 1, Calls("/api/acceptance/void_refund/refund"));
        using var scope = Suite.Sales.Services.CreateScope();
        var credit = await scope.ServiceProvider.GetRequiredService<SalesContext>().Refunds.AsNoTracking().SingleAsync(r => r.TicketId == payment.TicketId);
        Assert.AreEqual(115m, credit.Amount, "the settled bill is answered by a credit note for all of it");
    }

    [TestMethod]
    public async Task A_payment_the_order_could_not_take_is_let_go()
    {
        await PayAheadOnAsync();
        var (orderId, guest) = await AwaitingPaymentAsync();
        var key = await HoldAsync(orderId, guest);

        await HandleAsync<OrderOnlinePaymentRefusedIntegrationEventHandler, OrderOnlinePaymentRefusedIntegrationEvent>(new(orderId, key, "payment.too_late"));

        Assert.AreEqual(OnlinePaymentStatus.Voided, (await StateAsync(orderId, key)).Payment.Status);
    }

    [TestMethod]
    public async Task A_delivery_paid_at_the_door_is_never_paid_online()
    {
        await PayAheadOnAsync();
        var orderId = Interlocked.Increment(ref _nextOrder);
        const string customer = "user-at-door";
        await HandleAsync<OrderStatusChangedToConfirmedIntegrationEventHandler, OrderStatusChangedToConfirmedIntegrationEvent>(
            Confirmed(orderId, null) with { BuyerIdentityGuid = customer });

        using var scope = Suite.Sales.Services.CreateScope();
        var ticketId = await scope.ServiceProvider.GetRequiredService<SalesContext>().Tickets.AsNoTracking()
            .Where(t => t.Lines.Any(l => l.OrderId == orderId)).Select(t => t.Id).SingleAsync();
        var mona = Suite.Sales.As(Persona.Customer(customer), Suite.Branch);

        var bill = await mona.GetAsync<PayBill>($"/api/sales/payments/tickets/{ticketId}?{Version}");
        Assert.IsFalse(bill.CanPay);
        Assert.AreEqual("at-door", bill.Why, "the rider collects it");
        var (refused, _) = await mona.RefusedAsync(HttpMethod.Post, $"/api/sales/payments/tickets/{ticketId}?{Version}", new { mode = 0 });
        Assert.AreEqual(HttpStatusCode.BadRequest, refused);
    }
}
