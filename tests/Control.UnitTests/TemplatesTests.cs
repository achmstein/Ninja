using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

/// <summary>What a stamp is made of: a realm Keycloak will accept, a compose file with no name that can collide, and the gateway's own route table.</summary>
[TestClass]
public sealed class TemplatesTests
{
    private static readonly PlatformOptions Platform = new()
    {
        Domain = "ninja.app",
        ControlUrl = "https://control.ninja.app",
        KeycloakPublicUrl = "https://auth.ninja.app",
        GeminiApiKey = "k",
    };

    private static Tenant Blue() => new()
    {
        Slug = "blue",
        NameEn = "Blue \"Bottle\"",
        NameAr = "بلو",
        PrimaryColor = "#0055ff",
        Seed = TenantSeed.Sample,
        Country = "SA",
        Currency = "SAR",
        TimeZone = "Asia/Riyadh",
        DefaultLanguage = "en",
        OwnerEmail = "owner@blue.test",
        IdentitySecret = "identity-secret-1234567890123456",
        ControlSecret = "control-secret-12345678901234567",
    };

    [TestMethod]
    public void Tenant_realm_is_valid_json_named_after_the_slug_with_every_slot_filled()
    {
        var tenant = Blue();
        var json = Templates.TenantRealm(tenant, TenantHosts.For(tenant, Platform), Platform);

        var realm = JsonNode.Parse(json)!.AsObject();
        Assert.AreEqual("blue", realm["realm"]!.GetValue<string>());
        Assert.AreEqual("Blue \"Bottle\"", realm["displayName"]!.GetValue<string>());
        Assert.IsFalse(json.Contains("{{"), "an unfilled slot survived");
        Assert.IsFalse(json.Contains("chillax", StringComparison.OrdinalIgnoreCase), "the template still names the first tenant");
        Assert.AreEqual("external", realm["sslRequired"]!.GetValue<string>());
        var local = JsonNode.Parse(Templates.TenantRealm(tenant, TenantHosts.For(tenant, Platform), new PlatformOptions { Domain = "localhost", Scheme = "http" }))!;
        Assert.AreEqual("none", local["sslRequired"]!.GetValue<string>(), "plain http cannot carry Secure cookies");

        var clients = realm["clients"]!.AsArray().ToDictionary(c => c!["clientId"]!.GetValue<string>(), c => c!.AsObject());
        CollectionAssert.AreEquivalent(
            new[] { "mobile-app", "admin-panel", "client-web", "pos-web", "kds-web", "pos-app", "kds-app", "identity-api-service", "ninja-control" },
            clients.Keys.ToArray());
        Assert.AreEqual("https://admin.blue.ninja.app/*", clients["admin-panel"]["redirectUris"]![0]!.GetValue<string>());
        Assert.AreEqual("https://blue.ninja.app/*", clients["client-web"]["redirectUris"]![0]!.GetValue<string>());
        Assert.AreEqual(tenant.IdentitySecret, clients["identity-api-service"]["secret"]!.GetValue<string>());
        Assert.AreEqual(tenant.ControlSecret, clients["ninja-control"]["secret"]!.GetValue<string>());
        Assert.IsTrue(clients["ninja-control"]["serviceAccountsEnabled"]!.GetValue<bool>());

        Assert.IsNull(realm["identityProviders"], "a café brings its own social apps");
        var users = realm["users"]!.AsArray().Select(u => u!["username"]!.GetValue<string>()).ToArray();
        CollectionAssert.AreEquivalent(new[] { "service-account-identity-api-service", "service-account-ninja-control" }, users);
        var control = realm["users"]!.AsArray().Single(u => u!["username"]!.GetValue<string>() == "service-account-ninja-control")!;
        CollectionAssert.Contains(control["realmRoles"]!.AsArray().Select(r => r!.GetValue<string>()).ToList(), "Owner");
    }

    [TestMethod]
    public void Platform_realm_is_valid_json_with_its_client_on_the_control_host()
    {
        var json = Templates.PlatformRealm(new PlatformOptions { Domain = "ninja.app", ControlUrl = "https://control.ninja.app" }, "Pa$$w0rd\"quoted");
        var realm = JsonNode.Parse(json)!.AsObject();
        Assert.AreEqual("ninja", realm["realm"]!.GetValue<string>());
        Assert.AreEqual("https://control.ninja.app/*", realm["clients"]![0]!["redirectUris"]![0]!.GetValue<string>());
        Assert.AreEqual("Pa$$w0rd\"quoted", realm["users"]![0]!["credentials"]![0]!["value"]!.GetValue<string>());
        Assert.IsFalse(json.Contains("{{"));
    }

