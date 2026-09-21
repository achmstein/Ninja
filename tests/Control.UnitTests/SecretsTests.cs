using System.Net;
using System.Security.Cryptography;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

/// <summary>Secrets at rest: what the column holds, what reads back, what a wrong key does; and what leaves the record when it has done its job.</summary>
[TestClass]
public sealed class SecretsTests
{
    private static string Key() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

    [TestMethod]
    public void A_secret_round_trips_and_the_column_never_holds_the_plaintext()
    {
        var protector = SecretProtector.FromBase64(Key());
        const string secret = "db-password-123456789012345678";

        var stored = protector.Protect(secret);

        Assert.IsTrue(SecretProtector.IsProtected(stored));
        Assert.DoesNotContain(secret, stored);
        Assert.IsLessThanOrEqualTo(128, stored.Length, "the column is 128 wide");
        Assert.AreEqual(secret, protector.Unprotect(stored));
        Assert.AreNotEqual(stored, protector.Protect(secret), "a fresh nonce every time");
    }

    [TestMethod]
    public void A_value_written_before_there_was_a_key_reads_as_itself()
    {
        var protector = SecretProtector.FromBase64(Key());
        Assert.AreEqual("plain-old-secret", protector.Unprotect("plain-old-secret"));
        Assert.IsFalse(SecretProtector.IsProtected("plain-old-secret"));
        // And without a key nothing changes on the way in or out
        Assert.AreEqual("x", SecretProtector.None.Protect("x"));
        Assert.AreEqual("x", SecretProtector.None.Unprotect("x"));
        Assert.IsFalse(SecretProtector.None.Enabled);
    }

    [TestMethod]
    public void The_wrong_key_or_a_tampered_value_fails_loudly()
    {
        var stored = SecretProtector.FromBase64(Key()).Protect("secret");
        Assert.ThrowsExactly<AuthenticationTagMismatchException>(() => SecretProtector.FromBase64(Key()).Unprotect(stored));
        var tampered = stored[..^4] + (stored[^4] == 'A' ? "BAAA" : "AAAA");
        Assert.ThrowsExactly<AuthenticationTagMismatchException>(() => SecretProtector.FromBase64(Key()).Unprotect(tampered));
        Assert.ThrowsExactly<CryptographicException>(() => SecretProtector.None.Unprotect(stored), "no key, but an encrypted value: never a silent garbage password");
    }

    [TestMethod]
    public void A_key_is_thirty_two_bytes_of_base64()
    {
        Assert.ThrowsExactly<ArgumentException>(() => SecretProtector.FromBase64("not base64!"));
        Assert.ThrowsExactly<ArgumentException>(() => SecretProtector.FromBase64(Convert.ToBase64String(new byte[16])));
        Assert.IsTrue(SecretProtector.FromBase64(Key()).Enabled);
    }

    [TestMethod]
    public void The_owners_first_password_leaves_the_record_once_changed_or_a_month_old()
    {
        var now = DateTimeOffset.UtcNow;
        var fresh = new Tenant { OwnerInitialPassword = "Temp1234abcd", ProvisionedAt = now.AddDays(-2) };
        Assert.IsFalse(OwnerPasswordSweepService.ShouldClear(fresh, stillRequired: true, now), "two days old, not yet changed: the owner may still need it");
        Assert.IsTrue(OwnerPasswordSweepService.ShouldClear(fresh, stillRequired: false, now), "changed: it has done its job");
        var old = new Tenant { OwnerInitialPassword = "Temp1234abcd", ProvisionedAt = now.AddDays(-31) };
        Assert.IsTrue(OwnerPasswordSweepService.ShouldClear(old, stillRequired: true, now), "a month is long enough to keep it around");
        Assert.IsFalse(OwnerPasswordSweepService.ShouldClear(new Tenant { ProvisionedAt = now.AddDays(-31) }, stillRequired: false, now), "nothing to clear");
    }

    [TestMethod]
    public void The_assistant_key_reaches_only_the_plans_that_include_it_and_every_demo()
    {
        var platform = new PlatformOptions { GeminiApiKey = "k" };
        Assert.IsTrue(platform.AssistantFor(new Tenant { Kind = TenantKind.Demo, Plan = TenantPlan.Free }));
        Assert.IsTrue(platform.AssistantFor(new Tenant { Kind = TenantKind.Customer, Plan = TenantPlan.Pro }));
        Assert.IsFalse(platform.AssistantFor(new Tenant { Kind = TenantKind.Customer, Plan = TenantPlan.Starter }));
        platform.AssistantPlans = [TenantPlan.Starter, TenantPlan.Pro];
        Assert.IsTrue(platform.AssistantFor(new Tenant { Kind = TenantKind.Customer, Plan = TenantPlan.Starter }));
        Assert.IsFalse(new PlatformOptions().AssistantFor(new Tenant { Kind = TenantKind.Demo }), "no key, no assistant");
    }

    /// <summary>Answers Keycloak's token endpoint and counts how often it was asked; everything else is 200 {}.</summary>
    private sealed class FakeKeycloak(int expiresIn) : HttpMessageHandler
    {
        public int TokenRequests { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            if (request.RequestUri!.AbsolutePath.EndsWith("/protocol/openid-connect/token", StringComparison.Ordinal))
            {
                TokenRequests++;
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent($$"""{"access_token":"t{{TokenRequests}}","expires_in":{{expiresIn}}}""", System.Text.Encoding.UTF8, "application/json") });
            }
            Assert.AreEqual("Bearer", request.Headers.Authorization?.Scheme);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}", System.Text.Encoding.UTF8, "application/json") });
        }
    }

    private sealed class Factory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
    }

    [TestMethod]
    public async Task The_keycloak_admin_token_is_fetched_once_and_kept_until_it_is_about_to_expire()
    {
        var keycloak = new FakeKeycloak(expiresIn: 300);
        var admin = new KeycloakRestAdmin(new Factory(keycloak), Options.Create(new PlatformOptions { KeycloakInternalUrl = "http://keycloak:8080" }));

        await admin.RealmExistsAsync("blue", CancellationToken.None);
        await admin.RealmExistsAsync("red", CancellationToken.None);
        await admin.SetRealmSmtpAsync("blue", "{}", CancellationToken.None);
        Assert.AreEqual(1, keycloak.TokenRequests, "one password grant for a stamp's dozen calls, not one each");

        // A token that is about to expire (within the margin) is not reused
        var shortLived = new FakeKeycloak(expiresIn: 10);
        var again = new KeycloakRestAdmin(new Factory(shortLived), Options.Create(new PlatformOptions { KeycloakInternalUrl = "http://keycloak:8080" }));
        await again.RealmExistsAsync("blue", CancellationToken.None);
        await again.RealmExistsAsync("blue", CancellationToken.None);
        Assert.AreEqual(2, shortLived.TokenRequests);
    }
}
