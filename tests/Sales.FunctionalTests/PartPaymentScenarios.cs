using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Ninja.Sales.API.Application.IntegrationEvents.EventHandling;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Testing;
using TicketAggregate = Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

namespace Ninja.Sales.FunctionalTests;

/// <summary>What the till reads off the wire about a part-paid bill; named here so a change in its shape fails a test.</summary>
public record PartPaymentResultView(List<int> PartPaymentIds, decimal Paid, decimal Remaining);
public record PartPaymentRowView(int Id, string Tender, decimal Amount, string? PayerName, List<int> LineIds, string RecordedBy, DateTime RecordedAt);
public record PartPaidLineView(int Id, decimal Total, bool Paid);
public record PartPaidPaymentView(int Id, string Tender, decimal Amount, int? PartPaymentId);
public record PartPaidTicketView(int Id, string Status, int? ShiftId, decimal Total, decimal ChangeGiven, decimal PartPaid,
    List<PartPaidLineView> Lines, List<PartPaymentRowView> PartPayments, List<PartPaidPaymentView> Payments);
public record PartPaidShiftView(int Id, string Status, decimal CashTendered, decimal ChangeGiven, decimal ExpectedInDrawer, decimal? ExpectedCash, decimal? OverShort,
    decimal PartPaymentsTotal, decimal CashPartPayments, decimal PartPaymentsReturned, decimal CashPartPaymentsReturned, List<MoneyTender> PartPaymentTenderTotals,
    List<MoneyTender> TenderTotals, decimal SalesTotal);

/// <summary>
/// A bill paid in parts: one of a group pays for what they had and leaves, the
/// bill stays open with less to pay, and the rest settles it. The money is in
/// the drawer of the shift that took it, once; and a bill with money on it is
/// not voided, emptied or discounted from under that money.
/// </summary>
[TestClass]
public sealed class PartPaymentScenarios
{
    private const string Version = "api-version=1.0";
    private const int Cash = 0;
    private const int Card = 1;

    // Each scenario runs its own counter, so one drawer's money is not another's
    private static int _nextBranch = 8000;
    private static int NewBranch() => Interlocked.Increment(ref _nextBranch);

    private static Caller TillAt(int branch) => Suite.Sales.As(Persona.Cashier(branch), branch);
    private static Caller OwnerAt(int branch) => Suite.Sales.As(Persona.Owner(branch), branch);

    private static string Url(string path) => $"{path}?{Version}";

    private static async Task<int> OpenShiftAsync(Caller till, decimal openingFloat)
        => (await till.PostAsync<OpenedShiftView>(Url("/api/shifts/open"), new { openingFloat })).ShiftId;

    private static Task<PartPaidShiftView> CloseShiftAsync(Caller till, int shiftId, decimal closingCount)
        => till.PostAsync<PartPaidShiftView>(Url($"/api/shifts/{shiftId}/close"), new { closingCount });

    private static Task<PartPaidShiftView> ShiftAsync(Caller till, int id) => till.GetAsync<PartPaidShiftView>(Url($"/api/shifts/{id}"));

    private static Task<PartPaidTicketView> TicketAsync(Caller till, int id) => till.GetAsync<PartPaidTicketView>(Url($"/api/tickets/{id}"));

