using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using Ninja.Sales.API.Payments;
using Ninja.Sales.Infrastructure;
using Ninja.Testing;

namespace Ninja.Sales.FunctionalTests;

/// <summary>Sales with Paymob's API played by <see cref="FakePaymob"/>: the real provider code runs, nothing leaves the test.</summary>
public sealed class SalesUnderTest() : ServiceUnderTest<Program>("salesdb", new()
{
    ["Payments:Key"] = "stack-payments-key-for-tests-000000",
    ["Payments:CallbackBaseUrl"] = "https://api.cafe.test",
    ["Payments:ReturnBaseUrl"] = "https://cafe.test",
    ["Payments:Paymob:BaseUrl"] = "https://paymob.test",
    // A demo stack: pretend payments until the café enters a Paymob account
    ["Payments:Simulated"] = "true",
})
{
    public static readonly FakePaymob Paymob = new();

    protected override void ConfigureServices(IServiceCollection services)
        => services.AddHttpClient<PaymobProvider>().ConfigurePrimaryHttpMessageHandler(() => Paymob);
}

/// <summary>Paymob as far as Sales talks to it: an intention answers with an order and a client secret; a refund answers OK.</summary>
public sealed class FakePaymob : HttpMessageHandler
{
    private int _order = 9000;

    public ConcurrentQueue<(string Path, string? Authorization, JsonNode? Body)> Requests { get; } = new();

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var body = request.Content is null ? null : JsonNode.Parse(await request.Content.ReadAsStringAsync(ct));
        Requests.Enqueue((request.RequestUri!.AbsolutePath, request.Headers.Authorization?.ToString(), body));
        return request.RequestUri.AbsolutePath switch
        {
            "/v1/intention/" => Json(new JsonObject
            {
                ["id"] = "pi_test",
                ["client_secret"] = "cs_test_secret",
                ["intention_order_id"] = Interlocked.Increment(ref _order),
            }),
            "/api/acceptance/void_refund/refund" => Json(new JsonObject { ["success"] = true }),
            _ => new HttpResponseMessage(HttpStatusCode.NotFound),
        };
    }

    private static HttpResponseMessage Json(JsonNode body)
        => new(HttpStatusCode.OK) { Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json") };
}

public record PayLine(int Id, decimal Total, decimal Share, bool Claimed, bool IsMine);
public record PayShare(string? PayerName, decimal Amount, string Status, bool IsMine, Guid? Key);
public record PayOptions(bool Ready, string Currency, bool AllowEqual, bool Simulated);
public record PayBill(int TicketId, string Status, List<PayLine> Lines, decimal Total, decimal Paid, decimal Held, decimal Remaining, List<PayShare> Shares, PayOptions Options, bool CanPay, string? Why);
public record Started(Guid Key, string CheckoutUrl, decimal Amount, decimal Fee, decimal Tip, decimal Charged);
public record PaymentStatus(Guid Key, string Status, decimal Amount, bool BillClosed);
public record SettingsView(bool SecretKeySet, string? SecretKeyHint, bool HmacSecretSet, bool Ready, bool CanKeepSecrets, string CallbackUrl, bool Simulated);

/// <summary>
/// A table paying its bill from its phones through the café's own Paymob
/// account: the owner sets the account up, two guests split the bill, the
/// signed callbacks mark their shares paid, and the bill closes itself.
/// </summary>
[TestClass]
public sealed class PaymentScenarios
{
    private const string Version = "api-version=1.0";
    private const string HmacSecret = "cafe-hmac-secret";
    private const string SecretKey = "sk_test_cafe_1234";

    private static Caller Till => Suite.Sales.As(Persona.Cashier(Suite.Branch), Suite.Branch);
    private static Caller Owner => Suite.Sales.As(Persona.Owner(Suite.Branch), Suite.Branch);

    private static int _nextTable = 700;

