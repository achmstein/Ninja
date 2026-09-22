using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Ninja.Accounts.API.IntegrationEvents.Events;
using Ninja.EventBus.Abstractions;
using Ninja.EventBus.Events;
using Ninja.Testing;

namespace Ninja.Accounts.FunctionalTests;

/// <summary>The service, once for the suite.</summary>
[TestClass]
public static class Suite
{
    public static ServiceUnderTest<Program> Accounts { get; private set; } = null!;

    [AssemblyInitialize]
    public static async Task StartAsync(TestContext context)
    {
        await SharedServices.StartAsync();
        Accounts = new ServiceUnderTest<Program>("accountsdb");
        _ = Accounts.CreateClient();
    }

    [AssemblyCleanup]
    public static async Task StopAsync()
    {
        await Accounts.DisposeAsync();
        await SharedServices.StopAsync();
    }

    public const int Branch = 1;

    public static Caller BackOffice => Accounts.As(Persona.Admin(Branch), Branch);

    public static Caller Till => Accounts.As(Persona.Cashier(Branch), Branch);

    public static Caller Customer(string userId) => Accounts.As(Persona.Customer(userId));

    public static string Url(string tail) => $"/api/accounts{tail}";
}

/// <summary>What the apps read off the wire; named here so a change in the API's shape fails a test.</summary>
public record TabView(int Id, string CustomerId, string? CustomerName, decimal Balance, List<TabLineView> Transactions);
public record TabLineView(int Id, string Type, decimal Amount, string? Description, string Source, int? SourceNumber, int? TicketId, string RecordedBy);
public record TabSummaryView(int Id, string CustomerId, string? CustomerName, decimal Balance);

/// <summary>
/// The house account: what a regular owes the café. A manager keys a
/// charge or a payment in; everything else arrives from the till as an
/// event — a bill settled on account, a credit note, a tab paid down.
/// </summary>
[TestClass]
public sealed class TabScenarios
{
    private static string ACustomer() => $"customer-{Guid.NewGuid():N}";

    private static Task TellAsync(IntegrationEvent what)
        => Suite.Accounts.Services.GetRequiredService<IEventBus>().PublishAsync(what);

    private static Task<TabView> TabAsync(string customerId) => Suite.BackOffice.GetAsync<TabView>(Suite.Url($"/{customerId}"));

    private static async Task ChargeAsync(string customerId, decimal amount, string? name = null, string? description = null)
    {
        var (charged, detail) = await Suite.BackOffice.RefusedAsync(HttpMethod.Post, Suite.Url($"/{customerId}/charge"), new
        {
            amount, description, customerName = name,
        });
        Assert.AreEqual(HttpStatusCode.OK, charged, detail);
    }

    [TestMethod]
    public async Task A_tab_opens_with_the_first_charge_and_the_customer_can_read_it()
    {
        var laila = ACustomer();

        await ChargeAsync(laila, 340m, "Laila", "Two coffees and a sandwich");

        var tab = await TabAsync(laila);
        Assert.AreEqual(340m, tab.Balance, "what is owed is a positive balance");
        Assert.AreEqual("Laila", tab.CustomerName);
        var line = tab.Transactions.Single();
        Assert.AreEqual("charge", line.Type);
        Assert.AreEqual(340m, line.Amount);
        Assert.AreEqual("Two coffees and a sandwich", line.Description);
        Assert.AreEqual("manual", line.Source, "keyed in by a manager, not by the till");
        Assert.IsNull(line.SourceNumber);
        Assert.AreEqual("Admin", line.RecordedBy);

        // The customer reads their own tab in the app
        var mine = await Suite.Customer(laila).GetAsync<TabView>(Suite.Url("/my"));
        Assert.AreEqual(340m, mine.Balance);
        Assert.AreEqual(1, (await Suite.Customer(laila).GetAsync<List<TabLineView>>(Suite.Url("/my/transactions"))).Count);

        // The till reads the balance and nothing else
        var atTheCounter = await Suite.Till.GetAsync<TabSummaryView>(Suite.Url($"/{laila}/balance"));
        Assert.AreEqual(340m, atTheCounter.Balance);
        Assert.AreEqual("Laila", atTheCounter.CustomerName);

        // Somebody who never put anything on account has no tab
        var stranger = ACustomer();
        var (noTab, _) = await Suite.Till.RefusedAsync(HttpMethod.Get, Suite.Url($"/{stranger}/balance"));
        Assert.AreEqual(HttpStatusCode.NotFound, noTab);
        var (notOnTheList, _) = await Suite.BackOffice.RefusedAsync(HttpMethod.Get, Suite.Url($"/{stranger}"));
        Assert.AreEqual(HttpStatusCode.NotFound, notOnTheList);

        using var theirs = await Suite.Customer(stranger).RawAsync(HttpMethod.Get, Suite.Url("/my"));
        Assert.AreEqual(HttpStatusCode.OK, theirs.StatusCode, "and the app is told there is nothing, not that something went wrong");
        Assert.IsEmpty(await theirs.Content.ReadAsStringAsync(), "no tab is an empty answer, which is what the app reads as none");
    }

