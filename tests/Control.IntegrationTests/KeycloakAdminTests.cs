using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.IntegrationTests;

/// <summary>Keycloak's admin API through the adapter: a realm from the template, the owner with a temporary password, the control service account's token, and an impersonation that hands back cookies.</summary>
[TestClass]
public sealed class KeycloakAdminTests
{
    private static KeycloakRestAdmin Admin() => new(new PlainHttpClientFactory(), Containers.Options);

    private static Tenant Blue() => new()
    {
        Slug = "blue",
        NameEn = "Blue Bottle",
        NameAr = "بلو",
        Country = "EG",
        OwnerEmail = "owner@blue.test",
        IdentitySecret = TenantNaming.NewSecret(),
        ControlSecret = TenantNaming.NewSecret(),
    };

    [TestMethod]
    public async Task A_realm_from_the_template_takes_an_owner_hands_out_a_control_token_and_impersonates()
    {
        var admin = Admin();
        var tenant = Blue();
        var platform = Containers.Platform;
        var hosts = TenantHosts.For(tenant, platform);

        Assert.IsFalse(await admin.RealmExistsAsync("blue", CancellationToken.None));
        await admin.CreateRealmAsync(Templates.TenantRealm(tenant, hosts, platform), CancellationToken.None);
        Assert.IsTrue(await admin.RealmExistsAsync("blue", CancellationToken.None));

        // The owner, with the roles a stamp gives and a password to change on first sign-in
        var password = TenantNaming.NewPassword();
        var id = await admin.EnsureUserAsync("blue", tenant.OwnerEmail, tenant.NameEn, password, ["Owner", "Admin", "Customer"], CancellationToken.None);
        Assert.AreEqual(id, await admin.FindUserIdAsync("blue", tenant.OwnerEmail, CancellationToken.None));
        Assert.AreEqual(id, await admin.EnsureUserAsync("blue", tenant.OwnerEmail, tenant.NameEn, "another", ["Owner"], CancellationToken.None), "an owner that is there is left alone");
        Assert.IsTrue(await admin.HasRequiredActionAsync("blue", tenant.OwnerEmail, "UPDATE_PASSWORD", CancellationToken.None));
        Assert.IsFalse(await admin.HasRequiredActionAsync("blue", "nobody@blue.test", "UPDATE_PASSWORD", CancellationToken.None));
        Assert.IsNull(await admin.FindUserIdAsync("blue", "nobody@blue.test", CancellationToken.None));

        // The control service account: what the platform uses to seed the brand and push entitlements
        var tokens = new KeycloakStackTokenProvider(new PlainHttpClientFactory(), Containers.Options);
        var token = await tokens.GetAsync(tenant, CancellationToken.None);
        Assert.IsFalse(string.IsNullOrEmpty(token));
        var payload = JsonNode.Parse(Convert.FromBase64String(Pad(token.Split('.')[1])))!.AsObject();
        Assert.AreEqual("ninja-control", payload["azp"]?.GetValue<string>() ?? payload["client_id"]?.GetValue<string>());

        // SMTP onto the realm, as the mail endpoint does for realms stamped before mail was set up
        await admin.SetRealmSmtpAsync("blue", Templates.SmtpServerJson(new MailOptions { Host = "smtp.test", From = "no-reply@ninja.test" }), CancellationToken.None);

        // Sign in as the owner: Keycloak mints a session for the public host and hands back its cookies
        var cookies = await admin.ImpersonateAsync("blue", id, "auth.ninja.test", CancellationToken.None);
        Assert.IsNotEmpty(cookies);
        Assert.IsTrue(cookies.Any(c => c.StartsWith("KEYCLOAK_IDENTITY", StringComparison.Ordinal)), string.Join(" | ", cookies));

        // Keycloak's account pages, which the realm template's own scopes leave without a user or roles until they are ensured
        await admin.EnsureAccountConsoleAsync("blue", CancellationToken.None);
        var http = await new KeycloakAdminToken(new PlainHttpClientFactory(), Containers.Options).ClientAsync(CancellationToken.None);
        var console = (await http.GetFromJsonAsync<JsonArray>($"{platform.KeycloakInternalUrl}/admin/realms/blue/clients?clientId=account-console"))![0]!["id"]!.GetValue<string>();
        var claims = (await http.GetFromJsonAsync<JsonObject>($"{platform.KeycloakInternalUrl}/admin/realms/blue/clients/{console}/evaluate-scopes/generate-example-access-token?userId={id}&scope=openid"))!;
        Assert.AreEqual(id, claims["sub"]?.GetValue<string>(), claims.ToJsonString());
        CollectionAssert.Contains(claims["resource_access"]?["account"]?["roles"]?.AsArray().Select(r => r!.GetValue<string>()).ToList() ?? [], "manage-account", claims.ToJsonString());

        await admin.DeleteRealmAsync("blue", CancellationToken.None);
        await admin.DeleteRealmAsync("blue", CancellationToken.None);
        Assert.IsFalse(await admin.RealmExistsAsync("blue", CancellationToken.None));
    }

    private static string Pad(string base64Url)
    {
        var s = base64Url.Replace('-', '+').Replace('_', '/');
        return s.PadRight(s.Length + (4 - s.Length % 4) % 4, '=');
    }
}
