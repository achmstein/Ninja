using System.Net;
using Ninja.Testing;

namespace Ninja.Sales.FunctionalTests;

/// <summary>The service, once for the suite.</summary>
[TestClass]
public static class Suite
{
    public const int Branch = 1;

    public static ServiceUnderTest<Program> Sales { get; private set; } = null!;

    [AssemblyInitialize]
    public static async Task StartAsync(TestContext context)
    {
        await SharedServices.StartAsync();
        Sales = new SalesUnderTest();
        _ = Sales.CreateClient();
    }

    [AssemblyCleanup]
    public static async Task StopAsync()
    {
        await Sales.DisposeAsync();
        await SharedServices.StopAsync();
    }
}

/// <summary>What the apps read off the wire; named here so a change in the API's shape fails a test.</summary>
public record TicketView(int Id, string Type, string Status, int BranchId, int? PlaceId, string? Label, decimal Total, decimal Subtotal, List<LineView> Lines, List<PaymentView> Payments, DateTime? SettledAt, string? VoidReason);
public record LineView(int Id, LocalizedView Description, decimal Qty, decimal UnitPrice, decimal Discount, decimal Total);
public record PaymentView(string Tender, decimal Amount, string? CustomerName);
public record TicketSummaryView(int Id, string Status, decimal Total, int LineCount);
public record OpenedTicketView(int TicketId);
public record SettleResultView(int ReceiptNumber, decimal Change);
public record RefundResultView(int Number, decimal Amount);
public record LocalizedView(string En, string? Ar);

/// <summary>
/// A bill at the till: opened for a table, added to, discounted, settled
/// and partly refunded — and what the till may not do with somebody's money.
/// </summary>
[TestClass]
public sealed class TillScenarios
{
    private const string Tickets = "/api/tickets";
    private const string Version = "api-version=1.0";

    private static Caller Till => Suite.Sales.As(Persona.Cashier(Suite.Branch), Suite.Branch);
    private static Caller Owner => Suite.Sales.As(Persona.Owner(Suite.Branch), Suite.Branch);

    private static string Url(string tail = "") => $"{Tickets}{tail}?{Version}";

    // A table has one open bill at a time, so each scenario sits at its own
    private static int _nextTable = 400;
    private static int NewTable() => Interlocked.Increment(ref _nextTable);

    /// <summary>A bill open at a table, with one line on it. Adding a line answers with nothing, so the bill is read back.</summary>
    private static async Task<int> ABillAsync(decimal unitPrice = 50m, decimal qty = 2m, string what = "Turkish coffee", int? table = null)
    {
        var placeId = table ?? NewTable();
        var opened = await Till.PostAsync<OpenedTicketView>(Url(), new { type = 1, label = $"Table {placeId}", placeId });
        var (added, detail) = await Till.RefusedAsync(HttpMethod.Post, Url($"/{opened.TicketId}/lines"), new
        {
            description = new { en = what, ar = what },
            qty,
            unitPrice,
        });
        Assert.AreEqual(HttpStatusCode.OK, added, detail);
        return opened.TicketId;
    }

    private static Task<TicketView> BillAsync(int id) => Till.GetAsync<TicketView>(Url($"/{id}"));

    [TestMethod]
    public async Task A_bill_is_opened_added_to_and_read_back()
    {
        var table = NewTable();
        var id = await ABillAsync(table: table);

        var bill = await BillAsync(id);
        Assert.AreEqual("Table", bill.Type);
        Assert.AreEqual("Open", bill.Status);
        Assert.AreEqual(Suite.Branch, bill.BranchId);
        Assert.AreEqual(table, bill.PlaceId);
        var line = bill.Lines.Single();
        Assert.AreEqual("Turkish coffee", line.Description.En);
        Assert.AreEqual(2m, line.Qty);
        Assert.AreEqual(100m, line.Total, "two coffees at fifty");

        var open = await Till.GetAsync<List<TicketSummaryView>>(Url("/open"));
        Assert.IsTrue(open.Any(t => t.Id == id), "an open bill is on the floor");
    }

    [TestMethod]
    public async Task A_table_has_one_bill_at_a_time()
    {
        var table = NewTable();
        var first = await ABillAsync(table: table);

        var again = await Till.PostAsync<OpenedTicketView>(Url(), new { type = 1, label = $"Table {table}", placeId = table });

        Assert.AreEqual(first, again.TicketId, "a second round at the same table goes on the same bill");
        Assert.AreEqual(1, (await BillAsync(first)).Lines.Count, "and opening it again adds nothing to it");
    }

