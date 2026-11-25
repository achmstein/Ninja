using System.Collections.Concurrent;
using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;
using Ninja.Ordering.API.Application.IntegrationEvents.Events;
using Ninja.Ordering.API.Deliveries;
using Ninja.Testing;

namespace Ninja.Ordering.FunctionalTests;

/// <summary>Ordering as the suite runs it: a stack key to seal couriers' secrets, and a courier company's system that answers here.</summary>
public sealed class OrderingUnderTest() : ServiceUnderTest<Program>("orderingdb", new()
{
    ["Couriers:Key"] = "suite-courier-key",
    ["Couriers:CallbackBaseUrl"] = "https://api.suite.ninja.test",
})
{
    protected override void ConfigureServices(IServiceCollection services) =>
        services.AddHttpClient(CourierDispatch.HttpClientName).ConfigurePrimaryHttpMessageHandler(() => FakeCourierSystem.Handler);
}

/// <summary>
/// A courier company's system as docs/courier-api.md describes it: takes a job and answers its id,
/// cancels one, and keeps what it was sent. A company told to refuse answers 503.
/// </summary>
public static class FakeCourierSystem
{
    public sealed record Received(string Method, string Path, string? Authorization, string? IdempotencyKey, JsonNode? Body);

    public static readonly ConcurrentQueue<Received> Calls = new();
    public static readonly ConcurrentDictionary<string, bool> Refusing = new();

    public static HttpMessageHandler Handler => new Answering();

    public static List<Received> To(string host) => Calls.Where(c => c.Path.StartsWith($"https://{host}/", StringComparison.Ordinal)).ToList();

    private sealed class Answering : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var text = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            var body = string.IsNullOrEmpty(text) ? null : JsonNode.Parse(text);
            var url = request.RequestUri!.ToString();
            // Decided before the call is kept, so a test that sees the call knows how it was answered
            var refusing = Refusing.ContainsKey(request.RequestUri.Host);
            Calls.Enqueue(new(request.Method.Method, url, request.Headers.Authorization?.ToString(),
                request.Headers.TryGetValues("Idempotency-Key", out var keys) ? keys.First() : null, body));

            if (refusing)
                return new HttpResponseMessage(HttpStatusCode.ServiceUnavailable) { Content = new StringContent("busy") };
            if (url.EndsWith("/jobs", StringComparison.Ordinal))
                return Json(new { jobId = $"job-{body!["orderId"]}", trackingUrl = $"https://track.test/{body["orderId"]}", fee = 35m });
            if (url.EndsWith("/cancel", StringComparison.Ordinal))
                return Json(new { cancelled = true });
            return new HttpResponseMessage(HttpStatusCode.NotFound);
        }

        private static HttpResponseMessage Json(object value) => new(HttpStatusCode.OK)
        {
            Content = new StringContent(JsonSerializer.Serialize(value), Encoding.UTF8, "application/json"),
        };
    }
}

/// <summary>
/// A courier company connected through Ninja's courier API: the delivery the till gives it reaches
/// its system as a job, its signed statuses move the delivery as the till would for a manual
/// courier, a status not signed by it (or replayed, or for a job it no longer has) changes nothing,
/// and taking the delivery back cancels the job there.
/// </summary>
[TestClass]
public sealed class CourierApiScenarios
{
    private const string Orders = "/api/orders";
    private const string Version = "api-version=1.0";

    /// <summary>A branch of its own, so its courier companies touch no other scenario</summary>
    private const int Branch = 31;

    private static Caller Owner => Suite.Ordering.As(Persona.Owner(Branch), Branch);
    private static Caller Till => Suite.Ordering.As(Persona.Cashier(Branch), Branch);

    private sealed record Provider(int Id, string Name, bool IsConnected);
    private sealed record Connection(bool Connected, string? ApiBaseUrl, bool HasApiKey, bool HasWebhookSecret, string StatusUrl, bool CanKeepSecrets);
    private sealed record SigningSecret(string Secret, string StatusUrl);