    private static Caller Guest(string id)
    {
        var caller = Suite.Sales.AsAnonymous();
        caller.Http.DefaultRequestHeaders.Add("X-Guest-Id", id);
        return caller;
    }

    private static async Task SetUpCafeAsync()
    {
        await Owner.PutAsync<SettingsView>($"/api/sales/payments/settings?{Version}", new
        {
            currency = "EGP",
            secretKey = SecretKey,
            publicKey = "egy_pk_test",
            hmacSecret = HmacSecret,
            cardIntegrationId = 123,
            feeMode = 0,
            feePercent = 0,
            feeFixed = 0,
            tipsEnabled = true,
            tipPercents = new[] { 10 },
            allowItems = true,
            allowEqual = true,
            allowCustom = true,
        });
        // The café bought the module and switched it on: what Tenant.API's event would have said
        using var scope = Suite.Sales.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SalesContext>();
        var row = await db.TenantFeatures.FindAsync(Infrastructure.Projections.TenantFeatures.SingletonId);
        if (row is null) db.TenantFeatures.Add(new() { PayAtTable = true, UpdatedAt = DateTime.UtcNow });
        else row.PayAtTable = true;
        await db.SaveChangesAsync();
    }

    private static async Task<(int TicketId, int Table)> ATableBillAsync(decimal total)
    {
        var table = Interlocked.Increment(ref _nextTable);
        var opened = await Till.PostAsync<OpenedTicketView>($"/api/tickets?{Version}", new { type = 1, label = $"Table {table}", placeId = table });
        var (status, detail) = await Till.RefusedAsync(HttpMethod.Post, $"/api/tickets/{opened.TicketId}/lines?{Version}", new
        {
            description = new { en = "Mixed grill", ar = "مشويات" },
            qty = 1,
            unitPrice = total,
        });
        Assert.AreEqual(HttpStatusCode.OK, status, detail);
        return (opened.TicketId, table);
    }

    private static Task<PayBill> AtTableAsync(Caller guest, int table)
        => guest.GetAsync<PayBill>($"/api/sales/payments/places/{table}?branchId={Suite.Branch}&{Version}");

    /// <summary>Paymob's transaction callback for a checkout, signed as Paymob signs it (or not).</summary>
    private static async Task<HttpStatusCode> CallbackAsync(string order, Guid key, decimal charged, bool success = true, string? secret = HmacSecret)
    {
        var obj = new JsonObject
        {
            // One transaction per checkout: Paymob repeats the same one when it retries
            ["id"] = Math.Abs(key.GetHashCode()) % 900000 + 100000 + (success ? 0 : 1),
            ["pending"] = false,
            ["amount_cents"] = (long)(charged * 100),
            ["success"] = success,
            ["is_auth"] = false,
            ["is_capture"] = false,
            ["is_standalone_payment"] = true,
            ["is_voided"] = false,
            ["is_refunded"] = false,
            ["is_3d_secure"] = true,
            ["integration_id"] = 123,
            ["has_parent_transaction"] = false,
            ["order"] = new JsonObject { ["id"] = long.Parse(order), ["merchant_order_id"] = key.ToString("N") },
            ["created_at"] = "2026-09-26T20:00:00.000000",
            ["currency"] = "EGP",
            ["source_data"] = new JsonObject { ["pan"] = "2346", ["type"] = "card", ["sub_type"] = "MasterCard" },
            ["error_occured"] = false,
            ["owner"] = 42,
        };
        // Paymob's documented order, values as sent, booleans lower-case
        string[] fields = ["amount_cents", "created_at", "currency", "error_occured", "has_parent_transaction", "id", "integration_id", "is_3d_secure", "is_auth", "is_capture", "is_refunded", "is_standalone_payment", "is_voided", "order.id", "owner", "pending", "source_data.pan", "source_data.sub_type", "source_data.type", "success"];
        var concatenated = string.Concat(fields.Select(f => f.Split('.').Aggregate((JsonNode?)obj, (n, part) => n?[part])?.ToJsonString().Trim('"') ?? ""));
        var hmac = Convert.ToHexStringLower(HMACSHA512.HashData(Encoding.UTF8.GetBytes(secret ?? "wrong"), Encoding.UTF8.GetBytes(concatenated)));

        var response = await Suite.Sales.CreateClient().PostAsJsonAsync($"{PaymentsApi.CallbackPath}?hmac={hmac}", new JsonObject { ["type"] = "TRANSACTION", ["obj"] = obj });
        return response.StatusCode;
    }

