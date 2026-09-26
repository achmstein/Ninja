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
        BusinessType = BusinessType.Restaurant,
        Country = "SA",
        Currency = "SAR",
        TimeZone = "Asia/Riyadh",
        DefaultLanguage = "en",
        OwnerEmail = "owner@blue.test",
        IdentitySecret = "identity-secret-1234567890123456",
        ControlSecret = "control-secret-12345678901234567",
        PaymentsKey = "payments-key-12345678901234567890",
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
            new[] { "mobile-app", "admin-panel", "client-web", "pos-web", "kds-web", "pos-app", "kds-app", "identity-api-service", "ninja-control", "ninja-mcp", "assistant-api" },
            clients.Keys.ToArray());
        Assert.AreEqual("https://admin.blue.ninja.app/*", clients["admin-panel"]["redirectUris"]![0]!.GetValue<string>());
        Assert.AreEqual("https://blue.ninja.app/*", clients["client-web"]["redirectUris"]![0]!.GetValue<string>());
        Assert.AreEqual(tenant.IdentitySecret, clients["identity-api-service"]["secret"]!.GetValue<string>());
        Assert.AreEqual(tenant.ControlSecret, clients["ninja-control"]["secret"]!.GetValue<string>());
        Assert.IsTrue(clients["ninja-control"]["serviceAccountsEnabled"]!.GetValue<bool>());

        // The shared Google and Apple apps are the platform's and their secrets rotate, so they
        // go on through the admin API after the import, never into the realm file
        Assert.IsNull(realm["identityProviders"], "social providers are added by EnsureSocialProvidersAsync, not stamped");
        var users = realm["users"]!.AsArray().Select(u => u!["username"]!.GetValue<string>()).ToArray();
        CollectionAssert.AreEquivalent(new[] { "service-account-identity-api-service", "service-account-ninja-control" }, users);
        var control = realm["users"]!.AsArray().Single(u => u!["username"]!.GetValue<string>() == "service-account-ninja-control")!;
        CollectionAssert.Contains(control["realmRoles"]!.AsArray().Select(r => r!.GetValue<string>()).ToList(), "Owner");
    }

    // The shared provider apps: one Google, one Apple, the same pair in every
    // tenant's realm, hidden from the login page because only the native
    // token-exchange path can use them until a hub realm exists.
    private static PlatformOptions WithSocial(bool google = true, bool apple = true) => new()
    {
        Domain = "ninja.app",
        Social = new SocialOptions
        {
            Google = google ? new SocialProviderOptions { ClientId = "g-id.apps.googleusercontent.com", ClientSecret = "g-secret" } : new(),
            Apple = apple ? new SocialProviderOptions { ClientId = "app.ninja.client", ClientSecret = "a-jwt" } : new(),
        },
    };

    [TestMethod]
    public void Social_providers_carry_the_shared_app_and_stay_off_the_login_page()
    {
        var providers = Templates.SocialProviders(WithSocial());
        var byAlias = providers.ToDictionary(p => p!["alias"]!.GetValue<string>(), p => p!.AsObject());
        CollectionAssert.AreEquivalent(new[] { "google", "apple" }, byAlias.Keys.ToArray());

        foreach (var (alias, provider) in byAlias)
        {
            // Keycloak 26 reads this off the representation; config.hideOnLoginPage is gone
            Assert.IsTrue(provider["hideOnLogin"]!.GetValue<bool>(), $"{alias} would otherwise offer a browser flow with no redirect URI registered");
            Assert.IsTrue(provider["enabled"]!.GetValue<bool>());
            Assert.IsTrue(provider["trustEmail"]!.GetValue<bool>(), $"{alias} already verified the address");
            Assert.AreEqual("IMPORT", provider["config"]!["syncMode"]!.GetValue<string>());
        }

        Assert.AreEqual("google", byAlias["google"]["providerId"]!.GetValue<string>());
        Assert.AreEqual("g-id.apps.googleusercontent.com", byAlias["google"]["config"]!["clientId"]!.GetValue<string>());
        // Apple is plain OIDC with its endpoints spelled out, not a built-in provider
        Assert.AreEqual("oidc", byAlias["apple"]["providerId"]!.GetValue<string>());
        Assert.AreEqual("https://appleid.apple.com", byAlias["apple"]["config"]!["issuer"]!.GetValue<string>());
        Assert.AreEqual("a-jwt", byAlias["apple"]["config"]!["clientSecret"]!.GetValue<string>());
    }

    [TestMethod]
    public void A_provider_the_platform_has_no_app_for_is_left_out_entirely()
    {
        Assert.AreEqual(1, Templates.SocialProviders(WithSocial(apple: false)).Count);
        Assert.AreEqual("google", Templates.SocialProviders(WithSocial(apple: false))[0]!["alias"]!.GetValue<string>());
        // Nothing configured: a realm with no providers beats one with providers that cannot work
        Assert.AreEqual(0, Templates.SocialProviders(Platform).Count);
        // Half a provider is no provider
        var halfGoogle = new PlatformOptions { Social = new SocialOptions { Google = new SocialProviderOptions { ClientId = "g-id" } } };
        Assert.AreEqual(0, Templates.SocialProviders(halfGoogle).Count);
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
        Assert.IsFalse(Regex.IsMatch(yaml, @"^  (catalog|ordering|tenant)-api:", RegexOptions.Multiline));
        Assert.IsFalse(Regex.IsMatch(yaml, @"^  mobile-bff:", RegexOptions.Multiline));

        // Its own role and broker user, never the platform's superuser or guest
        StringAssert.Contains(yaml, "Username=blue_app;Password=${DB_PASSWORD};Database=blue_catalogdb");
        StringAssert.Contains(yaml, "amqp://blue_app:${BROKER_PASSWORD}@eventbus:5672/blue");

        // The key to the café's payment provider secrets reaches Sales alone
        Assert.AreEqual(1, Regex.Matches(yaml, @"\$\{PAYMENTS_KEY\}").Count);
        StringAssert.Contains(yaml, "Payments__Key: \"${PAYMENTS_KEY}\"");
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
        // Catalog writes the menu's pictures under its content root; an upgrade must not take them with the container
        StringAssert.Contains(yaml, "blue-catalog-pics:/app/Pics");
        StringAssert.Contains(yaml, "  blue-catalog-pics: {}");
        StringAssert.Contains(yaml, "CatalogOptions__PicBaseUrl: \"https://api.blue.ninja.app\"");
        // Every service plants its own tables from the same profile; a stamp is never tenant one
        Assert.AreEqual(TenantNaming.Services.Length, Regex.Matches(yaml, "Seed__Profile: \"sample\"").Count);
        Assert.IsFalse(yaml.Contains("chillax", StringComparison.OrdinalIgnoreCase));
        // What the sample plants follows the kind of place, and every service is told it
        Assert.AreEqual(TenantNaming.Services.Length, Regex.Matches(yaml, "Tenant__BusinessType: \"restaurant\"").Count);
        // The locale reaches every service, not only the one that stores it
        Assert.AreEqual(TenantNaming.Services.Length, Regex.Matches(yaml, "Tenant__TimeZone: \"Asia/Riyadh\"").Count);
        StringAssert.Contains(yaml, "Tenant__Currency: \"SAR\"");
        StringAssert.Contains(yaml, "Tenant__Country: \"SA\"");
        StringAssert.Contains(yaml, "Tenant__DefaultLanguage: \"en\"");
        // Which Arabic the cafe speaks travels with the rest of its locale, so
        // a push notification reads the same as the screens it follows
        Assert.AreEqual(TenantNaming.Services.Length, Regex.Matches(yaml, "Tenant__ArabicStyle: \"standard\"").Count);
        StringAssert.Contains(yaml, "ConnectionStrings__chatModel");
        StringAssert.Contains(yaml, "external: true");
        StringAssert.Contains(yaml, "REVERSEPROXY__CLUSTERS__tenant__DESTINATIONS__d1__ADDRESS: \"http://blue-tenant-api:8080\"");
        // The café's own service is Tenant.API, on its own database; the assistant calls it by its Aspire name
        StringAssert.Contains(yaml, "image: \"ghcr.io/achmstein/ninja-tenant:");
        StringAssert.Contains(yaml, "ConnectionStrings__tenantdb: \"Host=");
        StringAssert.Contains(yaml, "Database=blue_tenantdb;");
        StringAssert.Contains(yaml, "services__tenant-api__http__0: \"http://blue-tenant-api:8080\"");
        StringAssert.Contains(yaml, "REVERSEPROXY__ROUTES__route0__MATCH__PATH");
        Assert.IsFalse(Regex.IsMatch(yaml, "branch-api|ninja-branch|branchdb"), "nothing runs under the old service's name");
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
        // tenant_api proxies; the paused answer is a snippet of its own, and a café on its
        // own domain needs it as much as one on {slug}.{domain} -- without it a suspended
        // stack shows a bare 502 instead of the app's paused page
        StringAssert.Contains(snippet, "import paused_api");
    }

    [TestMethod]
    public void Only_a_demo_takes_pretend_payments()
    {
        var demo = Blue();
        demo.Kind = TenantKind.Demo;
        StringAssert.Contains(Templates.Compose(demo, TenantHosts.For(demo, Platform), Platform), "Payments__Simulated: \"true\"");

        var customer = Blue();
        customer.Kind = TenantKind.Customer;
        Assert.DoesNotContain("Payments__Simulated", Templates.Compose(customer, TenantHosts.For(customer, Platform), Platform), "a café with real guests takes real money or none");
    }

    [TestMethod]
    public void Env_carries_the_tenants_own_secrets_and_none_of_the_platforms()
    {
        var env = Templates.Env(Blue(), Platform);
        StringAssert.Contains(env, "DB_PASSWORD=db-password-123456789012345678");
        StringAssert.Contains(env, "BROKER_PASSWORD=broker-password-1234567890123456");
        StringAssert.Contains(env, "IDENTITY_SECRET=identity-secret-1234567890123456");
        StringAssert.Contains(env, "GEMINI_API_KEY=k");
        StringAssert.Contains(env, "PAYMENTS_KEY=payments-key-12345678901234567890");
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

        // Thirteen services and the gateway: the AI assistant's three get more, the gateway less
        Assert.HasCount(10, Regex.Matches(yaml, "memory: \"256M\""));
        Assert.HasCount(3, Regex.Matches(yaml, "memory: \"384M\""));
        Assert.HasCount(1, Regex.Matches(yaml, "memory: \"128M\""));
        Assert.HasCount(13, Regex.Matches(yaml, "cpus: \"1.0\""));
        Assert.HasCount(1, Regex.Matches(yaml, "cpus: \"0.5\""));
        Assert.HasCount(14, Regex.Matches(yaml, "pids: 256"));
        Assert.HasCount(14, Regex.Matches(yaml, "max-size: \"10m\""));
        Assert.HasCount(14, Regex.Matches(yaml, "max-file: \"3\""));

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
            if (!TenantNaming.HasQueue(service))
            {
                // No bus: the settings must not name a queue either, or the broker would get a consumer it never sees
                var noBus = JsonNode.Parse(File.ReadAllText(FindUp(Path.Combine("src", $"{TenantNaming.Queue(service)}.API", "appsettings.json"))))!;
                Assert.IsNull(noBus["EventBus"], service);
                continue;
            }
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

    [TestMethod]
    public void The_assistant_parts_of_the_realm_come_from_the_template()
    {
        var parts = Templates.AssistantRealmParts("https://api.blue.ninja.app/", "sec-ret");

        // The mcp scope carries the endpoint and the exchange client as audiences, and grants the roles a self-registered client may not see
        // Two mappers, because Keycloak's audience mapper takes the client audience instead of the custom one when both are set
        var mappers = parts.McpScope["protocolMappers"]!.AsArray().Select(m => m!["config"]!.AsObject()).ToList();
        Assert.AreEqual("https://api.blue.ninja.app/mcp", mappers.Single(m => m.ContainsKey("included.custom.audience"))["included.custom.audience"]!.GetValue<string>());
        Assert.AreEqual("assistant-api", mappers.Single(m => m.ContainsKey("included.client.audience"))["included.client.audience"]!.GetValue<string>());
        CollectionAssert.AreEquivalent(new[] { "Owner", "Admin", "Cashier" }, parts.McpRoles);
        CollectionAssert.Contains(parts.DefaultScopes, "mcp");
        CollectionAssert.Contains(parts.DefaultScopes, "branches");
        CollectionAssert.Contains(parts.OptionalScopes, "offline_access");

        // Both clients, the exchange client with the tenant's secret and no browser flow, the public one with the chat apps' callbacks
        var clients = parts.Clients.ToDictionary(c => c!["clientId"]!.GetValue<string>(), c => c!.AsObject());
        Assert.AreEqual("sec-ret", clients["assistant-api"]["secret"]!.GetValue<string>());
        Assert.IsFalse(clients["assistant-api"]["publicClient"]!.GetValue<bool>());
        Assert.IsFalse(clients["assistant-api"]["standardFlowEnabled"]!.GetValue<bool>());
        Assert.AreEqual("true", clients["assistant-api"]["attributes"]!["standard.token.exchange.enabled"]!.GetValue<string>());
        Assert.IsTrue(clients["ninja-mcp"]["publicClient"]!.GetValue<bool>());
        Assert.IsFalse(clients["ninja-mcp"]["directAccessGrantsEnabled"]!.GetValue<bool>(), "password grants are for the dev realm's tests only");
        CollectionAssert.Contains(clients["ninja-mcp"]["redirectUris"]!.AsArray().Select(u => u!.GetValue<string>()).ToArray(), "https://claude.ai/api/mcp/auth_callback");

        // The anonymous registration policies let ChatGPT and Claude register a client of their own, and nothing else
        var trusted = parts.Policies.Single(p => p!["providerId"]!.GetValue<string>() == "trusted-hosts" && p["subType"]!.GetValue<string>() == "anonymous")!;
        var hosts = trusted["config"]!["trusted-hosts"]!.AsArray().Select(h => h!.GetValue<string>()).ToArray();
        CollectionAssert.Contains(hosts, "chatgpt.com");
        CollectionAssert.Contains(hosts, "claude.ai");
        Assert.AreEqual("false", trusted["config"]!["host-sending-registration-request-must-match"]![0]!.GetValue<string>());
        var allowed = parts.Policies.Single(p => p!["providerId"]!.GetValue<string>() == "allowed-client-templates" && p["subType"]!.GetValue<string>() == "anonymous")!;
        CollectionAssert.Contains(allowed["config"]!["allowed-client-scopes"]!.AsArray().Select(s => s!.GetValue<string>()).ToArray(), "mcp");
    }
}
