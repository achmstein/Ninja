using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Apis;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

/// <summary>
/// The Google Maps tab: its keys encrypted at rest and shown by four characters,
/// a save that keeps what it was not given, the businesses a change re-stamps,
/// the domains the tenant page asks for, and the test search's two answers.
/// Over the in-memory provider through the same scopes the workers use.
/// </summary>
[TestClass]
public sealed class MapsSettingsTests
{
    private const string ServerKey = "AIzaSyServer-key-0000000000000000000001";
    private const string BrowserKey = "AIzaSyBrowser-key-000000000000000000002";

    private static readonly PlatformOptions Platform = new() { Domain = "ninja.app" };

    private ServiceProvider _services = null!;
    private ProvisioningQueue _queue = null!;
    private CollectingAudit _audit = null!;

    private sealed class CollectingAudit : IAuditWriter
    {
        public List<(string Action, string Details)> Entries { get; } = [];
        public Task WriteAsync(string action, string? slug, object? details, CancellationToken ct, string? source = null)
        {
            Entries.Add((action, JsonSerializer.Serialize(details)));
            return Task.CompletedTask;
        }
    }

    [TestInitialize]
    public async Task Setup()
    {
        _audit = new CollectingAudit();
        var name = Guid.NewGuid().ToString();
        _services = new ServiceCollection()
            .AddLogging()
            .AddHttpContextAccessor()
            .AddDbContext<ControlContext>(o => o.UseInMemoryDatabase(name))
            .AddSingleton<IAuditWriter>(_audit)
            .AddSingleton<ProvisioningQueue>()
            .BuildServiceProvider();
        _queue = _services.GetRequiredService<ProvisioningQueue>();

        using var context = Context();
        context.Tenants.AddRange(
            new Tenant { Slug = "blue", Status = TenantStatus.Running, OwnerEmail = "o@blue.test", GoogleMaps = true },
            new Tenant { Slug = "cove", Status = TenantStatus.Stopped, OwnerEmail = "o@cove.test", GoogleMaps = true, CustomerDomain = "menu.cove.eg" },
            new Tenant { Slug = "red", Status = TenantStatus.Running, OwnerEmail = "o@red.test" },
            new Tenant { Slug = "gone", Status = TenantStatus.Destroyed, OwnerEmail = "o@gone.test", GoogleMaps = true });
        await context.SaveChangesAsync();
    }

    [TestCleanup]
    public void Cleanup() => _services.Dispose();

    private ControlContext Context() => _services.CreateScope().ServiceProvider.GetRequiredService<ControlContext>();

    private async Task<SaveMapsSettingsResult> SaveAsync(SaveMapsSettingsRequest request)
    {
        using var context = Context();
        var result = await ControlApi.SaveMaps(request, context, _queue, _audit, Options.Create(Platform), CancellationToken.None);
        return result.Result is Ok<SaveMapsSettingsResult> ok ? ok.Value! : throw new AssertFailedException($"refused: {(result.Result as BadRequest<ProblemDetails>)?.Value?.Detail}");
    }

    private async Task<MapsSettingsDto> GetAsync()
    {
        using var context = Context();
        return (await ControlApi.GetMaps(context, CancellationToken.None)).Value!;
    }