    // The order the fake handed out for a checkout: intentions are answered in turn, so it is read back from the payment
    private static string OrderFor(Guid key)
    {
        using var scope = Suite.Sales.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SalesContext>();
        return db.OnlinePayments.Single(p => p.Key == key).ProviderReference!;
    }

    [TestMethod]
    public async Task The_owners_provider_secrets_are_kept_sealed_and_never_read_back()
    {
        await SetUpCafeAsync();

        var response = await Owner.RawAsync(HttpMethod.Get, $"/api/sales/payments/settings?{Version}");
        var text = await response.Content.ReadAsStringAsync();
        var settings = await Owner.GetAsync<SettingsView>($"/api/sales/payments/settings?{Version}");

        Assert.IsTrue(settings.SecretKeySet);
        Assert.AreEqual("1234", settings.SecretKeyHint, "the owner can tell which key is set");
        Assert.IsTrue(settings.HmacSecretSet);
        Assert.IsTrue(settings.Ready);
        Assert.AreEqual("https://api.cafe.test/api/sales/payments/paymob/callback", settings.CallbackUrl, "what the owner pastes into Paymob");
        Assert.DoesNotContain(SecretKey, text, "a secret never leaves the server");
        Assert.DoesNotContain(HmacSecret, text);

        using var scope = Suite.Sales.Services.CreateScope();
        var stored = scope.ServiceProvider.GetRequiredService<SalesContext>().PaymentSettings.Single();
        Assert.StartsWith("sealed:v1:", stored.SealedSecretKey!, "and the database holds it only sealed");
        Assert.DoesNotContain(SecretKey, stored.SealedSecretKey!);

        var (status, _) = await Till.RefusedAsync(HttpMethod.Get, $"/api/sales/payments/settings?{Version}");
        Assert.AreEqual(HttpStatusCode.Forbidden, status, "the account is the owner's");
    }

