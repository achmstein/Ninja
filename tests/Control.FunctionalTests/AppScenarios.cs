using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Ninja.Control.API.Apis;
using Ninja.Control.API.Model;

namespace Ninja.Control.FunctionalTests;

/// <summary>
/// A business's own app kept on the control plane: the console sets its upload key and sees only
/// that it is set; the build reads the kit for its platform as the app-builder client, carries a
/// GitHub environment in without replacing anything, and can reach none of the console's endpoints.
/// </summary>
[TestClass]
public sealed class AppScenarios
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    [TestMethod]
    public async Task The_console_makes_the_upload_key_and_the_build_alone_reads_it_back()
    {
        var api = Api.AsPlatformAdmin();
        var slug = Api.Slug("kit");
        await api.CreateAsync(slug, TenantKind.Customer, TenantPlan.Starter);
        var console = api.As("PlatformAdmin");
        var build = api.As("AppBuilder");

        // The shared app: nothing to set, and an empty kit keeps the build on its environment's secrets
        using (var shared = await console.PostAsJsonAsync($"/api/control/tenants/{slug}/app/android-key/generate", new GenerateAndroidKeyRequest()))
            Assert.AreEqual(HttpStatusCode.BadRequest, shared.StatusCode, "no app id on the record yet");
        var empty = await build.GetFromJsonAsync<AppKit>($"/api/control/tenants/{slug}/app-kit?platform=android", Json);
        Assert.IsNull(empty!.Keystore);

        var appId = $"net.ninjapp.{slug.Replace('-', '_')}";
        await api.UpdateAsync(slug, new UpdateTenantRequest("Blue Café", null, null, null, null, null, null, null, null, "EG", "EGP", "Africa/Cairo", "ar") with { AppId = appId, AppleTeamId = "ABCDE12345" });

        using (var made = await console.PostAsJsonAsync($"/api/control/tenants/{slug}/app/android-key/generate", new GenerateAndroidKeyRequest()))
        {
            Assert.AreEqual(HttpStatusCode.OK, made.StatusCode, await made.Content.ReadAsStringAsync());
            var body = await made.Content.ReadAsStringAsync();
            var status = JsonSerializer.Deserialize<TenantAppStatus>(body, Json)!;
            Assert.IsTrue(status.AndroidKey.Set);
            Assert.AreEqual("pkcs12", status.AndroidKey.Format);
            Assert.IsNotNull(status.AndroidKey.Sha256);
            Assert.DoesNotContain("password", body, StringComparison.OrdinalIgnoreCase, "the console never gets a key's secrets back");
            CollectionAssert.Contains((await api.TenantAsync(slug)).AndroidCertFingerprints.ToList(), status.AndroidKey.Sha256, "the upload key's fingerprint is on the record for App Links");
        }
        using (var again = await console.PostAsJsonAsync($"/api/control/tenants/{slug}/app/android-key/generate", new GenerateAndroidKeyRequest()))
            Assert.AreEqual(HttpStatusCode.BadRequest, again.StatusCode, "replacing an upload key must be confirmed");

        var kit = await build.GetFromJsonAsync<AppKit>($"/api/control/tenants/{slug}/app-kit?platform=android", Json);
        Assert.IsNotNull(kit!.Keystore);
        Assert.IsNotNull(kit.StorePassword);
        Assert.IsTrue(kit.FingerprintsKnown);
        var ios = await build.GetFromJsonAsync<AppKit>($"/api/control/tenants/{slug}/app-kit?platform=ios", Json);
        Assert.IsNull(ios!.Keystore, "the iOS build is not handed the Android key");

        // A carry fills what is empty and leaves the key the console made
        using (var carry = await build.PostAsJsonAsync($"/api/control/tenants/{slug}/app-kit/carry", new CarryAppKitRequest(Keystore: "AAAA", KeyAlias: "upload", StorePassword: "x")))
        {
            var result = (await carry.Content.ReadFromJsonAsync<CarryAppKitResult>(Json))!;
            CollectionAssert.AreEqual(new[] { "keystore" }, result.Kept.ToArray());
            Assert.IsEmpty(result.Filled);
        }

        // The build's login reaches the kit and nothing of the console's
        using (var status = await build.GetAsync($"/api/control/tenants/{slug}/app"))
            Assert.AreEqual(HttpStatusCode.Forbidden, status.StatusCode);
        using (var generate = await build.PostAsJsonAsync($"/api/control/tenants/{slug}/app/android-key/generate", new GenerateAndroidKeyRequest(Confirm: true)))
            Assert.AreEqual(HttpStatusCode.Forbidden, generate.StatusCode);
        using (var nobody = await api.Anonymous().GetAsync($"/api/control/tenants/{slug}/app-kit?platform=android"))
            Assert.AreEqual(HttpStatusCode.Unauthorized, nobody.StatusCode);

        var audit = await api.AuditAsync(slug);
        Assert.IsTrue(audit.Any(a => a.Action == "tenant.app.kit.read"), "every read of the kit is audited");
        Assert.IsFalse(audit.Any(a => a.Details?.Contains(kit.StorePassword!) == true), "never with a value");
    }
}