    [TestMethod]
    public async Task The_keys_are_encrypted_at_rest_and_read_back_as_typed()
    {
        var protector = SecretProtector.FromBase64(Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)));
        var builder = new DbContextOptionsBuilder<ControlContext>().UseInMemoryDatabase(Guid.NewGuid().ToString());
        builder.UseSecretProtector(protector);
        var options = builder.Options;
        using (var context = new ControlContext(options))
        {
            context.MapsSettings.Add(new MapsSettings { ServerKey = ServerKey, BrowserKey = BrowserKey, AndroidKey = "android", IosKey = "ios", UpdatedAt = DateTime.UtcNow });
            await context.SaveChangesAsync();

            foreach (var property in new[] { nameof(MapsSettings.ServerKey), nameof(MapsSettings.BrowserKey), nameof(MapsSettings.AndroidKey), nameof(MapsSettings.IosKey) })
            {
                var converter = context.Model.FindEntityType(typeof(MapsSettings))!.FindProperty(property)!.GetValueConverter();
                Assert.IsNotNull(converter, $"{property} goes through the platform's key");
                var stored = (string)converter.ConvertToProvider(ServerKey)!;
                Assert.IsTrue(SecretProtector.IsProtected(stored), property);
                Assert.DoesNotContain(ServerKey, stored);
                Assert.IsLessThanOrEqualTo(512, stored.Length, "the column is 512 wide");
            }
        }

        using (var context = new ControlContext(options))
        {
            var maps = await MapsStore.LoadAsync(context, CancellationToken.None);
            Assert.AreEqual(ServerKey, maps.ServerKey);
            Assert.AreEqual(BrowserKey, maps.BrowserKey);
            Assert.AreEqual("android", maps.AndroidKey);
            Assert.AreEqual("ios", maps.IosKey);
        }
    }

    [TestMethod]
    public async Task Nothing_saved_reads_as_no_keys_and_a_saved_key_shows_only_its_last_four()
    {
        var empty = await GetAsync();
        Assert.IsFalse(empty.ServerKey.Set);
        Assert.AreEqual("", empty.ServerKey.Hint);
        Assert.IsNull(empty.UpdatedAt);
        Assert.AreEqual(2, empty.BusinessesOn, "blue and cove; the destroyed one is not counted");

        await SaveAsync(new(ServerKey: ServerKey, BrowserKey: $"  {BrowserKey}  "));
        var saved = await GetAsync();
        Assert.IsTrue(saved.ServerKey.Set);
        Assert.AreEqual("0001", saved.ServerKey.Hint);
        Assert.AreEqual("0002", saved.BrowserKey.Hint, "trimmed as it was saved");
        Assert.IsFalse(saved.AndroidKey.Set);
        Assert.IsNotNull(saved.UpdatedAt);
        var json = JsonSerializer.Serialize(saved);
        Assert.DoesNotContain(ServerKey, json);
        Assert.DoesNotContain(BrowserKey, json);
    }

    [TestMethod]
    public async Task A_save_without_a_key_keeps_the_saved_one_and_a_clear_takes_it_off()
    {
        await SaveAsync(new(ServerKey: ServerKey, AndroidKey: "android-key"));
        await SaveAsync(new(ServerKey: "", WebTiles: true));

        using (var context = Context())
        {
            var maps = await MapsStore.LoadAsync(context, CancellationToken.None);
            Assert.AreEqual(ServerKey, maps.ServerKey, "left empty, the key stays");
            Assert.AreEqual("android-key", maps.AndroidKey);
            Assert.IsTrue(maps.WebTiles);
        }

        await SaveAsync(new(ClearAndroidKey: true));
        using (var context = Context())
        {
            var maps = await MapsStore.LoadAsync(context, CancellationToken.None);
            Assert.IsNull(maps.AndroidKey, "cleared");
            Assert.AreEqual(ServerKey, maps.ServerKey, "the others stay");
            Assert.IsTrue(maps.WebTiles, "web tiles left out stay as they were");
        }

        using (var context = Context())
        {
            var both = await ControlApi.SaveMaps(new(IosKey: "ios-key", ClearIosKey: true), context, _queue, _audit, Options.Create(Platform), CancellationToken.None);
            Assert.IsInstanceOfType<BadRequest<ProblemDetails>>(both.Result, "a new key and a clear at once");
            var spaced = await ControlApi.SaveMaps(new(IosKey: "two words"), context, _queue, _audit, Options.Create(Platform), CancellationToken.None);
            Assert.IsInstanceOfType<BadRequest<ProblemDetails>>(spaced.Result);
            var notHost = await ControlApi.SaveMaps(new(ReferrerDomains: ["menu.blue.com", "not a domain"]), context, _queue, _audit, Options.Create(Platform), CancellationToken.None);
            Assert.IsInstanceOfType<BadRequest<ProblemDetails>>(notHost.Result);
        }

        // Every change is on the audit, never a key's value
        Assert.HasCount(3, _audit.Entries);
        Assert.IsTrue(_audit.Entries.All(e => e.Action == "maps.settings.saved"));
        Assert.Contains("\"serverKey\":\"set\"", _audit.Entries[0].Details);
        Assert.Contains("\"androidKey\":\"cleared\"", _audit.Entries[2].Details);
        Assert.IsTrue(_audit.Entries.All(e => !e.Details.Contains(ServerKey) && !e.Details.Contains("android-key")));
    }

    [TestMethod]
    public async Task A_change_the_stacks_see_restamps_only_the_businesses_with_google_maps_on()
    {
        var server = await SaveAsync(new(ServerKey: ServerKey));
        CollectionAssert.AreEquivalent(new[] { "blue", "cove" }, server.Restamping.ToArray(), "Google Maps off, or destroyed: nothing to stamp");
        Assert.IsFalse(server.AppKeysChanged);
        using (var context = Context())
        {
            var jobs = await context.Jobs.AsNoTracking().ToListAsync();
            Assert.HasCount(2, jobs);
            Assert.IsTrue(jobs.All(j => j.Action == "maps" && j.Lane == JobLane.Stamp && j.Status == JobStatus.Queued));
        }

        var phones = await SaveAsync(new(AndroidKey: "android-key", IosKey: "ios-key"));
        Assert.IsEmpty(phones.Restamping, "the app keys reach the next build, not the stacks");
        Assert.IsTrue(phones.AppKeysChanged);

        var tilesWithoutKey = await SaveAsync(new(WebTiles: true));
        Assert.IsEmpty(tilesWithoutKey.Restamping, "web tiles without a browser key stamp nothing new");

        var browser = await SaveAsync(new(BrowserKey: BrowserKey));
        CollectionAssert.AreEquivalent(new[] { "blue", "cove" }, browser.Restamping.ToArray());

        var referrer = await SaveAsync(new(ReferrerDomains: ["https://menu.cove.eg/*"]));
        CollectionAssert.AreEqual(new[] { "cove" }, referrer.Restamping.ToArray(), "only the business whose own domain it names");
        CollectionAssert.AreEqual(new[] { "menu.cove.eg" }, referrer.Settings.ReferrerDomains.ToArray(), "kept as the host");

        var same = await SaveAsync(new(ServerKey: ServerKey, ReferrerDomains: ["MENU.cove.eg"]));
        Assert.IsEmpty(same.Restamping, "the same settings again change nothing");
    }

    [TestMethod]
    public void The_tenant_page_asks_for_an_own_domain_the_browser_key_does_not_list()
    {
        var cove = new Tenant { Slug = "cove", OwnerEmail = "o@cove.test", GoogleMaps = true, CustomerDomain = "menu.cove.eg" };
        var maps = new MapsSettings { ServerKey = ServerKey, BrowserKey = BrowserKey, WebTiles = true };

        var detail = TenantDetail.From(cove, [], [], Platform, maps: maps);
        Assert.AreEqual("menu.cove.eg", detail.MapsDomainToAdd);
        Assert.IsTrue(detail.GoogleMapsAvailable);

        maps.ReferrerDomains = "other.eg,*.cove.eg";
        Assert.IsNull(TenantDetail.From(cove, [], [], Platform, maps: maps).MapsDomainToAdd, "a *. entry covers every name under it");
        CollectionAssert.AreEqual(new[] { "ninja.app", "menu.cove.eg" }, maps.WebDomains(cove, Platform).ToArray());

        maps.ReferrerDomains = "cove.eg";
        Assert.AreEqual("menu.cove.eg", TenantDetail.From(cove, [], [], Platform, maps: maps).MapsDomainToAdd, "the bare domain is not its names");

        maps.WebTiles = false;
        Assert.IsNull(TenantDetail.From(cove, [], [], Platform, maps: maps).MapsDomainToAdd, "no web map, no referrer needed");

        var none = TenantDetail.From(cove, [], [], Platform);
        Assert.IsFalse(none.GoogleMapsAvailable, "nothing saved on the tab");
        Assert.IsNull(none.MapsDomainToAdd);
        Assert.IsTrue(TenantDetail.From(cove, [], [], Platform, maps: new MapsSettings { IosKey = "ios" }).GoogleMapsAvailable, "an app key alone is a key");
    }

    [TestMethod]
    public void A_referrer_is_kept_as_its_host()
    {
        Assert.AreEqual("menu.blue.com", MapsSettings.NormalizeReferrer("https://Menu.Blue.com/*"));
        Assert.AreEqual("*.blue.com", MapsSettings.NormalizeReferrer(" *.blue.com "));
        Assert.AreEqual("order.cove.eg", MapsSettings.NormalizeReferrer("order.cove.eg."));
        Assert.IsNull(MapsSettings.NormalizeReferrer("localhost"), "one label is no domain");
        Assert.IsNull(MapsSettings.NormalizeReferrer("blue com"));
        Assert.IsNull(MapsSettings.NormalizeReferrer("menu.*.com"));
        Assert.IsNull(MapsSettings.NormalizeReferrer(""));
    }

    private sealed class Google(HttpStatusCode status, string body) : HttpMessageHandler
    {
        public HttpRequestMessage? Asked { get; private set; }
        public string? AskedBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Asked = request;
            AskedBody = await request.Content!.ReadAsStringAsync(ct);
            return new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        }
    }

    [TestMethod]
    public async Task The_test_search_asks_google_once_with_the_server_key_and_says_what_came_back()
    {
        var google = new Google(HttpStatusCode.OK, """
            {"suggestions":[{"placePrediction":{"placeId":"p1","structuredFormat":{"mainText":{"text":"Tahrir Square"},"secondaryText":{"text":"Cairo, Egypt"}}}},{"placePrediction":{"placeId":"p2","structuredFormat":{"mainText":{"text":"Tahrir St"}}}}]}
            """);
        var result = await MapsSearchTest.RunAsync(new HttpClient(google), ServerKey, CancellationToken.None);

        Assert.IsTrue(result.Ok);
        Assert.AreEqual(2, result.Suggestions);
        Assert.AreEqual("Tahrir Square, Cairo, Egypt", result.First);
        Assert.IsNull(result.Error);
        Assert.AreEqual(MapsSearchTest.AutocompleteUrl, google.Asked!.RequestUri!.ToString());
        Assert.AreEqual(ServerKey, google.Asked.Headers.GetValues("X-Goog-Api-Key").Single());
        StringAssert.Contains(google.AskedBody, "\"input\":\"Tahrir\"");
        StringAssert.Contains(google.AskedBody, "\"regionCode\":\"eg\"");
    }

    [TestMethod]
    public async Task The_test_search_gives_googles_own_words_when_it_refuses()
    {
        var google = new Google(HttpStatusCode.Forbidden, """
            {"error":{"code":403,"message":"The provided API key has an IP address restriction.","status":"PERMISSION_DENIED"}}
            """);
        var refused = await MapsSearchTest.RunAsync(new HttpClient(google), ServerKey, CancellationToken.None);
        Assert.IsFalse(refused.Ok);
        Assert.AreEqual("403 PERMISSION_DENIED: The provided API key has an IP address restriction.", refused.Error);

        var unasked = new Google(HttpStatusCode.OK, "{}");
        var none = await MapsSearchTest.RunAsync(new HttpClient(unasked), null, CancellationToken.None);
        Assert.IsFalse(none.Ok);
        Assert.IsNull(unasked.Asked, "no key, no call");
    }
}