    [TestMethod]
    public async Task Two_guests_split_a_bill_and_it_settles_itself_when_the_last_share_lands()
    {
        await SetUpCafeAsync();
        var (ticketId, table) = await ATableBillAsync(200m);
        var sara = Guest("guest-sara-" + table);
        var omar = Guest("guest-omar-" + table);

        var bill = await AtTableAsync(sara, table);
        Assert.AreEqual(ticketId, bill.TicketId);
        Assert.AreEqual(200m, bill.Remaining);
        Assert.IsTrue(bill.CanPay, bill.Why);

        // Sara pays her half, with a tip
        var half = await sara.PostAsync<Started>($"/api/sales/payments/tickets/{ticketId}?{Version}", new { mode = 2, parts = 1, of = 2, tip = 10m, payerName = "Sara" });
        Assert.AreEqual(100m, half.Amount);
        Assert.AreEqual(110m, half.Charged, "the tip is charged on top of her share");
        StringAssert.StartsWith(half.CheckoutUrl, "https://paymob.test/unifiedcheckout/?publicKey=egy_pk_test&clientSecret=cs_test_secret");
        var intention = SalesUnderTest.Paymob.Requests.Last(r => r.Path == "/v1/intention/");
        Assert.AreEqual($"Token {SecretKey}", intention.Authorization, "the café's own account, opened only for the call");
        Assert.AreEqual(11000, intention.Body!["amount"]!.GetValue<long>(), "in piasters");

        // While her checkout is open, Omar cannot take her half too
        var (refused, why) = await omar.RefusedAsync(HttpMethod.Post, $"/api/sales/payments/tickets/{ticketId}?{Version}", new { mode = 3, amount = 150m, tip = 0 });
        Assert.AreEqual(HttpStatusCode.BadRequest, refused);
        Assert.Contains("100.00", why);

        // A forged callback changes nothing
        Assert.AreEqual(HttpStatusCode.Unauthorized, await CallbackAsync(OrderFor(half.Key), half.Key, 110m, secret: "forged"));
        Assert.AreEqual("Pending", (await sara.GetAsync<PaymentStatus>($"/api/sales/payments/{half.Key}?{Version}")).Status);

        // Paymob's real one marks it paid; a repeat is nothing
        Assert.AreEqual(HttpStatusCode.OK, await CallbackAsync(OrderFor(half.Key), half.Key, 110m));
        Assert.AreEqual(HttpStatusCode.OK, await CallbackAsync(OrderFor(half.Key), half.Key, 110m));
        bill = await AtTableAsync(omar, table);
        Assert.AreEqual(100m, bill.Paid);
        Assert.AreEqual(100m, bill.Remaining);
        Assert.AreEqual("Sara", bill.Shares.Single().PayerName, "the table sees who paid");

        // The till cannot settle while Omar is at the checkout
        var rest = await omar.PostAsync<Started>($"/api/sales/payments/tickets/{ticketId}?{Version}", new { mode = 0, tip = 0 });
        Assert.AreEqual(100m, rest.Amount);
        var (tillRefused, tillWhy) = await Till.RefusedAsync(HttpMethod.Post, $"/api/tickets/{ticketId}/settle?{Version}", new { payments = new[] { new { tender = 0, amount = 100m } } });
        Assert.AreEqual(HttpStatusCode.BadRequest, tillRefused);
        Assert.Contains("paying this bill online", tillWhy);

        Assert.AreEqual(HttpStatusCode.OK, await CallbackAsync(OrderFor(rest.Key), rest.Key, 100m));

        var status = await omar.GetAsync<PaymentStatus>($"/api/sales/payments/{rest.Key}?{Version}");
        Assert.AreEqual("Paid", status.Status);
        Assert.IsTrue(status.BillClosed, "paid in full online, the bill settled itself");
        var settled = await Till.GetAsync<TicketView>($"/api/tickets/{ticketId}?{Version}");
        Assert.AreEqual("Settled", settled.Status);
        CollectionAssert.AreEqual(new[] { "Online", "Online" }, settled.Payments.Select(p => p.Tender).ToArray());
        Assert.AreEqual(200m, settled.Payments.Sum(p => p.Amount), "the shares, not the tip, pay the bill");
    }

    [TestMethod]
    public async Task A_declined_card_lets_the_share_go_and_the_till_settles_the_rest_with_the_online_part()
    {
        await SetUpCafeAsync();
        var (ticketId, table) = await ATableBillAsync(90m);
        var guest = Guest("guest-lina-" + table);
        var bill = await AtTableAsync(guest, table);

        var mine = await guest.PostAsync<Started>($"/api/sales/payments/tickets/{ticketId}?{Version}", new { mode = 1, lineIds = new[] { bill.Lines.Single().Id }, tip = 0 });
        Assert.AreEqual(90m, mine.Amount);
        Assert.IsTrue((await AtTableAsync(guest, table)).Lines.Single().Claimed, "held while her checkout is open");

        Assert.AreEqual(HttpStatusCode.OK, await CallbackAsync(OrderFor(mine.Key), mine.Key, 90m, success: false));
        bill = await AtTableAsync(guest, table);
        Assert.IsFalse(bill.Lines.Single().Claimed, "a declined card lets the item go");
        Assert.AreEqual(90m, bill.Remaining);

        var part = await guest.PostAsync<Started>($"/api/sales/payments/tickets/{ticketId}?{Version}", new { mode = 3, amount = 40m, tip = 0 });
        Assert.AreEqual(HttpStatusCode.OK, await CallbackAsync(OrderFor(part.Key), part.Key, 40m));
        Assert.AreEqual("Open", (await Till.GetAsync<TicketView>($"/api/tickets/{ticketId}?{Version}")).Status, "part paid is not paid");

        // The till takes the rest in cash; the online part is counted in
        await Till.PostAsync<SettleResultView>($"/api/tickets/{ticketId}/settle?{Version}", new { payments = new[] { new { tender = 0, amount = 50m } } });
        var settled = await Till.GetAsync<TicketView>($"/api/tickets/{ticketId}?{Version}");
        Assert.AreEqual("Settled", settled.Status);
        CollectionAssert.AreEquivalent(new[] { "Cash", "Online" }, settled.Payments.Select(p => p.Tender).ToArray());
    }