    [TestMethod]
    public async Task A_bill_is_settled_and_leaves_the_floor()
    {
        var id = await ABillAsync();
        var before = await BillAsync(id);

        var receipt = await Till.PostAsync<SettleResultView>(Url($"/{id}/settle"), new
        {
            payments = new[] { new { tender = 0, amount = before.Total } },
        });
        Assert.IsTrue(receipt.ReceiptNumber > 0, "a settled bill is given its receipt number");
        Assert.AreEqual(0m, receipt.Change, "paid to the penny, nothing back");

        var after = await BillAsync(id);
        Assert.AreEqual("Settled", after.Status);
        Assert.IsNotNull(after.SettledAt);
        Assert.AreEqual("Cash", after.Payments.Single().Tender);

        var open = await Till.GetAsync<List<TicketSummaryView>>(Url("/open"));
        Assert.IsFalse(open.Any(t => t.Id == id), "a paid bill is off the floor");
        var done = await Till.GetAsync<List<TicketSummaryView>>(Url("/settled"));
        Assert.IsTrue(done.Any(t => t.Id == id), "and on the day's takings");
    }

    [TestMethod]
    public async Task Cash_over_the_total_comes_back_as_change()
    {
        var id = await ABillAsync(unitPrice: 45m, qty: 1m);
        var total = (await BillAsync(id)).Total;

        var receipt = await Till.PostAsync<SettleResultView>(Url($"/{id}/settle"), new
        {
            payments = new[] { new { tender = 0, amount = total + 55m } },
        });

        Assert.AreEqual(55m, receipt.Change, "what was handed over, less what the bill came to");
    }

    [TestMethod]
    public async Task A_bill_is_paid_in_two_ways_at_once()
    {
        var id = await ABillAsync(unitPrice: 30m, qty: 3m);
        var total = (await BillAsync(id)).Total;

        await Till.PostAsync<SettleResultView>(Url($"/{id}/settle"), new
        {
            payments = new[]
            {
                new { tender = 0, amount = 50m },
                new { tender = 1, amount = total - 50m },
            },
        });

        var bill = await BillAsync(id);
        Assert.AreEqual("Settled", bill.Status);
        Assert.AreEqual(2, bill.Payments.Count, "one bill, two tenders");
        Assert.AreEqual(total, bill.Payments.Sum(p => p.Amount));
    }

    [TestMethod]
    public async Task A_bill_is_not_settled_for_less_than_it_comes_to()
    {
        var id = await ABillAsync(unitPrice: 100m, qty: 1m);
        var total = (await BillAsync(id)).Total;

        var (status, detail) = await Till.RefusedAsync(HttpMethod.Post, Url($"/{id}/settle"), new
        {
            payments = new[] { new { tender = 0, amount = total - 10m } },
        });

        Assert.AreEqual(HttpStatusCode.BadRequest, status, "the drawer does not cover the difference");
        Assert.IsTrue(detail.Length > 0, "and the till is told why");
        Assert.AreEqual("Open", (await BillAsync(id)).Status, "the bill is still open");
    }

    [TestMethod]
    public async Task A_part_of_a_settled_bill_is_refunded()
    {
        var id = await ABillAsync(unitPrice: 50m, qty: 2m);
        var bill = await BillAsync(id);
        await Till.PostAsync<SettleResultView>(Url($"/{id}/settle"), new { payments = new[] { new { tender = 0, amount = bill.Total } } });

        var refundRequest = new
        {
            lines = new[] { new { lineId = bill.Lines.Single().Id, qty = 1m } },
            reason = "One came back cold",
            tender = 0,
        };
        var (byTill, _) = await Till.RefusedAsync(HttpMethod.Post, Url($"/{id}/refunds"), refundRequest);
        Assert.AreEqual(HttpStatusCode.Forbidden, byTill, "money goes back out of the drawer on the owner's word");

        var refund = await Owner.PostAsync<RefundResultView>(Url($"/{id}/refunds"), refundRequest);

        Assert.IsTrue(refund.Amount > 0, "money goes back");
        Assert.IsTrue(refund.Number > 0, "and the refund has its own number");
        Assert.AreEqual("Settled", (await BillAsync(id)).Status, "a refund does not reopen the bill");
    }