    [TestMethod]
    public async Task A_payment_lowers_what_is_owed_and_a_tab_can_run_into_credit()
    {
        var customer = ACustomer();
        await ChargeAsync(customer, 200m, "Hassan");

        var (paid, detail) = await Suite.BackOffice.RefusedAsync(HttpMethod.Post, Suite.Url($"/{customer}/payment"), new
        {
            amount = 50m, description = "Cash at the counter",
        });
        Assert.AreEqual(HttpStatusCode.OK, paid, detail);
        Assert.AreEqual(150m, (await TabAsync(customer)).Balance);

        await Suite.BackOffice.RefusedAsync(HttpMethod.Post, Suite.Url($"/{customer}/payment"), new { amount = 200m });
        var tab = await TabAsync(customer);
        Assert.AreEqual(-50m, tab.Balance, "paying more than is owed leaves the café holding fifty of theirs");
        Assert.AreEqual(2, tab.Transactions.Count(t => t.Type == "payment"));

        var (nothingToPay, _) = await Suite.BackOffice.RefusedAsync(HttpMethod.Post, Suite.Url($"/{ACustomer()}/payment"), new { amount = 10m });
        Assert.AreEqual(HttpStatusCode.NotFound, nothingToPay, "a tab that was never opened has nothing to pay");
    }

    [TestMethod]
    public async Task A_bill_settled_on_account_at_the_till_lands_on_the_tabs_by_itself()
    {
        var hany = ACustomer();
        var samia = ACustomer();
        var ticket = Random.Shared.Next(100_000, 999_999);

        var settled = new TicketSettledIntegrationEvent(
            TicketId: ticket,
            BranchId: Suite.Branch,
            ReceiptNumber: 77,
            Total: 500m,
            SettledBy: "Cashier",
            AccountCharges: [new TicketAccountCharge(hany, "Hany", 300m), new TicketAccountCharge(samia, "Samia", 200m)]);

        await TellAsync(settled);

        await ServiceUnderTest<Program>.EventuallyAsync(
            async () => (await Suite.BackOffice.RawAsync(HttpMethod.Get, Suite.Url($"/{samia}"))).StatusCode == HttpStatusCode.OK,
            "a bill put on account opens the tab it named");

        var his = await TabAsync(hany);
        Assert.AreEqual(300m, his.Balance, "a shared bill charges each share to its own tab");
        Assert.AreEqual("Hany", his.CustomerName);
        var charge = his.Transactions.Single();
        Assert.AreEqual("posReceipt", charge.Source, "the till put it there");
        Assert.AreEqual(77, charge.SourceNumber, "and the receipt number travels as data, so each app says it in its own language");
        Assert.AreEqual(ticket, charge.TicketId);
        Assert.IsNull(charge.Description);
        Assert.AreEqual(200m, (await TabAsync(samia)).Balance);

        // The bus delivering it again charges nobody twice; a bill nobody put on account touches no tab
        await TellAsync(settled);
        await TellAsync(new TicketSettledIntegrationEvent(ticket + 1, Suite.Branch, 78, 90m, "Cashier",
            AccountCharges: [new TicketAccountCharge(hany, "Hany", 40m)]));

        await ServiceUnderTest<Program>.EventuallyAsync(
            async () => (await TabAsync(hany)).Balance == 340m,
            "the bill told twice is charged once, and the one behind it is charged");

        Assert.AreEqual(2, (await TabAsync(hany)).Transactions.Count);
    }

    [TestMethod]
    public async Task A_credit_note_and_a_tab_paid_down_at_the_till_both_lower_what_is_owed()
    {
        var customer = ACustomer();
        await ChargeAsync(customer, 500m, "Nour");

        await TellAsync(new TicketRefundedIntegrationEvent(
            RefundId: Random.Shared.Next(100_000, 999_999),
            Number: 12,
            TicketId: 4242,
            BranchId: Suite.Branch,
            ReceiptNumber: 77,
            Amount: 100m,
            Tender: "Account",
            CustomerId: customer,
            CustomerName: "Nour",
            Reason: "A sandwich came back",
            RefundedBy: "Owner"));

        await ServiceUnderTest<Program>.EventuallyAsync(
            async () => (await TabAsync(customer)).Balance == 400m,
            "a credit note on account comes off the tab");

        var credit = (await TabAsync(customer)).Transactions.Single(t => t.Source == "posCreditNote");
        Assert.AreEqual("payment", credit.Type, "money back is money the tab no longer owes");
        Assert.AreEqual(12, credit.SourceNumber);

        await TellAsync(new TabPaymentRecordedIntegrationEvent(
            TabPaymentId: Random.Shared.Next(100_000, 999_999),
            Number: 5,
            BranchId: Suite.Branch,
            CustomerId: customer,
            CustomerName: "Nour",
            Tender: "Cash",
            Amount: 150m,
            RecordedBy: "Cashier",
            RecordedAt: DateTime.UtcNow));

        // A credit note paid in cash is the drawer's business, not the tab's
        await TellAsync(new TicketRefundedIntegrationEvent(
            Random.Shared.Next(100_000, 999_999), 13, 4243, Suite.Branch, 78, 999m, "Cash", customer, "Nour", "Paid back in cash", "Owner"));

        await ServiceUnderTest<Program>.EventuallyAsync(
            async () => (await TabAsync(customer)).Balance == 250m,
            "what the customer paid down at the till comes off what they owe");

        var tab = await TabAsync(customer);
        Assert.AreEqual("posTabPayment", tab.Transactions.First(t => t.Amount == 150m).Source);
        Assert.AreEqual(3, tab.Transactions.Count, "and the cash credit note is nowhere on the tab");
    }