    [TestMethod]
    public async Task A_demo_without_a_paymob_account_pays_with_pretend_money_and_nothing_else_can()
    {
        await SetUpCafeAsync();
        // The demo has no Paymob account yet
        var settings = await Owner.PutAsync<SettingsView>($"/api/sales/payments/settings?{Version}", new
        {
            currency = "EGP", secretKey = "", publicKey = (string?)null, hmacSecret = "", cardIntegrationId = (int?)null,
            feeMode = 0, feePercent = 0, feeFixed = 0, tipsEnabled = false, tipPercents = Array.Empty<int>(),
            allowItems = true, allowEqual = true, allowCustom = true,
        });
        try
        {
            Assert.IsFalse(settings.Ready);
            Assert.IsTrue(settings.Simulated, "the owner is told payments are pretend until the account is in");

            var (ticketId, table) = await ATableBillAsync(80m);
            var guest = Guest("guest-demo-" + table);
            var bill = await AtTableAsync(guest, table);
            Assert.IsTrue(bill.CanPay, bill.Why);
            Assert.IsTrue(bill.Options.Simulated, "the guest's phone says it is a demo");

            var intentions = SalesUnderTest.Paymob.Requests.Count;
            var declined = await guest.PostAsync<Started>($"/api/sales/payments/tickets/{ticketId}?{Version}", new { mode = 0, tip = 0 });
            StringAssert.StartsWith(declined.CheckoutUrl, $"https://cafe.test/pay/{declined.Key:N}?simulate=1", "the checkout is the app's own page");
            Assert.AreEqual(intentions, SalesUnderTest.Paymob.Requests.Count, "Paymob is never called");

            // Paymob's callback cannot touch a pretend payment, and a real one cannot be simulated
            var decline = await guest.PostAsync<PaymentStatus>($"/api/sales/payments/{declined.Key}/simulate?{Version}", new { paid = false });
            Assert.AreEqual("Failed", decline.Status);
            var (again, _) = await guest.RefusedAsync(HttpMethod.Post, $"/api/sales/payments/{declined.Key}/simulate?{Version}", new { paid = true });
            Assert.AreEqual(HttpStatusCode.BadRequest, again, "a finished payment stays as it finished");

            var paid = await guest.PostAsync<Started>($"/api/sales/payments/tickets/{ticketId}?{Version}", new { mode = 0, tip = 0 });
            var status = await guest.PostAsync<PaymentStatus>($"/api/sales/payments/{paid.Key}/simulate?{Version}", new { paid = true });
            Assert.AreEqual("Paid", status.Status);
            Assert.IsTrue(status.BillClosed, "and the bill settles itself as a real one would");
        }
        finally
        {
            await SetUpCafeAsync();
        }

        // With the account back, payments go to Paymob and cannot be simulated
        var (ticket2, table2) = await ATableBillAsync(20m);
        var real = await Guest("guest-real-" + table2).PostAsync<Started>($"/api/sales/payments/tickets/{ticket2}?{Version}", new { mode = 0, tip = 0 });
        StringAssert.StartsWith(real.CheckoutUrl, "https://paymob.test/");
        var (refused, _) = await Guest("guest-real-" + table2).RefusedAsync(HttpMethod.Post, $"/api/sales/payments/{real.Key}/simulate?{Version}", new { paid = true });
        Assert.AreEqual(HttpStatusCode.NotFound, refused);
    }