    [TestMethod]
    public void Compose_names_everything_after_the_slug_and_wires_the_shared_services()
    {
        var tenant = Blue();
        var yaml = Templates.Compose(tenant, TenantHosts.For(tenant, Platform), Platform);

        StringAssert.Contains(yaml, "name: ninja-blue");
        foreach (var service in TenantNaming.Services)
        {
            StringAssert.Contains(yaml, $"  blue-{service}-api:");
            StringAssert.Contains(yaml, $"image: \"ghcr.io/achmstein/ninja-{service}:latest\"");
        }
        StringAssert.Contains(yaml, "  blue-gateway:");
        // No bare service name that another tenant's stack would also register on the shared network
        Assert.IsFalse(Regex.IsMatch(yaml, @"^  (catalog|ordering|branch)-api:", RegexOptions.Multiline));
        Assert.IsFalse(Regex.IsMatch(yaml, @"^  mobile-bff:", RegexOptions.Multiline));

        StringAssert.Contains(yaml, "Database=blue_catalogdb");
        StringAssert.Contains(yaml, "amqp://guest:${RABBIT_PASSWORD}@eventbus:5672/blue");
        StringAssert.Contains(yaml, "Identity__Url: \"http://keycloak:8080/realms/blue\"");
        StringAssert.Contains(yaml, "Keycloak__Realm: \"blue\"");
        StringAssert.Contains(yaml, "Tenant__Name__En: \"Blue \\\"Bottle\\\"\"");
        StringAssert.Contains(yaml, "Tenant__PrimaryColor: \"#0055ff\"");
        StringAssert.Contains(yaml, "Tenant__CustomerUrl: \"https://blue.ninja.app\"");
        StringAssert.Contains(yaml, "Tenant__AuthUrl: \"https://auth.ninja.app/realms/blue\"");
        StringAssert.Contains(yaml, "blue-branch-uploads:/app/uploads");
        StringAssert.Contains(yaml, "CatalogOptions__PicBaseUrl: \"https://api.blue.ninja.app\"");
        // Every service plants its own tables from the same profile; a stamp is never tenant one
        Assert.AreEqual(TenantNaming.Services.Length, Regex.Matches(yaml, "Seed__Profile: \"sample\"").Count);
        Assert.IsFalse(yaml.Contains("chillax", StringComparison.OrdinalIgnoreCase));
        // The locale reaches every service, not only the one that stores it
        Assert.AreEqual(TenantNaming.Services.Length, Regex.Matches(yaml, "Tenant__TimeZone: \"Asia/Riyadh\"").Count);
        StringAssert.Contains(yaml, "Tenant__Currency: \"SAR\"");
        StringAssert.Contains(yaml, "Tenant__Country: \"SA\"");
        StringAssert.Contains(yaml, "Tenant__DefaultLanguage: \"en\"");
        StringAssert.Contains(yaml, "ConnectionStrings__chatModel");
        StringAssert.Contains(yaml, "external: true");
        StringAssert.Contains(yaml, "REVERSEPROXY__CLUSTERS__branch__DESTINATIONS__d1__ADDRESS: \"http://blue-branch-api:8080\"");
        StringAssert.Contains(yaml, "REVERSEPROXY__ROUTES__route0__MATCH__PATH: \"/api/catalog/items/{id}/pic\"");
        // The forwarded-headers transform is one object with two keys; YARP rejects HeaderPrefix on its own
        StringAssert.Contains(yaml, "REVERSEPROXY__ROUTES__route0__TRANSFORMS__0__X-Forwarded: \"Set\"");
        StringAssert.Contains(yaml, "REVERSEPROXY__ROUTES__route0__TRANSFORMS__0__HeaderPrefix: \"X-Forwarded-\"");
        Assert.IsFalse(yaml.Contains("TRANSFORMS__1__HeaderPrefix"));

        // Identity has no database; the assistant is off without a key
        Assert.IsFalse(yaml.Contains("ConnectionStrings__identitydb"));
        var noAi = Templates.Compose(tenant, TenantHosts.For(tenant, Platform), new PlatformOptions { Domain = "ninja.app" });
        StringAssert.Contains(noAi, "AI__Enabled: \"false\"");
    }

    [TestMethod]
    public void Gateway_routes_match_the_AppHost_route_table()
    {
        // The AppHost is the source of truth for the single stack's gateway;
        // the stamped gateway must carry the same paths to the same clusters.
        var extensions = File.ReadAllText(FindUp("src/Ninja.AppHost/Extensions.cs"));
        var declared = Regex.Matches(extensions, @"yarp\.AddRoute\(""(?<path>[^""]+)"",\s*(?<cluster>\w+)Cluster\)")
            .Select(m => (Path: m.Groups["path"].Value, Cluster: m.Groups["cluster"].Value))
            .ToList();
        Assert.IsTrue(declared.Count >= 15, "the AppHost route table was not found");

        var stamped = Templates.GatewayRoutes().Select(r => (r.Path, r.Cluster)).ToHashSet();
        foreach (var (path, cluster) in declared)
        {
            Assert.IsTrue(stamped.Contains((path, cluster)), $"{path} → {cluster} is in the AppHost but not in the stamp");
        }
    }

    [TestMethod]
    public void Custom_domain_sites_proxy_to_the_cafes_gateway_and_nothing_else()
    {
        var own = new Tenant { Slug = "blue", CustomerDomain = "menu.bluebottle.com" };
        var platformHosted = new Tenant { Slug = "red" };
        var snippet = Templates.CustomDomains([platformHosted, own], Platform);

        StringAssert.Contains(snippet, "https://menu.bluebottle.com {");
        StringAssert.Contains(snippet, "import tenant_api blue-gateway");
        StringAssert.Contains(snippet, "frame-ancestors 'self' https://control.ninja.app");
        Assert.IsFalse(snippet.Contains("red"), "a platform-hosted café needs no site of its own");
    }

    [TestMethod]
    public void Env_carries_the_shared_and_the_tenant_secrets()
    {
        var env = Templates.Env(Blue(), Platform);
        StringAssert.Contains(env, "POSTGRES_PASSWORD=postgres");
        StringAssert.Contains(env, "IDENTITY_SECRET=identity-secret-1234567890123456");
        StringAssert.Contains(env, "GEMINI_API_KEY=k");
    }

    private static string FindUp(string relative)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Ninja.slnx"))) dir = dir.Parent;
        return Path.Combine(dir!.FullName, relative);
    }
}