    /// <summary>A counter bill with a line per price given, not yet settled.</summary>
    private static async Task<int> ABillAsync(Caller till, params decimal[] prices)
    {
        var opened = await till.PostAsync<OpenedTicketView>(Url("/api/tickets"), new { type = 2 });
        foreach (var unitPrice in prices)
        {
            var (added, detail) = await till.RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{opened.TicketId}/lines"), new
            {
                description = new { en = "Latte", ar = "Latte" },
                qty = 1m,
                unitPrice,
            });
            Assert.AreEqual(HttpStatusCode.OK, added, detail);
        }
        return opened.TicketId;
    }

    private static object Part(int tender, decimal amount, string? payerName = null, int[]? lineIds = null)
        => new { payments = new[] { new { tender, amount } }, payerName, lineIds };

    private static Task<PartPaymentResultView> TakeAsync(Caller till, int ticketId, int tender, decimal amount, string? payerName = null, int[]? lineIds = null)
        => till.PostAsync<PartPaymentResultView>(Url($"/api/tickets/{ticketId}/part-payments"), Part(tender, amount, payerName, lineIds));

    private static Task<(HttpStatusCode Status, string Detail)> TakeRefusedAsync(Caller till, int ticketId, int tender, decimal amount, int[]? lineIds = null)
        => till.RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{ticketId}/part-payments"), Part(tender, amount, null, lineIds));

    private static Task<SettleResultView> SettleAsync(Caller till, int ticketId, int tender, decimal amount)
        => till.PostAsync<SettleResultView>(Url($"/api/tickets/{ticketId}/settle"), new { payments = new[] { new { tender, amount } } });

    [TestMethod]
    public async Task A_part_payment_leaves_the_bill_open_with_less_to_pay_and_the_rest_settles_it()
    {
        var branch = NewBranch();
        var till = TillAt(branch);
        await OpenShiftAsync(till, 0m);
        var bill = await ABillAsync(till, 60m, 40m);
        var mine = (await TicketAsync(till, bill)).Lines.First(l => l.Total == 40m).Id;

        var taken = await TakeAsync(till, bill, Card, 40m, payerName: "Mona Ali", lineIds: [mine]);

        Assert.AreEqual(1, taken.PartPaymentIds.Count);
        Assert.AreEqual(40m, taken.Paid);
        Assert.AreEqual(60m, taken.Remaining);

        var open = await TicketAsync(till, bill);
        Assert.AreEqual("Open", open.Status, "the bill is still to be paid");
        Assert.AreEqual(100m, open.Total);
        Assert.AreEqual(40m, open.PartPaid);
        var part = open.PartPayments.Single();
        Assert.AreEqual("Card", part.Tender);
        Assert.AreEqual("Mona Ali", part.PayerName);
        CollectionAssert.AreEqual(new[] { mine }, part.LineIds);
        Assert.IsTrue(open.Lines.Single(l => l.Id == mine).Paid, "her latte is paid for");
        Assert.IsFalse(open.Lines.Single(l => l.Id != mine).Paid);
        Assert.AreEqual(0, open.Payments.Count, "nothing is on the receipt until the bill closes");

        // The till brings only the rest: 60 due, 70 handed over in cash, 10 back
        var (tooLittle, _) = await till.RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{bill}/settle"), new { payments = new[] { new { tender = Cash, amount = 50m } } });
        Assert.AreEqual(HttpStatusCode.BadRequest, tooLittle, "the rest is 60, not 50");
        var receipt = await SettleAsync(till, bill, Cash, 70m);
        Assert.AreEqual(10m, receipt.Change);

        var settled = await TicketAsync(till, bill);
        Assert.AreEqual("Settled", settled.Status);
        Assert.AreEqual(2, settled.Payments.Count, "both payments are on the receipt");
        Assert.AreEqual(40m, settled.Payments.Single(p => p.Tender == "Card").Amount);
        Assert.AreEqual(part.Id, settled.Payments.Single(p => p.Tender == "Card").PartPaymentId);
        Assert.IsNull(settled.Payments.Single(p => p.Tender == "Cash").PartPaymentId);
        Assert.AreEqual(0, settled.PartPayments.Count, "a closed bill has payments, not part payments");
    }

    private static int _nextSession = 880_000;

    /// <summary>A room whose clock has just started: the bill Spaces' event opens, with nothing on it yet.</summary>
    private static async Task<(int Session, int Ticket)> ARoomAsync(int branch)
    {
        var session = Interlocked.Increment(ref _nextSession);
        using var scope = Suite.Sales.Services.CreateScope();
        await ActivatorUtilities.CreateInstance<SessionStartedIntegrationEventHandler>(scope.ServiceProvider).Handle(
            new SessionStartedIntegrationEvent(session, PlaceId: session, PlaceKind: "Room", PlaceName: new("Room 3", "غرفة ٣"), ActualStartTime: DateTime.UtcNow, BranchId: branch));
        var ticket = await scope.ServiceProvider.GetRequiredService<TicketAggregate.ITicketRepository>().FindOpenBySessionAsync(session);
        return (session, ticket!.Id);
    }

    /// <summary>The clock stops: the room's time lands on its bill.</summary>
    private static async Task TheClockStopsAsync(int branch, int session, decimal cost)
    {
        using var scope = Suite.Sales.Services.CreateScope();
        var now = DateTime.UtcNow;
        await ActivatorUtilities.CreateInstance<SessionCompletedIntegrationEventHandler>(scope.ServiceProvider).Handle(
            new SessionCompletedIntegrationEvent(session, CustomerId: null, PlaceId: session, PlaceKind: "Room", PlaceName: new("Room 3", "غرفة ٣"),
                TotalCost: cost, StartTime: now.AddHours(-2), EndTime: now, Duration: TimeSpan.FromHours(2),
                Costs: [new("multi", new("Multi", "متعدد"), cost / 2, 2m, cost)], BranchId: branch));
    }

    [TestMethod]
    public async Task Someone_leaving_a_room_pays_for_what_they_had_and_something_towards_the_time_while_the_clock_runs()
    {
        var branch = NewBranch();
        var till = TillAt(branch);
        await OpenShiftAsync(till, 0m);
        var (session, bill) = await ARoomAsync(branch);

        // Nothing rung up yet, and the time is not on the bill until the clock stops: the money is taken all the same
        var early = await TakeAsync(till, bill, Cash, 50m, payerName: "Omar");
        Assert.AreEqual(50m, early.Paid);
        Assert.AreEqual(0m, early.Remaining, "nothing is left of a bill that holds nothing yet");

        // His latte is 70; he hands over 200, the rest towards the time: past everything the bill holds so far
        var (added, detail) = await till.RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{bill}/lines"), new { description = new { en = "Latte", ar = "Latte" }, qty = 1m, unitPrice = 70m });
        Assert.AreEqual(HttpStatusCode.OK, added, detail);
        var his = (await TicketAsync(till, bill)).Lines.Single().Id;
        var leaving = await TakeAsync(till, bill, Cash, 200m, payerName: "Ahmed", lineIds: [his]);
        Assert.AreEqual(250m, leaving.Paid);

        var open = await TicketAsync(till, bill);
        Assert.AreEqual("Open", open.Status, "his friends play on");
        Assert.AreEqual(250m, open.PartPaid);
        Assert.IsTrue(open.Lines.Single().Paid, "his latte is paid for");

        // The clock stops at 300 of time: 370 in all, 250 of it here already, 120 left for those who stayed
        await TheClockStopsAsync(branch, session, 300m);
        Assert.AreEqual(370m, (await TicketAsync(till, bill)).Total);
        var (tooLittle, _) = await till.RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{bill}/settle"), new { payments = new[] { new { tender = Cash, amount = 100m } } });
        Assert.AreEqual(HttpStatusCode.BadRequest, tooLittle, "the rest is 120, not 100");
        var receipt = await SettleAsync(till, bill, Cash, 120m);
        Assert.AreEqual(0m, receipt.Change);
        Assert.AreEqual("Settled", (await TicketAsync(till, bill)).Status);
    }

    [TestMethod]
    public async Task Once_the_clock_has_stopped_a_room_bill_is_paid_in_parts_like_any_other()
    {
        var branch = NewBranch();
        var till = TillAt(branch);
        var (session, bill) = await ARoomAsync(branch);
        await TheClockStopsAsync(branch, session, 100m);

        var (whole, why) = await TakeRefusedAsync(till, bill, Cash, 100m);
        Assert.AreEqual(HttpStatusCode.BadRequest, whole);
        StringAssert.Contains(why, "settle it instead");
        Assert.AreEqual(40m, (await TakeAsync(till, bill, Cash, 40m)).Paid);
    }

    public record MyBillLineView(int Id, bool IsMine, bool Paid);
    public record MyBillView(int Id, string Status, decimal Total, decimal PartPaid, List<MyBillLineView> Lines);

    [TestMethod]
    public async Task The_customer_sees_on_their_own_bill_what_the_till_took_and_which_items_it_paid_for()
    {
        var branch = NewBranch();
        var till = TillAt(branch);
        var bill = await ABillAsync(till, 60m, 40m);
        var lines = (await TicketAsync(till, bill)).Lines;
        var hers = lines.First(l => l.Total == 40m).Id;
        var (named, why) = await till.RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{bill}/lines/customer"),
            new { lineIds = lines.Select(l => l.Id).ToArray(), customerId = "user-mona-bill", customerName = "Mona Ali" });
        Assert.AreEqual(HttpStatusCode.NoContent, named, why);
        var mona = Suite.Sales.As(Persona.Customer("user-mona-bill"), branch);

        var before = (await mona.GetAsync<List<MyBillView>>(Url("/api/tickets/mine"))).Single(b => b.Id == bill);
        Assert.AreEqual(0m, before.PartPaid);
        Assert.IsFalse(before.Lines.Any(l => l.Paid));

        // She pays for one of her items at the till, and leaves ten more towards the rest
        await TakeAsync(till, bill, Cash, 50m, payerName: "Mona Ali", lineIds: [hers]);

        var after = (await mona.GetAsync<List<MyBillView>>(Url("/api/tickets/mine"))).Single(b => b.Id == bill);
        Assert.AreEqual("Open", after.Status);
        Assert.AreEqual(100m, after.Total, "the bill is what it was");
        Assert.AreEqual(50m, after.PartPaid, "and fifty of it is paid");
        Assert.IsTrue(after.Lines.Single(l => l.Id == hers).Paid, "the item she paid for says so");
        Assert.IsFalse(after.Lines.Single(l => l.Id != hers).Paid);

        // Closed, the parts are among the bill's payments: nothing is left to say apart
        await SettleAsync(till, bill, Cash, 50m);
        var closed = (await mona.GetAsync<List<MyBillView>>(Url("/api/tickets/mine"))).Single(b => b.Id == bill);
        Assert.AreEqual("Settled", closed.Status);
        Assert.AreEqual(0m, closed.PartPaid);
        Assert.IsFalse(closed.Lines.Any(l => l.Paid));
    }

    [TestMethod]
    public async Task A_part_payment_that_would_pay_the_bill_in_full_is_refused()
    {
        var branch = NewBranch();
        var till = TillAt(branch);
        var bill = await ABillAsync(till, 100m);

        var (exact, why) = await TakeRefusedAsync(till, bill, Cash, 100m);
        Assert.AreEqual(HttpStatusCode.BadRequest, exact);
        StringAssert.Contains(why, "settle it instead");

        var (over, _) = await TakeRefusedAsync(till, bill, Cash, 150m);
        Assert.AreEqual(HttpStatusCode.BadRequest, over);

        // And against what is left, not the total: 70 taken, 30 left
        await TakeAsync(till, bill, Cash, 70m);
        var (rest, whyRest) = await TakeRefusedAsync(till, bill, Card, 30m);
        Assert.AreEqual(HttpStatusCode.BadRequest, rest);
        StringAssert.Contains(whyRest, "settle it instead");

        var (nothing, _) = await TakeRefusedAsync(till, bill, Cash, 0m);
        Assert.AreEqual(HttpStatusCode.BadRequest, nothing, "a part payment is some money");

        // Not a tab, not a platform: money the till itself takes
        var (onTab, _) = await TakeRefusedAsync(till, bill, tender: 3, amount: 10m);
        Assert.AreEqual(HttpStatusCode.BadRequest, onTab);

        Assert.AreEqual(70m, (await TicketAsync(till, bill)).PartPaid, "the refusals took nothing");
    }

    [TestMethod]
    public async Task The_same_items_are_not_paid_for_twice()
    {
        var branch = NewBranch();
        var till = TillAt(branch);
        var bill = await ABillAsync(till, 60m, 40m, 30m);
        var lines = (await TicketAsync(till, bill)).Lines;
        var first = lines.First(l => l.Total == 40m).Id;
        var second = lines.First(l => l.Total == 30m).Id;

        await TakeAsync(till, bill, Cash, 40m, lineIds: [first]);

        var (again, why) = await TakeRefusedAsync(till, bill, Cash, 40m, lineIds: [first]);
        Assert.AreEqual(HttpStatusCode.BadRequest, again);
        StringAssert.Contains(why, "already paid");

        var (both, _) = await TakeRefusedAsync(till, bill, Cash, 50m, lineIds: [first, second]);
        Assert.AreEqual(HttpStatusCode.BadRequest, both, "one of the two is paid");

        var (stranger, _) = await TakeRefusedAsync(till, bill, Cash, 10m, lineIds: [int.MaxValue]);
        Assert.AreEqual(HttpStatusCode.BadRequest, stranger, "not an item on this bill");

        // The other one is still to pay
        await TakeAsync(till, bill, Cash, 30m, lineIds: [second]);
        Assert.AreEqual(70m, (await TicketAsync(till, bill)).PartPaid);
    }

    [TestMethod]
    public async Task Cash_taken_in_one_shift_is_that_drawers_and_not_the_drawer_that_settles_the_bill()
    {
        var branch = NewBranch();
        var till = TillAt(branch);
        var bill = await ABillAsync(till, 100m);

        // The morning shift takes 40 in cash on a bill of 100
        var morning = await OpenShiftAsync(till, 200m);
        await TakeAsync(till, bill, Cash, 40m);

        var x = await ShiftAsync(till, morning);
        Assert.AreEqual(240m, x.ExpectedInDrawer, "the float and the 40");
        Assert.AreEqual(40m, x.PartPaymentsTotal);
        Assert.AreEqual(40m, x.CashPartPayments);
        Assert.AreEqual(40m, x.PartPaymentTenderTotals.Single(t => t.Tender == "Cash").Amount);
        Assert.AreEqual(0m, x.SalesTotal, "not a sale until the bill closes");

        var closedMorning = await CloseShiftAsync(till, morning, 240m);
        Assert.AreEqual(240m, closedMorning.ExpectedCash, "frozen with the part payment in it");
        Assert.AreEqual(0m, closedMorning.OverShort);

        // The evening shift settles the rest: 60 due, 100 handed over, 40 back
        var evening = await OpenShiftAsync(till, 50m);
        var receipt = await SettleAsync(till, bill, Cash, 100m);
        Assert.AreEqual(40m, receipt.Change);

        var y = await ShiftAsync(till, evening);
        Assert.AreEqual(100m, y.SalesTotal, "the sale is the evening's: the bill closed in it");
        Assert.AreEqual(100m, y.CashTendered, "only the cash handed over tonight");
        Assert.AreEqual(40m, y.ChangeGiven);
        Assert.AreEqual(110m, y.ExpectedInDrawer, "50 float + 100 in - 40 back; the morning's 40 is not counted again");
        Assert.AreEqual(0m, y.PartPaymentsTotal);
        Assert.AreEqual(100m, y.TenderTotals.Single(t => t.Tender == "Cash").Amount, "the tenders add up to the sale");

        // What was taken earlier is not the till's to re-label now
        var settled = await TicketAsync(till, bill);
        var early = settled.Payments.Single(p => p.PartPaymentId is not null);
        var (changed, why) = await till.RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{bill}/payments/{early.Id}/tender"), new { tender = "Card" });
        Assert.AreEqual(HttpStatusCode.BadRequest, changed);
        StringAssert.Contains(why, "part payment");

        var closedEvening = await CloseShiftAsync(till, evening, 110m);
        Assert.AreEqual(110m, closedEvening.ExpectedCash);
        Assert.AreEqual(0m, closedEvening.OverShort);

        // The morning's Z is as it was counted
        var z = await ShiftAsync(till, morning);
        Assert.AreEqual(240m, z.ExpectedInDrawer);
        Assert.AreEqual(240m, z.ExpectedCash);
    }

    [TestMethod]
    public async Task Change_is_never_handed_out_of_money_taken_earlier()
    {
        var branch = NewBranch();
        var till = TillAt(branch);
        await OpenShiftAsync(till, 0m);
        var bill = await ABillAsync(till, 100m);
        await TakeAsync(till, bill, Cash, 40m);

        // 60 is left: a card for 80 would make 20 of "change" out of the earlier cash
        var (over, _) = await till.RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{bill}/settle"), new { payments = new[] { new { tender = Card, amount = 80m } } });
        Assert.AreEqual(HttpStatusCode.BadRequest, over);

        Assert.AreEqual(0m, (await SettleAsync(till, bill, Card, 60m)).Change);
    }

    [TestMethod]
    public async Task A_part_paid_bill_is_not_voided_or_discarded_until_the_money_is_given_back()
    {
        var branch = NewBranch();
        var till = TillAt(branch);
        var owner = OwnerAt(branch);
        var shift = await OpenShiftAsync(till, 100m);
        var bill = await ABillAsync(till, 100m);
        var taken = await TakeAsync(till, bill, Cash, 40m);
        var partId = taken.PartPaymentIds.Single();

        var (voided, why) = await owner.RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{bill}/void"), new { reason = "Walked out" });
        Assert.AreEqual(HttpStatusCode.BadRequest, voided);
        StringAssert.Contains(why, "Give the part payments back first");

        var (discarded, _) = await till.RefusedAsync(HttpMethod.Delete, Url($"/api/tickets/{bill}"));
        Assert.AreNotEqual(HttpStatusCode.OK, discarded);
        Assert.AreNotEqual(HttpStatusCode.NoContent, discarded);

        var (discounted, _) = await owner.RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{bill}/discount"), new { amount = 70m, reason = "Complaint" });
        Assert.AreEqual(HttpStatusCode.BadRequest, discounted, "a discount to 30 is below the 40 already paid");

        // Giving money back is the owner's, as a void is
        var (byCashier, _) = await till.RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{bill}/part-payments/{partId}/return"));
        Assert.AreEqual(HttpStatusCode.Forbidden, byCashier);

        Assert.AreEqual(140m, (await ShiftAsync(till, shift)).ExpectedInDrawer);

        var back = await owner.PostAsync<PartPaymentResultView>(Url($"/api/tickets/{bill}/part-payments/{partId}/return"));
        Assert.AreEqual(0m, back.Paid);
        Assert.AreEqual(100m, back.Remaining);

        var (twice, _) = await owner.RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{bill}/part-payments/{partId}/return"));
        Assert.AreEqual(HttpStatusCode.BadRequest, twice, "given back once");

        var x = await ShiftAsync(till, shift);
        Assert.AreEqual(100m, x.ExpectedInDrawer, "the 40 left the drawer again");
        Assert.AreEqual(40m, x.CashPartPayments);
        Assert.AreEqual(40m, x.CashPartPaymentsReturned);
        Assert.AreEqual(40m, x.PartPaymentsReturned);

        var open = await TicketAsync(till, bill);
        Assert.AreEqual(0m, open.PartPaid);
        Assert.AreEqual(0, open.PartPayments.Count);

        var (now, detail) = await owner.RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{bill}/void"), new { reason = "Walked out" });
        Assert.AreEqual(HttpStatusCode.OK, now, detail);

        var closed = await CloseShiftAsync(till, shift, 100m);
        Assert.AreEqual(100m, closed.ExpectedCash);
        Assert.AreEqual(0m, closed.OverShort);
    }

    [TestMethod]
    public async Task Money_given_back_in_a_later_shift_leaves_that_shifts_drawer()
    {
        var branch = NewBranch();
        var till = TillAt(branch);
        var owner = OwnerAt(branch);
        var bill = await ABillAsync(till, 100m);

        var morning = await OpenShiftAsync(till, 0m);
        var partId = (await TakeAsync(till, bill, Cash, 40m)).PartPaymentIds.Single();
        Assert.AreEqual(40m, (await CloseShiftAsync(till, morning, 40m)).ExpectedCash);

        var evening = await OpenShiftAsync(till, 100m);
        await owner.PostAsync<PartPaymentResultView>(Url($"/api/tickets/{bill}/part-payments/{partId}/return"));

        Assert.AreEqual(60m, (await ShiftAsync(till, evening)).ExpectedInDrawer, "the evening's drawer handed the 40 back");
        Assert.AreEqual(40m, (await ShiftAsync(till, morning)).ExpectedInDrawer, "the morning took it and still shows it");
    }

    [TestMethod]
    public async Task An_item_that_was_paid_for_stays_on_its_bill()
    {
        var branch = NewBranch();
        var till = TillAt(branch);
        var bill = await ABillAsync(till, 60m, 40m);
        var other = await ABillAsync(till, 10m);
        var lines = (await TicketAsync(till, bill)).Lines;
        var paid = lines.First(l => l.Total == 40m).Id;
        var unpaid = lines.First(l => l.Total == 60m).Id;
        await TakeAsync(till, bill, Cash, 40m, lineIds: [paid]);

        var (moved, why) = await till.RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{bill}/move-lines"), new { lineIds = new[] { paid }, targetTicketId = other });
        Assert.AreEqual(HttpStatusCode.BadRequest, moved);
        StringAssert.Contains(why, "already paid");

        var (split, _) = await till.RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{bill}/move-lines"), new { lineIds = new[] { paid } });
        Assert.AreEqual(HttpStatusCode.BadRequest, split, "nor onto a bill of its own");

        // The unpaid one may go: what stays (40) still covers the 40 taken
        var (free, detail) = await till.RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{bill}/move-lines"), new { lineIds = new[] { unpaid }, targetTicketId = other });
        Assert.AreEqual(HttpStatusCode.OK, free, detail);
        Assert.AreEqual(40m, (await TicketAsync(till, bill)).Total);
        Assert.AreEqual(70m, (await TicketAsync(till, other)).Total);
    }

    [TestMethod]
    public async Task A_bill_is_not_emptied_below_what_was_paid_on_it()
    {
        var branch = NewBranch();
        var till = TillAt(branch);
        var bill = await ABillAsync(till, 60m, 40m);
        var other = await ABillAsync(till, 10m);
        var big = (await TicketAsync(till, bill)).Lines.First(l => l.Total == 60m).Id;

        // 50 on account of the bill, no items named
        await TakeAsync(till, bill, Cash, 50m);

        var (moved, _) = await till.RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{bill}/move-lines"), new { lineIds = new[] { big }, targetTicketId = other });
        Assert.AreEqual(HttpStatusCode.BadRequest, moved, "40 would be left on a bill 50 was paid on");
        Assert.AreEqual(100m, (await TicketAsync(till, bill)).Total, "nothing moved");
    }

    [TestMethod]
    public async Task The_same_request_twice_takes_the_money_once()
    {
        var branch = NewBranch();
        var till = TillAt(branch);
        var shift = await OpenShiftAsync(till, 0m);
        var bill = await ABillAsync(till, 100m);
        var requestId = Guid.NewGuid().ToString();

        async Task<PartPaymentResultView> SendAsync()
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, Url($"/api/tickets/{bill}/part-payments"))
            {
                Content = JsonContent.Create(Part(Cash, 30m), options: Caller.Json),
            };
            request.Headers.Add("x-requestid", requestId);
            using var response = await till.Http.SendAsync(request);
            Assert.AreEqual(HttpStatusCode.OK, response.StatusCode, await response.Content.ReadAsStringAsync());
            return (await response.Content.ReadFromJsonAsync<PartPaymentResultView>(Caller.Json))!;
        }

        var first = await SendAsync();
        var second = await SendAsync();

        Assert.AreEqual(1, first.PartPaymentIds.Count);
        Assert.AreEqual(30m, second.Paid, "the retry is told what stands");
        Assert.AreEqual(70m, second.Remaining);

        var open = await TicketAsync(till, bill);
        Assert.AreEqual(1, open.PartPayments.Count);
        Assert.AreEqual(30m, open.PartPaid);
        Assert.AreEqual(30m, (await ShiftAsync(till, shift)).ExpectedInDrawer);
    }

    [TestMethod]
    public async Task Part_payments_are_the_tills_and_nobody_elses()
    {
        var branch = NewBranch();
        var bill = await ABillAsync(TillAt(branch), 100m);

        var (status, _) = await Suite.Sales.As(Persona.Customer(), branch)
            .RefusedAsync(HttpMethod.Post, Url($"/api/tickets/{bill}/part-payments"), Part(Cash, 10m));

        Assert.AreEqual(HttpStatusCode.Forbidden, status);
    }
}