    private static async Task BranchAsync()
    {
        using var scope = Suite.Ordering.Services.CreateScope();
        await ActivatorUtilities.CreateInstance<BranchSettingsChangedIntegrationEventHandler>(scope.ServiceProvider).Handle(
            new BranchSettingsChangedIntegrationEvent(
                Branch, IsOrderingEnabled: true, IsReservationsEnabled: true, IsDeliveryEnabled: true,
                Latitude: 30.0444, Longitude: 31.2357, DeliveryRadiusKm: 5, DeliveryFee: 20,
                Name: new("Zamalek", "الزمالك"), Address: new("26 July St", "شارع ٢٦ يوليو"), Phone: "+20225550000"));
    }

    /// <summary>A company listed and connected, its system at its own host, and the secret it signs with</summary>
    private static async Task<(int Id, string Host, string Secret)> ConnectedCompanyAsync()
    {
        await BranchAsync();
        var host = $"courier-{Guid.NewGuid():N}.test";
        var company = await Owner.PostAsync<Provider>($"{Orders}/couriers?{Version}", new { name = "Fast Couriers", defaultFee = 30m });
        var connection = await Owner.PutAsync<Connection>($"{Orders}/couriers/{company.Id}/connection?{Version}", new { apiBaseUrl = $"https://{host}/ninja/", apiKey = "ck_live_123" });
        Assert.IsTrue(connection.Connected);
        Assert.IsTrue(connection.HasApiKey);
        var secret = await Owner.PostAsync<SigningSecret>($"{Orders}/couriers/{company.Id}/webhook-secret?{Version}");
        Assert.AreEqual($"https://api.suite.ninja.test/api/orders/couriers/{company.Id}/status?{Version}", secret.StatusUrl);
        return (company.Id, host, secret.Secret);
    }

    private static async Task<int> ConfirmedDeliveryAsync(bool paysOnline = false)
    {
        using var scope = Suite.Ordering.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<Ninja.Ordering.Infrastructure.OrderingContext>();
        var order = new Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order(
            string.Empty, string.Empty, Branch, guestId: $"device-{Guid.NewGuid():N}", guestName: "Mona", guestPhone: "01001234567",
            delivery: new Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Delivery(30.06, 31.245, "Qasr El Nil St", "12", "3", "7", "Blue door", "01001234567", 20, 2000));
        order.AddOrderItem(1, new() { En = "Family meal" }, 60, 0, null, units: 2);
        order.SetValidatedStatus();
        order.SetConfirmedStatus();
        order.ClearDomainEvents();
        context.Orders.Add(order);
        await context.SaveChangesAsync();
        return order.Id;
    }

    private static async Task<Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Delivery> DeliveryOfAsync(int orderId)
    {
        using var scope = Suite.Ordering.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<Ninja.Ordering.Infrastructure.OrderingContext>();
        return (await context.Orders.AsNoTracking().SingleAsync(o => o.Id == orderId)).Delivery!;
    }

