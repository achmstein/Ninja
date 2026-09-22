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
        DbPassword = "db-password-123456789012345678",
        BrokerPassword = "broker-password-1234567890123456",
    };

    [TestMethod]
    public void Tenant_realm_is_valid_json_named_after_the_slug_with_every_slot_filled()
    {
        var tenant = Blue();
        var json = Templates.TenantRealm(tenant, TenantHosts.For(tenant, Platform), Platform);

        var realm = JsonNode.Parse(json)!.AsObject();
        Assert.AreEqual("blue", realm["realm"]!.GetValue<string>());
        Assert.AreEqual("Blue \"Bottle\"", realm["displayName"]!.GetValue<string>());
        // The login page: the platform's theme, the café's mark from its own API
        Assert.AreEqual("ninja", realm["loginTheme"]!.GetValue<string>());
        Assert.AreEqual("<img src=\"https://api.blue.ninja.app/api/tenant/icons/icon-192.png\" alt=\"\">", realm["displayNameHtml"]!.GetValue<string>());
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
        // The same login theme as the tenants; with no HTML display name it shows the N tile and "Ninja"
        Assert.AreEqual("ninja", realm["loginTheme"]!.GetValue<string>());
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

        // Its own role and broker user, never the platform's superuser or guest
        StringAssert.Contains(yaml, "Username=blue_app;Password=${DB_PASSWORD};Database=blue_catalogdb");
        StringAssert.Contains(yaml, "amqp://blue_app:${BROKER_PASSWORD}@eventbus:5672/blue");
        Assert.IsFalse(yaml.Contains("Username=postgres"));
        Assert.IsFalse(yaml.Contains("amqp://guest"));
        Assert.IsFalse(yaml.Contains("POSTGRES_PASSWORD"));
        StringAssert.Contains(yaml, "Identity__Url: \"http://keycloak:8080/realms/blue\"");
        StringAssert.Contains(yaml, "Keycloak__Realm: \"blue\"");
        StringAssert.Contains(yaml, "Tenant__Name__En: \"Blue \\\"Bottle\\\"\"");
        StringAssert.Contains(yaml, "Tenant__PrimaryColor: \"#0055ff\"");
        StringAssert.Contains(yaml, "Tenant__CustomerUrl: \"https://blue.ninja.app\"");
        StringAssert.Contains(yaml, "Tenant__AuthUrl: \"https://auth.ninja.app/realms/blue\"");
        // The native apps connect to the API host and download from the platform's page
        StringAssert.Contains(yaml, "Tenant__ApiUrl: \"https://api.blue.ninja.app\"");
        StringAssert.Contains(yaml, "Tenant__AppsUrl: \"https://ninja.app/apps\"");
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
        // With a key, only the plans that include the assistant get it: a customer on Starter runs without, and its .env carries no key
        var starter = Blue();
        starter.Kind = TenantKind.Customer;
        starter.Plan = TenantPlan.Starter;
        StringAssert.Contains(Templates.Compose(starter, TenantHosts.For(starter, Platform), Platform), "AI__Enabled: \"false\"");
        StringAssert.Contains(Templates.Env(starter, Platform), "GEMINI_API_KEY=\n");
        starter.Plan = TenantPlan.Pro;
        StringAssert.Contains(Templates.Compose(starter, TenantHosts.For(starter, Platform), Platform), "ConnectionStrings__chatModel");
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
        StringAssert.Contains(snippet, "frame-ancestors 'self' https://control.ninja.app https://admin.blue.ninja.app");
        Assert.IsFalse(snippet.Contains("red"), "a platform-hosted café needs no site of its own");
    }

    [TestMethod]
    public void Env_carries_the_tenants_own_secrets_and_none_of_the_platforms()
    {
        var env = Templates.Env(Blue(), Platform);
        StringAssert.Contains(env, "DB_PASSWORD=db-password-123456789012345678");
        StringAssert.Contains(env, "BROKER_PASSWORD=broker-password-1234567890123456");
        StringAssert.Contains(env, "IDENTITY_SECRET=identity-secret-1234567890123456");
        StringAssert.Contains(env, "GEMINI_API_KEY=k");
        Assert.IsFalse(env.Contains("POSTGRES_PASSWORD"), "the superuser password must not reach a tenant folder");
        Assert.IsFalse(env.Contains("RABBIT_PASSWORD"));
    }

    [TestMethod]
    public void Env_refuses_a_tenant_without_credentials_of_its_own()
    {
        var stampedBefore = Blue();
        stampedBefore.DbPassword = null;
        Assert.ThrowsExactly<InvalidOperationException>(() => Templates.Env(stampedBefore, Platform));
    }

    [TestMethod]
    public void Compose_caps_memory_cpu_pids_and_logs_on_every_container()
    {
        var tenant = Blue();
        var yaml = Templates.Compose(tenant, TenantHosts.For(tenant, Platform), Platform);

        // Twelve services and the gateway: the assistant's three get more, the gateway less
        Assert.HasCount(9, Regex.Matches(yaml, "memory: \"256M\""));
        Assert.HasCount(3, Regex.Matches(yaml, "memory: \"384M\""));
        Assert.HasCount(1, Regex.Matches(yaml, "memory: \"128M\""));
        Assert.HasCount(12, Regex.Matches(yaml, "cpus: \"1.0\""));
        Assert.HasCount(1, Regex.Matches(yaml, "cpus: \"0.5\""));
        Assert.HasCount(13, Regex.Matches(yaml, "pids: 256"));
        Assert.HasCount(13, Regex.Matches(yaml, "max-size: \"10m\""));
        Assert.HasCount(13, Regex.Matches(yaml, "max-file: \"3\""));

        var heavier = new PlatformOptions { Domain = "ninja.app", ServiceMemoryOverridesMb = { ["catalog"] = 512 } };
        var tuned = Templates.Compose(tenant, TenantHosts.For(tenant, heavier), heavier);
        Assert.HasCount(1, Regex.Matches(tuned, "memory: \"512M\""));
        Assert.HasCount(2, Regex.Matches(tuned, "memory: \"384M\""));
    }

    /// <summary>The queue the control plane deletes when a module leaves the plan is the one its service declares.</summary>
    [TestMethod]
    public void Queue_names_match_the_services_subscription_client_names()
    {
        foreach (var service in TenantNaming.Services)
        {
            // appsettings carry comments, the way ASP.NET reads them
            var json = File.ReadAllText(FindUp(Path.Combine("src", $"{TenantNaming.Queue(service)}.API", "appsettings.json")));
            var settings = JsonNode.Parse(json, documentOptions: new JsonDocumentOptions { CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true })!;
            Assert.AreEqual(TenantNaming.Queue(service), settings["EventBus"]?["SubscriptionClientName"]?.GetValue<string>(), service);
        }
    }

    private static string FindUp(string relative)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Ninja.slnx"))) dir = dir.Parent;
        return Path.Combine(dir!.FullName, relative);
    }
}
