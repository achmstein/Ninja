using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Ninja.Control.API.Platform;

namespace Ninja.Control.IntegrationTests;

/// <summary>The Team tab's directory against a real platform realm: invited, listed, reset and shut out the way Keycloak keeps it.</summary>
[TestClass]
public sealed class OperatorDirectoryTests
{
    [TestMethod]
    public async Task An_operator_is_invited_listed_reset_and_disabled_in_the_platform_realm()
    {
        var token = new KeycloakAdminToken(new PlainHttpClientFactory(), Containers.Options);
        var realms = new KeycloakRestAdmin(token, new PlainHttpClientFactory(), Containers.Options);
        if (!await realms.RealmExistsAsync(KeycloakOperatorDirectory.Realm, CancellationToken.None))
            await realms.CreateRealmAsync(Templates.PlatformRealm(Containers.Platform, "First123$"), CancellationToken.None);
        var directory = new KeycloakOperatorDirectory(token);

        var seeded = (await directory.ListAsync(CancellationToken.None)).Single(o => o.Email.StartsWith("platform@", StringComparison.Ordinal));
        Assert.IsTrue(seeded.Enabled);

        var id = await directory.InviteAsync("mona@ninja.test", "Mona", "Adel", "Temp1234abcd", CancellationToken.None);
        Assert.IsNotNull(id);
        Assert.IsNull(await directory.InviteAsync("mona@ninja.test", null, null, "Temp1234abcd", CancellationToken.None), "an address is one operator");

        var mona = (await directory.FindAsync(id, CancellationToken.None))!;
        Assert.AreEqual("mona@ninja.test", mona.Email);
        Assert.IsTrue(mona.PendingSetup, "a new password and an authenticator on first sign-in");
        Assert.IsFalse(mona.HasAuthenticator);
        Assert.IsTrue((await directory.ListAsync(CancellationToken.None)).Any(o => o.Id == id));
        CollectionAssert.AreEquivalent(new[] { "UPDATE_PASSWORD", "CONFIGURE_TOTP" }, await RequiredActionsAsync(token, id));

        await directory.SetEnabledAsync(id, false, CancellationToken.None);
        Assert.IsFalse((await directory.FindAsync(id, CancellationToken.None))!.Enabled);
        await directory.SetEnabledAsync(id, true, CancellationToken.None);
        var back = (await directory.FindAsync(id, CancellationToken.None))!;
        Assert.IsTrue(back.Enabled);
        Assert.AreEqual("Mona", back.FirstName, "enabling touches nothing else");

        await directory.ResetPasswordAsync(id, "Other1234abcd", CancellationToken.None);
        await directory.ResetAuthenticatorAsync(id, CancellationToken.None);
        await directory.SignOutAsync(id, CancellationToken.None);
        CollectionAssert.IsSubsetOf(new[] { "UPDATE_PASSWORD", "CONFIGURE_TOTP" }, await RequiredActionsAsync(token, id));

        Assert.IsNull(await directory.FindAsync(Guid.NewGuid().ToString(), CancellationToken.None));
    }

    private static async Task<List<string>> RequiredActionsAsync(KeycloakAdminToken token, string id)
    {
        var client = await token.ClientAsync(CancellationToken.None);
        var user = await client.GetFromJsonAsync<JsonObject>($"{token.Base}/admin/realms/ninja/users/{id}");
        return user!["requiredActions"]!.AsArray().Select(a => a!.GetValue<string>()).ToList();
    }
}
