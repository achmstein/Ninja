using Ninja.ServiceDefaults;
using Ninja.Tenant.API.Services;

namespace Ninja.Tenant.UnitTests;

/// <summary>Where a branch is, read from what an owner pastes.</summary>
[TestClass]
public sealed class MapLocationTests
{
    [TestMethod]
    public void Reads_plain_coordinates()
    {
        Assert.AreEqual(new GeoPoint(30.0444, 31.2357), MapLocation.Parse("30.0444, 31.2357"));
    }

    [TestMethod]
    public void Reads_a_place_pin_before_the_map_centre()
    {
        var link = "https://www.google.com/maps/place/Chillax/@30.05,31.20,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d29.9603!4d31.2591";

        Assert.AreEqual(new GeoPoint(29.9603, 31.2591), MapLocation.Parse(link));
    }

    [TestMethod]
    public void Reads_the_map_centre()
    {
        Assert.AreEqual(new GeoPoint(30.05, 31.2), MapLocation.Parse("https://www.google.com/maps/@30.05,31.20,15z"));
    }

    [TestMethod]
    public void Reads_a_query_point()
    {
        Assert.AreEqual(new GeoPoint(30.0444, 31.2357), MapLocation.Parse("https://maps.google.com/?q=30.0444,31.2357"));
        Assert.AreEqual(new GeoPoint(30.0444, 31.2357), MapLocation.Parse("https://www.google.com/maps/search/?api=1&query=30.0444%2C31.2357"));
    }

    [TestMethod]
    public void Refuses_what_names_no_point()
    {
        Assert.IsNull(MapLocation.Parse("Maadi, road 9"));
        Assert.IsNull(MapLocation.Parse("95.0, 31.0"), "no latitude beyond the poles");
        Assert.IsNull(MapLocation.Parse("0, 0"), "the empty point is a missing one");
        Assert.IsNull(MapLocation.Parse(""));
    }

    [TestMethod]
    public void Knows_a_short_link()
    {
        Assert.IsTrue(MapLocation.IsShortLink("https://maps.app.goo.gl/AbCdEf123"));
        Assert.IsTrue(MapLocation.IsShortLink("https://goo.gl/maps/AbCdEf"));
        Assert.IsFalse(MapLocation.IsShortLink("https://example.com/maps/x"));
        Assert.IsFalse(MapLocation.IsShortLink("http://maps.app.goo.gl/AbCdEf123"), "only over https");
    }

    [TestMethod]
    public void A_hop_goes_only_to_google_over_https()
    {
        foreach (var ok in new[] { "https://www.google.com/maps/x", "https://maps.google.com.eg/x", "https://consent.google.co.uk/x", "https://google.ae/maps", "https://maps.app.goo.gl/x" })
            Assert.IsTrue(MapLocation.IsGoogleHop(new Uri(ok)), ok);
        foreach (var bad in new[] { "http://www.google.com/maps", "https://google.evil.de/x", "https://evil.com/google.com", "https://169.254.169.254/latest", "https://www.google.com:8443/x", "https://googl.com/x", "https://google.example.com/x" })
            Assert.IsFalse(MapLocation.IsGoogleHop(new Uri(bad)), bad);
    }

    [TestMethod]
    public async Task A_short_link_is_followed_hop_by_hop_and_never_off_google()
    {
        var hops = new Hops(
            ("https://maps.app.goo.gl/AbC", "https://www.google.com/maps/place/x"),
            ("https://www.google.com/maps/place/x", "https://www.google.com/maps/place/Tahrir/@30.0444,31.2357,17z"));
        Assert.AreEqual(new GeoPoint(30.0444, 31.2357), await MapLocation.ResolveAsync("https://maps.app.goo.gl/AbC", new HttpClient(hops), default));

        var astray = new Hops(("https://maps.app.goo.gl/Bad", "http://10.0.0.5/admin"));
        Assert.IsNull(await MapLocation.ResolveAsync("https://maps.app.goo.gl/Bad", new HttpClient(astray), default));
        CollectionAssert.AreEqual(new[] { "https://maps.app.goo.gl/Bad" }, astray.Asked, "the internal address is never fetched");

        var loop = new Hops(("https://maps.app.goo.gl/Loop", "https://maps.app.goo.gl/Loop"));
        Assert.IsNull(await MapLocation.ResolveAsync("https://maps.app.goo.gl/Loop", new HttpClient(loop), default));
        Assert.HasCount(MapLocation.MaxHops, loop.Asked);
    }

    /// <summary>Answers each asked address with a redirect to the next, as a short link does.</summary>
    private sealed class Hops(params (string From, string To)[] redirects) : HttpMessageHandler
    {
        public List<string> Asked { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var url = request.RequestUri!.ToString();
            Asked.Add(url);
            var to = redirects.FirstOrDefault(r => r.From == url).To;
            var response = new HttpResponseMessage(to is null ? System.Net.HttpStatusCode.OK : System.Net.HttpStatusCode.Found);
            if (to is not null) response.Headers.Location = new Uri(to);
            return Task.FromResult(response);
        }
    }
}
