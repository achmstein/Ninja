using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Ninja.ServiceDefaults;
using Ninja.Tenant.API.Apis;
using Ninja.Tenant.API.Services;

namespace Ninja.Tenant.UnitTests;

/// <summary>Address search through Google Places: what is asked of Google, what is kept, and what never leaves the server.</summary>
[TestClass]
public sealed class PlacesClientTests
{
    private const string Autocomplete = """
        {"suggestions":[{"placePrediction":{"placeId":"ChIJ_abc123456","structuredFormat":{"mainText":{"text":"Street 9"},"secondaryText":{"text":"Maadi, Cairo"}}}}]}
        """;

    private const string Details = """
        {"id":"ChIJ_abc123456","formattedAddress":"Street 9, Maadi, Cairo","location":{"latitude":29.96,"longitude":31.25}}
        """;

    [TestMethod]
    public async Task Suggestions_are_asked_for_in_the_country_near_the_branch_with_the_session()
    {
        var google = new StubGoogle(Autocomplete);
        var places = Client(google);

        var suggestions = await places.AutocompleteAsync("  Street   9 ", "6f1c2b0e-8d6a-4c55-9a0e-3b1f2c4d5e6f", new GeoPoint(29.96, 31.25), "ar-EG", default);

        Assert.AreEqual(1, suggestions.Count);
        Assert.AreEqual(new PlaceSuggestion("ChIJ_abc123456", "Street 9", "Maadi, Cairo"), suggestions[0]);
        var request = google.Requests.Single();
        Assert.AreEqual(HttpMethod.Post, request.Method);
        Assert.AreEqual("/v1/places:autocomplete", request.Path);
        Assert.AreEqual("server-key", request.Key);
        var body = JsonNode.Parse(request.Body!)!;
        Assert.AreEqual("street 9", body["input"]!.GetValue<string>(), "trimmed and single-spaced");
        Assert.AreEqual("eg", body["includedRegionCodes"]![0]!.GetValue<string>());
        Assert.AreEqual("ar", body["languageCode"]!.GetValue<string>());
        Assert.AreEqual("6f1c2b0e-8d6a-4c55-9a0e-3b1f2c4d5e6f", body["sessionToken"]!.GetValue<string>());
        Assert.AreEqual(29.96, body["locationBias"]!["circle"]!["center"]!["latitude"]!.GetValue<double>());
    }

    [TestMethod]
    public async Task The_same_street_typed_again_is_not_asked_of_google_again()
    {
        var google = new StubGoogle(Autocomplete);
        var cache = Cache();
        var first = Client(google, cache);
        await first.AutocompleteAsync("street 9", "a", new GeoPoint(29.961, 31.251), "en", default);

        // Another customer, another session, a few metres off and typed in capitals: the cached answer
        var again = await Client(google, cache).AutocompleteAsync("STREET 9", "b", new GeoPoint(29.962, 31.252), "en", default);

        Assert.AreEqual(1, again.Count);
        Assert.AreEqual(1, google.Requests.Count);
    }

    [TestMethod]
    public async Task A_picked_place_asks_only_for_the_cheapest_fields_and_closes_the_session()
    {
        var google = new StubGoogle(Details);
        var cache = Cache();
        var places = Client(google, cache);

        var place = await places.DetailsAsync("ChIJ_abc123456", "6f1c2b0e-8d6a-4c55-9a0e-3b1f2c4d5e6f", "en", default);

        Assert.AreEqual(new PlaceLocation(29.96, 31.25, "Street 9, Maadi, Cairo"), place);
        var request = google.Requests.Single();
        Assert.AreEqual(HttpMethod.Get, request.Method);
        Assert.AreEqual("/v1/places/ChIJ_abc123456", request.Path);
        Assert.AreEqual("id,location,formattedAddress", request.FieldMask);
        StringAssert.Contains(request.Query, "sessionToken=6f1c2b0e-8d6a-4c55-9a0e-3b1f2c4d5e6f");
        StringAssert.Contains(request.Query, "regionCode=eg");

        await Client(google, cache).DetailsAsync("ChIJ_abc123456", "other", "en", default);
        Assert.AreEqual(1, google.Requests.Count, "the second pick of the same place is the cache's");
    }