    [TestMethod]
    public async Task The_name_on_a_tab_follows_the_profile()
    {
        var customer = ACustomer();
        await ChargeAsync(customer, 60m, "Mostafa");

        await TellAsync(new UserProfileUpdatedIntegrationEvent(customer, "Mostafa Kamel"));

        await ServiceUnderTest<Program>.EventuallyAsync(
            async () => (await TabAsync(customer)).CustomerName == "Mostafa Kamel",
            "the name the café calls them is the name on their profile");

        var found = await Suite.BackOffice.GetAsync<List<TabSummaryView>>(Suite.Url("/search") + "?q=Mostafa Kamel");
        Assert.AreEqual(customer, found.Single().CustomerId, "and that is the name a manager searches by");

        Assert.IsTrue((await Suite.BackOffice.GetAsync<List<TabSummaryView>>(Suite.Url("/"))).Any(a => a.CustomerId == customer),
            "the list of who owes what has them on it");
    }

    [TestMethod]
    public async Task A_tab_is_the_back_offices_and_the_till_reads_only_the_balance()
    {
        var customer = ACustomer();
        await ChargeAsync(customer, 100m, "Dina");

        foreach (var (method, path, body) in new (HttpMethod, string, object?)[]
        {
            (HttpMethod.Get, Suite.Url("/"), null),
            (HttpMethod.Get, Suite.Url($"/{customer}"), null),
            (HttpMethod.Post, Suite.Url($"/{customer}/charge"), new { amount = 10m }),
            (HttpMethod.Post, Suite.Url($"/{customer}/payment"), new { amount = 10m }),
        })
        {
            var (byTill, _) = await Suite.Till.RefusedAsync(method, path, body);
            Assert.AreEqual(HttpStatusCode.Forbidden, byTill, $"{method} {path} is the back office's");

            var (byCustomer, _) = await Suite.Customer(customer).RefusedAsync(method, path, body);
            Assert.AreEqual(HttpStatusCode.Forbidden, byCustomer, $"{method} {path} is not the customer's own to write");
        }

        Assert.AreEqual(100m, (await Suite.Till.GetAsync<TabSummaryView>(Suite.Url($"/{customer}/balance"))).Balance,
            "what the counter does need: owes a hundred, beside their name");

        using var nobody = Suite.Accounts.AsAnonymous().Http;
        Assert.AreEqual(HttpStatusCode.Unauthorized, (await nobody.GetAsync(Suite.Url("/my"))).StatusCode);
        Assert.AreEqual(HttpStatusCode.Unauthorized, (await nobody.GetAsync(Suite.Url($"/{customer}/balance"))).StatusCode);

        // One customer cannot read another's tab: /my is whoever is asking
        using var someoneElse = await Suite.Customer(ACustomer()).RawAsync(HttpMethod.Get, Suite.Url("/my"));
        Assert.IsEmpty(await someoneElse.Content.ReadAsStringAsync(), "somebody else's hundred is not on their page");
    }

    [TestMethod]
    public async Task What_a_tab_will_not_take()
    {
        var customer = ACustomer();
        await ChargeAsync(customer, 100m, "Sameh");

        foreach (var amount in new[] { 0m, -50m })
        {
            var (charge, why) = await Suite.BackOffice.RefusedAsync(HttpMethod.Post, Suite.Url($"/{customer}/charge"), new { amount });
            Assert.AreEqual(HttpStatusCode.BadRequest, charge, $"a charge of {amount} is not a charge");
            Assert.Contains("greater than zero", why);

            var (payment, _) = await Suite.BackOffice.RefusedAsync(HttpMethod.Post, Suite.Url($"/{customer}/payment"), new { amount });
            Assert.AreEqual(HttpStatusCode.BadRequest, payment, $"a payment of {amount} is not a payment");
        }

        Assert.AreEqual(100m, (await TabAsync(customer)).Balance, "and nothing of it stuck");
    }
}