    /// <summary>A status as the company sends it: the raw body signed with its secret and the time</summary>
    private static async Task<HttpResponseMessage> StatusAsync(int companyId, string secret, object status, DateTimeOffset? at = null, string? signature = null)
    {
        var body = JsonSerializer.Serialize(status, JsonSerializerOptions.Web);
        var timestamp = (at ?? DateTimeOffset.UtcNow).ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture);
        var request = new HttpRequestMessage(HttpMethod.Post, $"{Orders}/couriers/{companyId}/status?{Version}")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        };
        request.Headers.Add(CourierStatusReceiver.TimestampHeader, timestamp);
        request.Headers.Add(CourierStatusReceiver.SignatureHeader, signature ?? CourierSecrets.Sign(secret, timestamp, body));
        // Nobody signed in: the signature is the company's word
        return await Suite.Ordering.CreateClient().SendAsync(request);
    }

    /// <summary>The cancel the company was sent: queued with the step, sent by the background sender within seconds</summary>
    private static async Task<FakeCourierSystem.Received> CancelSentAsync(string host)
    {
        for (var waited = 0; waited < 150; waited++)
        {
            if (FakeCourierSystem.To(host).LastOrDefault(c => c.Path.EndsWith("/cancel", StringComparison.Ordinal)) is { } cancel)
                return cancel;
            await Task.Delay(100);
        }
        throw new AssertFailedException($"No cancel reached {host}.");
    }

    private static async Task<Ninja.Ordering.Infrastructure.Deliveries.CourierCancel> QueuedCancelAsync(int orderId)
    {
        using var scope = Suite.Ordering.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<Ninja.Ordering.Infrastructure.OrderingContext>();
        return await context.CourierCancels.AsNoTracking().SingleAsync(c => c.OrderId == orderId);
    }

    private static async Task GiveAsync(int orderId, int companyId, HttpStatusCode expected = HttpStatusCode.NoContent)
    {
        using var given = await Till.RawAsync(HttpMethod.Put, $"{Orders}/{orderId}/delivery/courier?{Version}", new { providerId = companyId });
        Assert.AreEqual(expected, given.StatusCode, await given.Content.ReadAsStringAsync());
    }

    [TestMethod]
    public async Task A_delivery_given_to_a_connected_company_reaches_its_system_and_its_statuses_carry_it_to_the_door()
    {
        var (company, host, secret) = await ConnectedCompanyAsync();
        var orderId = await ConfirmedDeliveryAsync();

        await GiveAsync(orderId, company);

        var job = FakeCourierSystem.To(host).Single();
        Assert.AreEqual($"https://{host}/ninja/jobs", job.Path);
        Assert.AreEqual("Bearer ck_live_123", job.Authorization, "the key the company gave, opened from its seal");
        Assert.IsNotNull(job.IdempotencyKey);
        Assert.AreEqual(orderId, (int)job.Body!["orderId"]!);
        Assert.AreEqual("Zamalek", (string?)job.Body["pickup"]!["name"]);
        Assert.AreEqual("+20225550000", (string?)job.Body["pickup"]!["phone"]);
        Assert.AreEqual("Blue door", (string?)job.Body["dropoff"]!["directions"]);
        Assert.AreEqual(140m, (decimal)job.Body["cashToCollect"]!, "two at 60 and the delivery fee");
        Assert.AreEqual(2, (int)job.Body["items"]![0]!["quantity"]!);

        var given = await DeliveryOfAsync(orderId);
        Assert.AreEqual($"job-{orderId}", given.CourierJobId);
        Assert.AreEqual(35m, given.CourierFee, "the company's own fee for the job");
        Assert.AreEqual($"https://track.test/{orderId}", given.CourierTrackingUrl);

        using (var assigned = await StatusAsync(company, secret, new { jobId = $"job-{orderId}", orderId, sequence = 1, status = "assigned", courierName = "Karim", courierPhone = "01112223334" }))
            Assert.AreEqual(HttpStatusCode.OK, assigned.StatusCode, await assigned.Content.ReadAsStringAsync());
        Assert.AreEqual("Karim", (await DeliveryOfAsync(orderId)).CourierName);

        using (var pickedUp = await StatusAsync(company, secret, new { jobId = $"job-{orderId}", orderId, sequence = 2, status = "picked_up" }))
            Assert.AreEqual(HttpStatusCode.OK, pickedUp.StatusCode);
        Assert.IsNotNull((await DeliveryOfAsync(orderId)).OutAt);

        using (var delivered = await StatusAsync(company, secret, new { jobId = $"job-{orderId}", orderId, sequence = 3, status = "delivered", collected = 140m }))
            Assert.AreEqual(HttpStatusCode.OK, delivered.StatusCode, await delivered.Content.ReadAsStringAsync());
        var done = await DeliveryOfAsync(orderId);
        Assert.IsNotNull(done.DeliveredAt);
        Assert.AreEqual(140m, done.CourierCollected);

        // Sent again: taken, and nothing moves
        using (var again = await StatusAsync(company, secret, new { jobId = $"job-{orderId}", orderId, sequence = 2, status = "picked_up" }))
            Assert.AreEqual(HttpStatusCode.OK, again.StatusCode);
        Assert.AreEqual(3, (await DeliveryOfAsync(orderId)).CourierSequence);
    }

    [TestMethod]
    public async Task A_status_not_signed_by_the_company_or_too_old_or_for_a_job_it_no_longer_has_changes_nothing()
    {
        var (company, _, secret) = await ConnectedCompanyAsync();
        var orderId = await ConfirmedDeliveryAsync();
        await GiveAsync(orderId, company);
        var status = new { jobId = $"job-{orderId}", orderId, sequence = 1, status = "picked_up" };

        using (var forged = await StatusAsync(company, "whsec_not-theirs", status))
            Assert.AreEqual(HttpStatusCode.Unauthorized, forged.StatusCode);
        using (var unsigned = await StatusAsync(company, secret, status, signature: "sha256=00"))
            Assert.AreEqual(HttpStatusCode.Unauthorized, unsigned.StatusCode);
        using (var replayed = await StatusAsync(company, secret, status, at: DateTimeOffset.UtcNow.AddMinutes(-30)))
            Assert.AreEqual(HttpStatusCode.Unauthorized, replayed.StatusCode);
        using (var otherJob = await StatusAsync(company, secret, new { jobId = "job-someone-else", orderId, sequence = 1, status = "picked_up" }))
            Assert.AreEqual(HttpStatusCode.Gone, otherJob.StatusCode);
        using (var unknown = await StatusAsync(company, secret, new { jobId = $"job-{orderId}", orderId, sequence = 1, status = "teleported" }))
            Assert.AreEqual(HttpStatusCode.BadRequest, unknown.StatusCode);
        using (var noAmount = await StatusAsync(company, secret, new { jobId = $"job-{orderId}", orderId, sequence = 1, status = "delivered" }))
            Assert.AreEqual(HttpStatusCode.BadRequest, noAmount.StatusCode, "a delivery with cash to collect says what was collected");

        Assert.IsNull((await DeliveryOfAsync(orderId)).OutAt);
    }

    [TestMethod]
    public async Task A_company_whose_system_does_not_take_the_job_leaves_the_delivery_for_a_rider()
    {
        var (company, host, _) = await ConnectedCompanyAsync();
        var orderId = await ConfirmedDeliveryAsync();
        FakeCourierSystem.Refusing[host] = true;
        try
        {
            using var refused = await Till.RawAsync(HttpMethod.Put, $"{Orders}/{orderId}/delivery/courier?{Version}", new { providerId = company });
            Assert.AreEqual(HttpStatusCode.Conflict, refused.StatusCode);
            StringAssert.Contains(await refused.Content.ReadAsStringAsync(), "courier.unreachable");
        }
        finally
        {
            FakeCourierSystem.Refusing.TryRemove(host, out _);
        }

        Assert.IsNull((await DeliveryOfAsync(orderId)).CourierProviderId, "nothing given");
    }

    [TestMethod]
    public async Task Taking_the_delivery_back_cancels_the_job_and_the_company_can_give_one_up()
    {
        var (company, host, secret) = await ConnectedCompanyAsync();
        var takenBack = await ConfirmedDeliveryAsync();
        await GiveAsync(takenBack, company);

        using (var back = await Till.RawAsync(HttpMethod.Delete, $"{Orders}/{takenBack}/delivery/courier?{Version}"))
            Assert.AreEqual(HttpStatusCode.NoContent, back.StatusCode);
        var cancel = await CancelSentAsync(host);
        Assert.AreEqual($"https://{host}/ninja/jobs/job-{takenBack}/cancel", cancel.Path);
        Assert.AreEqual("taken_back", (string?)cancel.Body!["reason"]);

        // A status for the job it no longer has is told so
        using (var late = await StatusAsync(company, secret, new { jobId = $"job-{takenBack}", orderId = takenBack, sequence = 1, status = "assigned" }))
            Assert.AreEqual(HttpStatusCode.Gone, late.StatusCode);

        var givenUp = await ConfirmedDeliveryAsync();
        await GiveAsync(givenUp, company);
        using (var cancelled = await StatusAsync(company, secret, new { jobId = $"job-{givenUp}", orderId = givenUp, sequence = 1, status = "cancelled", reason = "no courier free" }))
            Assert.AreEqual(HttpStatusCode.OK, cancelled.StatusCode, await cancelled.Content.ReadAsStringAsync());
        Assert.IsNull((await DeliveryOfAsync(givenUp)).CourierProviderId, "back with the till to give to someone else");
    }

    [TestMethod]
    public async Task A_company_down_when_the_delivery_is_taken_back_is_told_once_it_answers()
    {
        var (company, host, _) = await ConnectedCompanyAsync();
        var orderId = await ConfirmedDeliveryAsync();
        await GiveAsync(orderId, company);

        FakeCourierSystem.Refusing[host] = true;
        using (var back = await Till.RawAsync(HttpMethod.Delete, $"{Orders}/{orderId}/delivery/courier?{Version}"))
            Assert.AreEqual(HttpStatusCode.NoContent, back.StatusCode, "the till is never held up by the company");
        await CancelSentAsync(host);
        FakeCourierSystem.Refusing.TryRemove(host, out _);

        Ninja.Ordering.Infrastructure.Deliveries.CourierCancel queued = null!;
        for (var waited = 0; waited < 50 && (queued = await QueuedCancelAsync(orderId)).Attempts == 0; waited++)
            await Task.Delay(100);
        Assert.IsNull(queued.SentAt, $"not taken while it was down: attempts {queued.Attempts}, error {queued.LastError}, calls {string.Join(" | ", FakeCourierSystem.To(host).Select(c => c.Path))}");
        Assert.IsNotNull(queued.LastError);

        // Its next try, brought forward rather than waited for
        using (var scope = Suite.Ordering.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<Ninja.Ordering.Infrastructure.OrderingContext>().CourierCancels
                .Where(c => c.OrderId == orderId).ExecuteUpdateAsync(c => c.SetProperty(x => x.NextAttemptAt, DateTime.UtcNow.AddSeconds(-1)));
        for (var waited = 0; waited < 150 && (queued = await QueuedCancelAsync(orderId)).SentAt is null; waited++)
            await Task.Delay(100);
        Assert.IsNotNull(queued.SentAt, "taken once the company answered");
        Assert.IsGreaterThanOrEqualTo(2, queued.Attempts);
    }

    [TestMethod]
    public async Task A_voided_bill_stops_the_company_carrying_its_delivery()
    {
        var (company, host, secret) = await ConnectedCompanyAsync();
        var orderId = await ConfirmedDeliveryAsync();
        await GiveAsync(orderId, company);

        using (var scope = Suite.Ordering.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<MediatR.IMediator>().Send(
                new Ninja.Ordering.API.Application.Commands.MarkOrdersVoidedCommand([orderId], DateTime.UtcNow));

        var cancel = await CancelSentAsync(host);
        Assert.AreEqual("order_voided", (string?)cancel.Body!["reason"]);
        using var late = await StatusAsync(company, secret, new { jobId = $"job-{orderId}", orderId, sequence = 1, status = "delivered", collected = 140m });
        Assert.AreEqual(HttpStatusCode.Gone, late.StatusCode, "nothing to settle on a voided bill");
    }

    private sealed record TestJob(bool Taken, int? StatusCode, string? JobId, string? Detail, int ElapsedMs, bool Cancelled);
    private sealed record Call(DateTime ReceivedAt, string? Status, int? OrderId, string? JobId, int? Sequence, int Result, string? Detail);

    [TestMethod]
    public async Task A_test_job_shows_what_the_companys_system_answered_and_a_status_for_it_is_checked_without_an_order()
    {
        var (company, host, secret) = await ConnectedCompanyAsync();

        var test = await Owner.PostAsync<TestJob>($"{Orders}/couriers/{company}/test-job?{Version}");
        Assert.IsTrue(test.Taken, test.Detail);
        Assert.AreEqual(200, test.StatusCode);
        Assert.AreEqual("job-0", test.JobId);
        Assert.IsTrue(test.Cancelled, "its cancel is tried too");
        var sent = FakeCourierSystem.To(host).First(c => c.Path.EndsWith("/jobs", StringComparison.Ordinal));
        Assert.IsTrue((bool)sent.Body!["test"]!, "marked test: the company sends nobody");
        Assert.AreEqual(0m, (decimal)sent.Body["cashToCollect"]!);

        // The company tries its signing on the test job: answered, and no order moves
        using (var tried = await StatusAsync(company, secret, new { jobId = "job-0", orderId = 0, sequence = 1, status = "assigned", courierName = "Karim" }))
            Assert.AreEqual(HttpStatusCode.OK, tried.StatusCode, await tried.Content.ReadAsStringAsync());
        using (var forged = await StatusAsync(company, "whsec_wrong", new { jobId = "job-0", orderId = 0, sequence = 2, status = "picked_up" }))
            Assert.AreEqual(HttpStatusCode.Unauthorized, forged.StatusCode);

        // Both kept, newest first, with how each was answered
        var calls = await Owner.GetAsync<List<Call>>($"{Orders}/couriers/{company}/calls?{Version}");
        Assert.AreEqual(2, calls.Count);
        Assert.AreEqual(401, calls[0].Result);
        Assert.AreEqual(200, calls[1].Result);
        Assert.AreEqual("assigned", calls[1].Status);
        StringAssert.Contains(calls[1].Detail, "Test job");

        var (cashier, _) = await Till.RefusedAsync(HttpMethod.Get, $"{Orders}/couriers/{company}/calls?{Version}");
        Assert.AreEqual(HttpStatusCode.Forbidden, cashier);
    }

    [TestMethod]
    public async Task A_test_job_the_company_does_not_take_says_what_it_answered()
    {
        var (company, host, _) = await ConnectedCompanyAsync();
        FakeCourierSystem.Refusing[host] = true;
        try
        {
            var test = await Owner.PostAsync<TestJob>($"{Orders}/couriers/{company}/test-job?{Version}");
            Assert.IsFalse(test.Taken);
            Assert.AreEqual(503, test.StatusCode);
            Assert.AreEqual("busy", test.Detail);
        }
        finally
        {
            FakeCourierSystem.Refusing.TryRemove(host, out _);
        }
    }

    [TestMethod]
    public async Task Only_the_owner_connects_a_company_and_its_key_never_comes_back()
    {
        var (company, _, _) = await ConnectedCompanyAsync();

        var (cashier, _) = await Till.RefusedAsync(HttpMethod.Put, $"{Orders}/couriers/{company}/connection?{Version}", new { apiBaseUrl = "https://evil.test" });
        Assert.AreEqual(HttpStatusCode.Forbidden, cashier);

        using var shown = await Owner.RawAsync(HttpMethod.Get, $"{Orders}/couriers/{company}/connection?{Version}");
        var text = await shown.Content.ReadAsStringAsync();
        Assert.AreEqual(HttpStatusCode.OK, shown.StatusCode);
        Assert.DoesNotContain("ck_live_123", text);
        Assert.DoesNotContain("whsec_", text);

        var (plain, _) = await Owner.RefusedAsync(HttpMethod.Put, $"{Orders}/couriers/{company}/connection?{Version}", new { apiBaseUrl = "http://courier.example.com/ninja" });
        Assert.AreEqual(HttpStatusCode.BadRequest, plain);

        var listed = await Till.GetAsync<List<Provider>>($"{Orders}/couriers?{Version}");
        Assert.IsTrue(listed.Single(p => p.Id == company).IsConnected, "the till knows not to ask who was sent");

        var off = await Owner.PutAsync<Connection>($"{Orders}/couriers/{company}/connection?{Version}", new { apiBaseUrl = "" });
        Assert.IsFalse(off.Connected);
        Assert.IsFalse(off.HasApiKey);
        Assert.IsFalse(off.HasWebhookSecret);
    }
}