    [TestMethod]
    public async Task A_checkout_left_unfinished_is_let_go_by_its_payer_or_the_till_not_by_anyone_else()
    {
        await SetUpCafeAsync();
        var (ticketId, table) = await ATableBillAsync(60m);
        var nour = Guest("guest-nour-" + table);
        var other = Guest("guest-other-" + table);

        var started = await nour.PostAsync<Started>($"/api/sales/payments/tickets/{ticketId}?{Version}", new { mode = 0, tip = 0 });
        var bill = await AtTableAsync(nour, table);
        Assert.AreEqual(0m, bill.Remaining, "held while her checkout is open");
        Assert.IsNotNull(bill.Shares.Single().Key, "her own share comes with its key, to go back to it or cancel it");
        Assert.IsNull((await AtTableAsync(other, table)).Shares.Single().Key, "nobody else sees it");

        var (notHers, _) = await other.RefusedAsync(HttpMethod.Post, $"/api/sales/payments/{started.Key}/cancel?{Version}");
        Assert.AreEqual(HttpStatusCode.NotFound, notHers, "only the payer takes a checkout back");

        var (cancelled, _) = await nour.RefusedAsync(HttpMethod.Post, $"/api/sales/payments/{started.Key}/cancel?{Version}");
        Assert.AreEqual(HttpStatusCode.NoContent, cancelled);
        Assert.AreEqual(60m, (await AtTableAsync(other, table)).Remaining, "the share is free again at once");

        // Walked away again: this time the till lets it go
        var again = await nour.PostAsync<Started>($"/api/sales/payments/tickets/{ticketId}?{Version}", new { mode = 0, tip = 0 });
        var (released, _) = await Till.RefusedAsync(HttpMethod.Post, $"/api/sales/payments/{again.Key}/cancel?{Version}");
        Assert.AreEqual(HttpStatusCode.NoContent, released);
        Assert.AreEqual(60m, (await AtTableAsync(other, table)).Remaining);

        // The money came through after all: paid is paid
        Assert.AreEqual(HttpStatusCode.OK, await CallbackAsync(OrderFor(again.Key), again.Key, 60m));
        Assert.AreEqual("Paid", (await nour.GetAsync<PaymentStatus>($"/api/sales/payments/{again.Key}?{Version}")).Status);
    }

    [TestMethod]
    public async Task A_bill_is_not_paid_online_where_the_cafe_has_it_off()
    {
        await SetUpCafeAsync();
        var (ticketId, table) = await ATableBillAsync(30m);
        using (var scope = Suite.Sales.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SalesContext>();
            (await db.TenantFeatures.FindAsync(Infrastructure.Projections.TenantFeatures.SingletonId))!.PayAtTable = false;
            await db.SaveChangesAsync();
        }
        try
        {
            var guest = Guest("guest-off-" + table);
            var bill = await AtTableAsync(guest, table);
            Assert.IsFalse(bill.CanPay);
            Assert.AreEqual("off", bill.Why);
            var (status, detail) = await guest.RefusedAsync(HttpMethod.Post, $"/api/sales/payments/tickets/{ticketId}?{Version}", new { mode = 0, tip = 0 });
            Assert.AreEqual(HttpStatusCode.BadRequest, status);
            Assert.Contains("off", detail);
        }
        finally
        {
            await SetUpCafeAsync();
        }
    }
}
