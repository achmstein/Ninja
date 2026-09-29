using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

[TestClass]
public sealed class TalabatTests
{
    // Delivery Hero's documented example: {"service":"middleware"} signed HS512 with "123"
    private const string DocumentedToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJzZXJ2aWNlIjoibWlkZGxld2FyZSJ9.VKb-yT2Zz2e4j7R5ssXzU0Mj5MrQ7yxP1H1YRPFmlVANhOYwadSk-5GepYUBz19KASD0QjwLTWtOKLR63Y_R9g";

    [TestMethod]
    public void The_middlewares_documented_token_passes_with_its_secret()
    {
        Assert.IsTrue(TalabatJwt.IsFromMiddleware("Bearer " + DocumentedToken, "123"));
    }

    [TestMethod]
    public void A_token_signed_with_another_secret_or_none_is_turned_away()
    {
        Assert.IsFalse(TalabatJwt.IsFromMiddleware("Bearer " + DocumentedToken, "456"));
        Assert.IsFalse(TalabatJwt.IsFromMiddleware(null, "123"));
        Assert.IsFalse(TalabatJwt.IsFromMiddleware("Bearer not.a.token", "123"));
        Assert.IsFalse(TalabatJwt.IsFromMiddleware(DocumentedToken, "123"), "without the Bearer scheme");
    }

    [TestMethod]
    public void A_properly_signed_token_for_another_service_is_turned_away()
    {
        Assert.IsFalse(TalabatJwt.IsFromMiddleware("Bearer " + Sign("""{"service":"someone-else"}""", "123"), "123"));
        Assert.IsTrue(TalabatJwt.IsFromMiddleware("Bearer " + Sign("""{"service":"middleware"}""", "123"), "123"));
    }

    [TestMethod]
    public void An_expired_token_is_turned_away()
    {
        var past = DateTimeOffset.UtcNow.AddHours(-1).ToUnixTimeSeconds();
        Assert.IsFalse(TalabatJwt.IsFromMiddleware("Bearer " + Sign($$"""{"service":"middleware","exp":{{past}}}""", "123"), "123"));
    }

    [TestMethod]
    public void A_remote_id_is_the_slug_and_the_branch_and_reads_back()
    {
        var remoteId = TalabatNaming.RemoteId("blue-cup", 3);

        Assert.AreEqual("blue-cup-3", remoteId);
        Assert.IsTrue(TalabatNaming.TryParseRemoteId(remoteId, out var slug, out var branch));
        Assert.AreEqual("blue-cup", slug);
        Assert.AreEqual(3, branch);
    }

    [TestMethod]
    public void A_remote_id_that_is_not_ours_does_not_read()
    {
        Assert.IsFalse(TalabatNaming.TryParseRemoteId("POS_RESTAURANT_0001", out _, out _));
        Assert.IsFalse(TalabatNaming.TryParseRemoteId("blue-0", out _, out _));
        Assert.IsFalse(TalabatNaming.TryParseRemoteId("-3", out _, out _));
        Assert.IsFalse(TalabatNaming.TryParseRemoteId(null, out _, out _));
    }

    [TestMethod]
    public void A_cafes_relay_key_opens_only_its_own_door()
    {
        var key = TalabatNaming.RelayKey("blue", "platform-key");

        Assert.IsTrue(TalabatNaming.RelayKeyMatches("blue", "platform-key", key));
        Assert.IsFalse(TalabatNaming.RelayKeyMatches("green", "platform-key", key));
        Assert.IsFalse(TalabatNaming.RelayKeyMatches("blue", "another-platform", key));
        Assert.IsFalse(TalabatNaming.RelayKeyMatches("blue", "platform-key", null));
    }

    [TestMethod]
    public void Ninjas_token_goes_only_to_the_middleware_it_is_registered_with()
    {
        var options = Options.Create(new PlatformOptions { Talabat = new TalabatOptions { MiddlewareUrl = "https://integration-middleware.me.restaurant-partners.com" } });
        var middleware = new TalabatMiddleware(null!, options, NullLogger<TalabatMiddleware>.Instance);

        Assert.IsTrue(middleware.IsMiddlewareUrl("https://integration-middleware.me.restaurant-partners.com/v2/order/status/abc"));
        Assert.IsFalse(middleware.IsMiddlewareUrl("https://evil.example/v2/order/status/abc"));
        Assert.IsFalse(middleware.IsMiddlewareUrl("http://integration-middleware.me.restaurant-partners.com/v2/order/status/abc"), "never in the clear");
        Assert.IsFalse(middleware.IsMiddlewareUrl("not a url"));
    }

    [TestMethod]
    public void The_talabat_store_is_picked_from_every_platform_the_branch_is_on()
    {
        const string body = """
        [
          { "availabilityState": "OPEN", "changeable": true, "platformKey": "FO_DE", "platformRestaurantId": "kg6y", "platformType": "FOODORA", "closingReasons": ["OTHER"] },
          { "availabilityState": "CLOSED", "changeable": true, "platformKey": "TB", "platformRestaurantId": "123456789", "platformType": "TALABAT", "closingReasons": ["TOO_BUSY_KITCHEN", "CLOSED"] }
        ]
        """;

        var store = TalabatStores.Pick(body)!;

        Assert.AreEqual("TB", store.PlatformKey);
        Assert.AreEqual("123456789", store.PlatformRestaurantId);
        Assert.AreEqual("CLOSED", store.State);
        Assert.AreEqual("CLOSED", store.CloseReason());
        Assert.IsNull(TalabatStores.Pick("[]"));
    }

    [TestMethod]
    public void A_store_that_does_not_take_closed_is_closed_for_its_first_reason()
    {
        var store = new TalabatStore("OPEN", true, "TB", "1", ["TOO_BUSY_KITCHEN"]);

        Assert.AreEqual("TOO_BUSY_KITCHEN", store.CloseReason());
        Assert.AreEqual("OTHER", new TalabatStore("OPEN", true, "TB", "1", []).CloseReason());
    }

    [TestMethod]
    public void Egypt_is_talabats_old_otlob_market_and_the_gulf_is_tb()
    {
        Assert.AreEqual("HF_EG", TalabatNaming.DefaultGlobalEntity("EG"));
        Assert.AreEqual("TB_AE", TalabatNaming.DefaultGlobalEntity("ae"));
    }

    private static string Sign(string payload, string secret)
    {
        static string B64(byte[] b) => Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var head = B64(Encoding.UTF8.GetBytes("""{"typ":"JWT","alg":"HS512"}"""));
        var body = B64(Encoding.UTF8.GetBytes(payload));
        return $"{head}.{body}.{B64(HMACSHA512.HashData(Encoding.UTF8.GetBytes(secret), Encoding.ASCII.GetBytes($"{head}.{body}")))}";
    }
}
