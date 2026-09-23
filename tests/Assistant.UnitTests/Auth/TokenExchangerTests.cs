using System.Net;
using System.Text;
using System.Text.Json;
using Ninja.Assistant.API.Auth;
using Ninja.Assistant.UnitTests.Support;

namespace Ninja.Assistant.UnitTests.Auth;

[TestClass]
public sealed class TokenExchangerTests
{
    /// <summary>A JWT whose payload says exp = 2026-09-22T13:00:00Z (the bench clock is 12:00Z).</summary>
    private static string JwtExpiringAt(DateTimeOffset exp)
    {
        static string B64(string s) => Convert.ToBase64String(Encoding.UTF8.GetBytes(s)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        return $"{B64("{\"alg\":\"RS256\"}")}.{B64($"{{\"exp\":{exp.ToUnixTimeSeconds()}}}")}.sig";
    }

    [TestMethod]
    public async Task Posts_the_rfc_8693_form_to_the_realm_and_uses_the_answer()
    {
        var bench = new Bench(exchange: true);
        bench.Handler.OnJson("POST", "keycloak/realms/chillax/protocol/openid-connect/token", _ => new { access_token = "downstream", expires_in = 300 });

        var r = await bench.Tokens.GetDownstreamTokenAsync(CancellationToken.None);

        Assert.IsTrue(r.IsOk, r.Error);
        Assert.AreEqual("downstream", r.Token);
        var seen = bench.Handler.Requests.Single();
        var form = seen.Body!.Split('&').Select(kv => kv.Split('=')).ToDictionary(kv => Uri.UnescapeDataString(kv[0]), kv => Uri.UnescapeDataString(kv[1]));
        Assert.AreEqual("urn:ietf:params:oauth:grant-type:token-exchange", form["grant_type"]);
        Assert.AreEqual("assistant-api", form["client_id"]);
        Assert.AreEqual("s3cret", form["client_secret"]);
        Assert.AreEqual(Bench.InboundToken, form["subject_token"]);
        Assert.AreEqual("urn:ietf:params:oauth:token-type:access_token", form["subject_token_type"]);
        Assert.AreEqual("urn:ietf:params:oauth:token-type:access_token", form["requested_token_type"]);
        Assert.IsFalse(form.ContainsKey("audience"));
    }

    [TestMethod]
    public async Task The_exchanged_token_is_cached_per_inbound_token_until_a_minute_before_it_expires()
    {
        var bench = new Bench(exchange: true);
        var exchanges = 0;
        bench.Handler.OnJson("POST", "keycloak/realms/chillax/protocol/openid-connect/token", _ => new { access_token = $"t{++exchanges}", expires_in = 300 });

        Assert.AreEqual("t1", (await bench.Tokens.GetDownstreamTokenAsync(CancellationToken.None)).Token);
        Assert.AreEqual("t1", (await bench.Tokens.GetDownstreamTokenAsync(CancellationToken.None)).Token);
        Assert.AreEqual(1, exchanges);

        bench.Clock.Advance(TimeSpan.FromSeconds(250));
        Assert.AreEqual("t2", (await bench.Tokens.GetDownstreamTokenAsync(CancellationToken.None)).Token);
        Assert.AreEqual(2, exchanges);
    }

    [TestMethod]
    public async Task The_cache_never_outlives_the_inbound_token()
    {
        var bench = new Bench(exchange: true);
        bench.Accessor.HttpContext!.Request.Headers.Authorization = $"Bearer {JwtExpiringAt(bench.Clock.GetUtcNow().AddSeconds(90))}";
        var exchanges = 0;
        bench.Handler.OnJson("POST", "keycloak/realms/chillax/protocol/openid-connect/token", _ => new { access_token = $"t{++exchanges}", expires_in = 3600 });

        await bench.Tokens.GetDownstreamTokenAsync(CancellationToken.None);
        bench.Clock.Advance(TimeSpan.FromSeconds(45));
        await bench.Tokens.GetDownstreamTokenAsync(CancellationToken.None);

        Assert.AreEqual(2, exchanges, "90s left minus the 60s margin leaves 30s of cache");
    }

    [TestMethod]
    public async Task A_refusal_asks_the_person_to_reconnect_and_a_missing_header_says_so()
    {
        var bench = new Bench(exchange: true);
        bench.Handler.On("POST", "keycloak/", _ => FakeHandler.Text("{\"error\":\"invalid_token\"}", HttpStatusCode.BadRequest));
        var refused = await bench.Tokens.GetDownstreamTokenAsync(CancellationToken.None);
        Assert.IsFalse(refused.IsOk);
        StringAssert.Contains(refused.Error, "Reconnect the Ninja connector");

        bench.Accessor.HttpContext!.Request.Headers.Authorization = "";
        var missing = await bench.Tokens.GetDownstreamTokenAsync(CancellationToken.None);
        Assert.IsFalse(missing.IsOk);
        StringAssert.Contains(missing.Error, "no sign-in token");
    }

    [TestMethod]
    public async Task With_exchange_off_the_inbound_token_is_used_as_is()
    {
        var bench = new Bench(exchange: false);
        var r = await bench.Tokens.GetDownstreamTokenAsync(CancellationToken.None);
        Assert.AreEqual(Bench.InboundToken, r.Token);
        Assert.AreEqual(0, bench.Handler.Requests.Count);
    }

    [TestMethod]
    public void The_expiry_is_read_from_the_payload_without_validating()
    {
        var exp = new DateTimeOffset(2026, 9, 22, 13, 0, 0, TimeSpan.Zero);
        Assert.AreEqual(exp, TokenExchanger.JwtExpiry(JwtExpiringAt(exp)));
        Assert.IsNull(TokenExchanger.JwtExpiry("not-a-jwt"));
        Assert.IsNull(TokenExchanger.JwtExpiry("a.b.c"));
    }
}