    [TestMethod]
    public async Task A_bill_is_voided_with_a_reason_and_only_while_it_is_open()
    {
        var id = await ABillAsync();

        var (byTill, _) = await Till.RefusedAsync(HttpMethod.Post, Url($"/{id}/void"), new { reason = "Opened by mistake" });
        Assert.AreEqual(HttpStatusCode.Forbidden, byTill, "a cashier does not make a bill disappear");

        var (voided, detail) = await Owner.RefusedAsync(HttpMethod.Post, Url($"/{id}/void"), new { reason = "Opened by mistake" });
        Assert.AreEqual(HttpStatusCode.OK, voided, detail);

        var bill = await BillAsync(id);
        Assert.AreEqual("Voided", bill.Status);
        Assert.AreEqual("Opened by mistake", bill.VoidReason);

        var (again, _) = await Owner.RefusedAsync(HttpMethod.Post, Url($"/{id}/void"), new { reason = "Twice" });
        Assert.AreNotEqual(HttpStatusCode.OK, again, "a voided bill is not voided again");

        var (settle, _) = await Till.RefusedAsync(HttpMethod.Post, Url($"/{id}/settle"), new { payments = new[] { new { tender = 0, amount = 1m } } });
        Assert.AreNotEqual(HttpStatusCode.OK, settle, "and nobody pays a bill that never was");
    }

    [TestMethod]
    public async Task A_bill_takes_a_discount_and_the_till_may_not_give_away_the_house()
    {
        var id = await ABillAsync(unitPrice: 100m, qty: 1m);
        var full = (await BillAsync(id)).Total;

        var (given, detail) = await Till.RefusedAsync(HttpMethod.Post, Url($"/{id}/discount"), new { reason = "Regular", rate = 0.1m });
        Assert.AreEqual(HttpStatusCode.OK, given, detail);
        Assert.IsTrue((await BillAsync(id)).Total < full, "the bill comes down");

        var (removed, _) = await Till.RefusedAsync(HttpMethod.Delete, Url($"/{id}/discount"));
        Assert.AreEqual(HttpStatusCode.NoContent, removed);
        Assert.AreEqual(full, (await BillAsync(id)).Total, "and goes back up when it is taken off");

        var (tooMuch, _) = await Till.RefusedAsync(HttpMethod.Post, Url($"/{id}/discount"), new { reason = "Friend", rate = 0.9m });
        Assert.AreEqual(HttpStatusCode.BadRequest, tooMuch, "a till does not write off nine tenths of a bill");
    }

    [TestMethod]
    public async Task A_bill_nobody_opened_is_not_there()
    {
        var (read, _) = await Till.RefusedAsync(HttpMethod.Get, Url("/999999"));
        Assert.AreEqual(HttpStatusCode.NotFound, read);

        var (line, _) = await Till.RefusedAsync(HttpMethod.Post, Url("/999999/lines"), new { description = new { en = "Ghost" }, qty = 1m, unitPrice = 1m });
        Assert.AreEqual(HttpStatusCode.BadRequest, line, "there is no bill to add it to");
    }

    [TestMethod]
    public async Task The_till_is_staff_and_the_pricing_is_the_owners()
    {
        var customer = Suite.Sales.As(Persona.Customer(), Suite.Branch);

        foreach (var (method, path, body) in new (HttpMethod, string, object?)[]
        {
            (HttpMethod.Get, Url("/open"), null),
            (HttpMethod.Post, Url(), new { type = 2 }),
        })
        {
            var (status, _) = await customer.RefusedAsync(method, path, body);
            Assert.AreEqual(HttpStatusCode.Forbidden, status, $"{method} {path} is the till's");
        }

        var pricing = new { vatRate = 0.14m, pricesIncludeVat = true, serviceChargeRate = 0.12m };
        var (byTill, _) = await Till.RefusedAsync(HttpMethod.Put, $"{Tickets}/pricing/{Suite.Branch}?{Version}", pricing);
        Assert.AreEqual(HttpStatusCode.Forbidden, byTill, "what a café charges is the owner's to set");

        var (byOwner, detail) = await Owner.RefusedAsync(HttpMethod.Put, $"{Tickets}/pricing/{Suite.Branch}?{Version}", pricing);
        Assert.AreEqual(HttpStatusCode.OK, byOwner, detail);

        using var nobody = Suite.Sales.AsAnonymous().Http;
        Assert.AreEqual(HttpStatusCode.Unauthorized, (await nobody.GetAsync(Url("/open"))).StatusCode);
    }
}
