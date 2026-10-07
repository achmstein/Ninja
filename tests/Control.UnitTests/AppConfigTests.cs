using System.Text.Json.Nodes;
using Ninja.Control.API.Apis;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

/// <summary>
/// The customer app's build record comes from the control plane, so it says
/// what the realm really has: the shared Google app only when the platform
/// holds one, and the own app's Apple provider only when the business has an app.
/// </summary>
[TestClass]
public sealed class AppConfigTests
{
    private static JsonObject Read(Tenant tenant, PlatformOptions platform)
        => JsonNode.Parse(ControlApi.AppConfig(tenant, platform))!.AsObject();

    [TestMethod]
    public void A_business_on_the_shared_app_gets_its_hosts_and_realm()
    {
        var platform = new PlatformOptions { Domain = "ninjapp.net", KeycloakPublicUrl = "https://auth.ninjapp.net/" };
        var config = Read(new Tenant { Slug = "blue", OwnerEmail = "owner@blue.test" }, platform);

        Assert.AreEqual("https://api.blue.ninjapp.net", config["API_URL"]!.GetValue<string>());
        Assert.AreEqual("https://auth.ninjapp.net", config["AUTH_URL"]!.GetValue<string>());
        Assert.AreEqual("blue", config["REALM"]!.GetValue<string>());
        Assert.IsFalse(config.ContainsKey("GOOGLE_SERVER_CLIENT_ID"), "no Google app on the platform, no provider in the realm");
        Assert.IsFalse(config.ContainsKey("APPLE_ISSUER"), "the shared build keeps apple");
    }

    [TestMethod]
    public void A_business_with_its_own_app_exchanges_apple_through_its_provider()
    {
        var platform = new PlatformOptions { Domain = "ninjapp.net" };
        platform.Social.Google = new SocialProviderOptions { ClientId = "web.apps.googleusercontent.com", ClientSecret = "s" };
        var config = Read(new Tenant { Slug = "blue", OwnerEmail = "owner@blue.test", AppId = "net.ninjapp.blue", CustomerDomain = "menu.blue.test" }, platform);

        Assert.AreEqual("https://api.blue.ninjapp.net", config["API_URL"]!.GetValue<string>(), "the gateway stays on the platform with an own domain");
        Assert.AreEqual("web.apps.googleusercontent.com", config["GOOGLE_SERVER_CLIENT_ID"]!.GetValue<string>());
        Assert.AreEqual(TenantNaming.AppAppleAlias, config["APPLE_ISSUER"]!.GetValue<string>());
        Assert.AreEqual("net.ninjapp.blue", config["REDIRECT_SCHEME"]!.GetValue<string>(), "sign-ins come back to the app's own scheme");
        Assert.AreEqual("net.ninjapp.blue", config["APP_ID"]!.GetValue<string>());
        Assert.AreEqual("blue", config["APP_NAME"]!.GetValue<string>(), "no name on the record: the slug");
        Assert.AreEqual("menu.blue.test", config["CUSTOMER_HOST"]!.GetValue<string>(), "App Links on the business's own domain");
    }

    [TestMethod]
    public void The_app_link_files_name_the_businesss_own_app()
    {
        var fingerprint = string.Join(':', Enumerable.Repeat("AB", 32));
        var tenant = new Tenant { Slug = "blue", OwnerEmail = "owner@blue.test" };
        Assert.IsNull(AppLinks.AssetLinks(tenant), "no app of its own: no file, the link opens the web app");
        Assert.IsNull(AppLinks.SiteAssociation(tenant));

        tenant.AppId = "net.ninjapp.blue";
        Assert.IsNull(AppLinks.AssetLinks(tenant), "an app but no fingerprint: Android could not check it");
        Assert.IsNull(AppLinks.SiteAssociation(tenant), "an app but no team: iOS could not name it");

        tenant.AndroidCertFingerprints = fingerprint;
        tenant.AppleTeamId = "ABCDE12345";
        var android = AppLinks.AssetLinks(tenant)![0]!["target"]!;
        Assert.AreEqual("net.ninjapp.blue", android["package_name"]!.GetValue<string>());
        Assert.AreEqual(fingerprint, android["sha256_cert_fingerprints"]![0]!.GetValue<string>());

        var ios = AppLinks.SiteAssociation(tenant)!["applinks"]!["details"]![0]!;
        Assert.AreEqual("ABCDE12345.net.ninjapp.blue", ios["appIDs"]![0]!.GetValue<string>());
        CollectionAssert.AreEqual(AppLinks.Paths, ios["components"]!.AsArray().Select(c => c!["/"]!.GetValue<string>()).ToArray());

        Assert.AreEqual("ABCDE12345", Read(tenant, new PlatformOptions())["APPLE_TEAM_ID"]!.GetValue<string>(), "the build stamps the same team");
    }

    /// <summary>The paths iOS opens are the ones the Android manifest declares, so a QR code opens the app on both</summary>
    [TestMethod]
    public void The_app_link_paths_are_the_manifests()
    {
        var manifest = File.ReadAllText(TemplatesTests.FindUp(Path.Combine("src", "client_app", "android", "app", "src", "main", "AndroidManifest.xml")));
        var declared = System.Text.RegularExpressions.Regex.Matches(manifest, "android:path(Prefix)?=\"([^\"]+)\"")
            .Select(m => m.Groups[1].Success ? m.Groups[2].Value + "*" : m.Groups[2].Value)
            .ToArray();
        CollectionAssert.AreEquivalent(declared, AppLinks.Paths);
    }

    [TestMethod]
    public void The_customer_app_client_takes_the_own_apps_redirects_only()
    {
        JsonObject Client(params string[] uris) => new() { ["redirectUris"] = new JsonArray([.. uris.Select(u => JsonValue.Create(u))]) };
        string[] Uris(JsonObject c) => [.. c["redirectUris"]!.AsArray().Select(u => u!.GetValue<string>())];
        string[] template = ["com.ninja.blue.client://callback", "com.ninja.blue.client://*"];

        var client = Client(template);
        Assert.IsTrue(Templates.WithAppRedirects(client, "blue", "net.ninjapp.blue"));
        CollectionAssert.AreEqual(template.Concat(["net.ninjapp.blue://callback", "net.ninjapp.blue://*"]).ToArray(), Uris(client));
        Assert.IsFalse(Templates.WithAppRedirects(client, "blue", "net.ninjapp.blue"), "again: nothing to do");

        Assert.IsTrue(Templates.WithAppRedirects(client, "blue", "net.ninjapp.bleu"), "the id changed");
        CollectionAssert.AreEqual(template.Concat(["net.ninjapp.bleu://callback", "net.ninjapp.bleu://*"]).ToArray(), Uris(client));

        client = Client([.. template, "https://example.test/*", "net.ninjapp.blue://callback"]);
        Assert.IsTrue(Templates.WithAppRedirects(client, "blue", null), "cleared");
        CollectionAssert.AreEqual(template.Append("https://example.test/*").ToArray(), Uris(client), "a web redirect stays");
    }
}