    [TestMethod]
    public async Task Short_input_no_key_or_a_failing_google_answer_nothing()
    {
        var google = new StubGoogle(Autocomplete);
        Assert.AreEqual(0, (await Client(google).AutocompleteAsync("st", null, null, "en", default)).Count, "two letters match half the country");
        Assert.AreEqual(0, (await Client(google, key: null).AutocompleteAsync("street 9", null, null, "en", default)).Count, "no key, no search");
        Assert.AreEqual(0, google.Requests.Count);

        var refusing = new StubGoogle("{}", HttpStatusCode.TooManyRequests);
        Assert.AreEqual(0, (await Client(refusing).AutocompleteAsync("street 9", null, null, "en", default)).Count);
        Assert.IsNull(await Client(refusing).DetailsAsync("ChIJ_abc123456", null, "en", default));
    }

    [TestMethod]
    public async Task Over_the_businesss_quota_google_is_not_called()
    {
        var google = new StubGoogle(Autocomplete);
        var options = Options.Create(new MapsOptions { ServerKey = "server-key", PerMinute = 1 });
        using var quota = new PlacesQuota(options);
        await Client(google, options: options, quota: quota).AutocompleteAsync("street 9", null, null, "en", default);
        var over = await Client(google, options: options, quota: quota).AutocompleteAsync("street 10", null, null, "en", default);

        Assert.AreEqual(0, over.Count);
        Assert.AreEqual(1, google.Requests.Count);
    }

    [TestMethod]
    public void A_session_token_google_would_refuse_is_left_out()
    {
        Assert.AreEqual("6f1c2b0e-8d6a-4c55-9a0e-3b1f2c4d5e6f", PlacesClient.SessionToken("6f1c2b0e-8d6a-4c55-9a0e-3b1f2c4d5e6f"));
        Assert.IsNull(PlacesClient.SessionToken("a b"));
        Assert.IsNull(PlacesClient.SessionToken(new string('a', 37)));
        Assert.IsNull(PlacesClient.SessionToken(null));
    }

    [TestMethod]
    public void The_apps_are_told_whether_to_search_and_the_browser_key_never_the_server_key()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Maps:ServerKey"] = "server-key",
            ["Maps:BrowserKey"] = "browser-key",
            ["Maps:WebDomains"] = "ninjapp.net, menu.blue.com",
        }).Build();

        var maps = TenantMaps.Of(configuration);

        Assert.IsTrue(maps.Search);
        Assert.AreEqual("browser-key", maps.WebKey);
        CollectionAssert.AreEqual(new[] { "ninjapp.net", "menu.blue.com" }, maps.WebDomains.ToArray());
        Assert.IsFalse(System.Text.Json.JsonSerializer.Serialize(maps).Contains("server-key"));

        var off = TenantMaps.Of(new ConfigurationBuilder().Build());
        Assert.IsFalse(off.Search);
        Assert.IsNull(off.WebKey, "no key, the free map");
    }

    private static MemoryDistributedCache Cache() => new(Options.Create(new MemoryDistributedCacheOptions()));

    private static PlacesClient Client(
        StubGoogle google,
        IDistributedCache? cache = null,
        string? key = "server-key",
        IOptions<MapsOptions>? options = null,
        PlacesQuota? quota = null)
    {
        options ??= Options.Create(new MapsOptions { ServerKey = key });
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Tenant:Country"] = "EG" }).Build();
        var http = new HttpClient(google) { BaseAddress = new Uri(PlacesClient.BaseUrl) };
        var client = new PlacesClient(http, cache ?? Cache(), quota ?? new PlacesQuota(options), options, configuration, NullLogger<PlacesClient>.Instance);
        return client;
    }

    private sealed record Seen(HttpMethod Method, string Path, string Query, string? Key, string? FieldMask, string? Body);

    /// <summary>Google, as far as these tests need it: one canned answer, every request kept.</summary>
    private sealed class StubGoogle(string answer, HttpStatusCode status = HttpStatusCode.OK) : HttpMessageHandler
    {
        public List<Seen> Requests { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add(new(
                request.Method,
                request.RequestUri!.AbsolutePath,
                request.RequestUri.Query,
                request.Headers.TryGetValues("X-Goog-Api-Key", out var key) ? key.Single() : null,
                request.Headers.TryGetValues("X-Goog-FieldMask", out var mask) ? mask.Single() : null,
                request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken)));
            return new HttpResponseMessage(status) { Content = new StringContent(answer, Encoding.UTF8, "application/json") };
        }
    }
}
