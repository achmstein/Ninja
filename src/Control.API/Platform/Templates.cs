using System.Globalization;
using System.Reflection;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Ninja.Control.API.Model;
using Ninja.ServiceDefaults;

namespace Ninja.Control.API.Platform;

/// <summary>
/// The files a tenant is stamped from, as embedded resources with
/// {{placeholder}} slots. The compose file is built here rather than kept as
/// a template because its shape (the services the plan runs, at most the
/// AppHost's twelve, and a gateway) is decided per tenant, and the names
/// must not collide on the shared network.
/// </summary>
public static partial class Templates
{
    [GeneratedRegex(@"\{\{(\w+)\}\}")]
    private static partial Regex Placeholder();

    public static string Read(string name)
    {
        var assembly = Assembly.GetExecutingAssembly();
        var resource = assembly.GetManifestResourceNames().FirstOrDefault(n => n.EndsWith($".Templates.{name}", StringComparison.Ordinal))
            ?? throw new InvalidOperationException($"Template {name} is not embedded");
        using var stream = assembly.GetManifestResourceStream(resource)!;
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }

    /// <summary>Fills every {{slot}}; an unfilled slot is a bug, so it throws.</summary>
    public static string Render(string template, IReadOnlyDictionary<string, string> values)
        => Placeholder().Replace(template, m =>
            values.TryGetValue(m.Groups[1].Value, out var v) ? v : throw new InvalidOperationException($"No value for {{{{{m.Groups[1].Value}}}}}"));

    /// <summary>The tenant's realm, from the template.</summary>
    /// <summary>Over https every external request must be TLS; a local http platform cannot set Secure cookies, so none.</summary>
    private static string SslRequired(PlatformOptions platform) => platform.Scheme == "https" ? "external" : "none";

    public static string TenantRealm(Tenant tenant, TenantHosts hosts, PlatformOptions platform)
        => Render(Read("tenant-realm.json"), new Dictionary<string, string>
        {
            ["slug"] = tenant.Slug,
            ["displayName"] = JsonEscape(tenant.DisplayName),
            // The login page's mark: the tenant's icon, cut from its logo (a placeholder until one is uploaded), never cached past a revalidation
            ["displayNameHtml"] = JsonEscape($"<img src=\"{hosts.ApiUrl}/api/tenant/icons/icon-192.png\" alt=\"\">"),
            ["customerUrl"] = hosts.CustomerUrl,
            ["adminUrl"] = hosts.AdminUrl,
            ["posUrl"] = hosts.PosUrl,
            ["kdsUrl"] = hosts.KdsUrl,
            ["identitySecret"] = tenant.IdentitySecret,
            ["controlSecret"] = tenant.ControlSecret,
            // The owner's MCP server: its token-exchange client and the audience its tokens carry (the endpoint as an owner types it)
            ["assistantSecret"] = tenant.AssistantSecret,
            ["apiUrl"] = hosts.ApiUrl,
            ["sslRequired"] = SslRequired(platform),
            // Inside the user profile, which is JSON kept as a string inside the realm JSON: escaped twice
            ["phonePattern"] = JsonEscape(JsonEscape(PhoneRules.For(tenant.Country).Pattern)),
            ["phonePlaceholder"] = JsonEscape(JsonEscape(PhoneRules.For(tenant.Country).Placeholder)),
            ["smtpServer"] = SmtpServerJson(platform.Mail),
        });

    /// <summary>The type Keycloak files client registration policies under, in a realm's components.</summary>
    public const string ClientRegistrationPolicyType = "org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy";

    /// <summary>The owner's assistant as the realm template declares it, for a realm created before there was one.</summary>
    public sealed record AssistantRealmPartsView(JsonObject McpScope, JsonArray Clients, JsonArray Policies, string[] DefaultScopes, string[] OptionalScopes, string[] McpRoles);

    /// <summary>
    /// The pieces of the realm template that make the owner's assistant work:
    /// the mcp client scope (audience = the API host's /mcp and the exchange
    /// client), the ninja-mcp and assistant-api clients, the realm's default
    /// scope lists, the realm roles the mcp scope grants, and the anonymous
    /// registration policies. Read from the template itself so a realm brought
    /// up to date by hand matches one created from it.
    /// </summary>
    public static AssistantRealmPartsView AssistantRealmParts(string apiUrl, string assistantSecret)
    {
        var json = Render(Read("tenant-realm.json"), new Dictionary<string, string>
        {
            ["slug"] = "template",
            ["displayName"] = "",
            ["displayNameHtml"] = "",
            ["customerUrl"] = "https://template.invalid",
            ["adminUrl"] = "https://admin.template.invalid",
            ["posUrl"] = "https://pos.template.invalid",
            ["kdsUrl"] = "https://kds.template.invalid",
            ["identitySecret"] = "unused",
            ["controlSecret"] = "unused",
            ["sslRequired"] = "external",
            ["phonePattern"] = "",
            ["phonePlaceholder"] = "",
            ["smtpServer"] = "{}",
            ["assistantSecret"] = assistantSecret,
            ["apiUrl"] = apiUrl.TrimEnd('/'),
        });
        var realm = JsonNode.Parse(json)!.AsObject();
        static string Name(JsonNode? n, string key) => n![key]!.GetValue<string>();

        var scope = realm["clientScopes"]!.AsArray().Single(s => Name(s, "name") == "mcp")!.DeepClone().AsObject();
        var clients = new JsonArray(realm["clients"]!.AsArray()
            .Where(c => Name(c, "clientId") is "ninja-mcp" or "assistant-api" or "rider-app")
            .Select(c => c!.DeepClone()).ToArray());
        var policies = new JsonArray(realm["components"]![ClientRegistrationPolicyType]!.AsArray().Select(p => p!.DeepClone()).ToArray());
        var defaults = realm["defaultDefaultClientScopes"]!.AsArray().Select(s => s!.GetValue<string>()).ToArray();
        var optionals = realm["defaultOptionalClientScopes"]!.AsArray().Select(s => s!.GetValue<string>()).ToArray();
        var roles = realm["scopeMappings"]!.AsArray().Single(m => Name(m, "clientScope") == "mcp")!["roles"]!.AsArray().Select(r => r!.GetValue<string>()).ToArray();
        return new AssistantRealmPartsView(scope, clients, policies, defaults, optionals, roles);
    }

    /// <summary>
    /// The identity providers a tenant realm needs so the native apps can hand
    /// a Google or Apple token straight to the realm and get one of its own
    /// back (token exchange, subject_issuer=google|apple). That path never
    /// opens a browser, so it needs no redirect URI — which is why these can
    /// be stamped into every realm for free.
    ///
    /// They are hidden from the login page on purpose. The browser flow
    /// (kc_idp_hint) would send the person out to the provider and back to
    /// <c>/realms/{slug}/broker/{alias}/endpoint</c>, and that URI has to be
    /// registered with Google by hand, per realm, in a console with no API.
    /// Turning these on for the browser would put a human in the middle of
    /// provisioning; docs/social-auth-multi-tenant.md has the way out (a hub
    /// realm with one redirect URI), which is not built yet.
    ///
    /// Only the providers the platform actually holds an app for: a realm
    /// with no provider is better than one with a provider that cannot work.
    /// </summary>
    public static JsonArray SocialProviders(PlatformOptions platform) => RealProviders(platform, hidden: true);

    /// <summary>
    /// The same Google and Apple apps in the hub realm, where they are what the browser is sent to: shown,
    /// and with the hub's one redirect URI each registered with Google and Apple once. A person's hub
    /// record is only a pass through, so the hub never stops them to review a profile.
    /// </summary>
    public static JsonArray HubProviders(PlatformOptions platform) => RealProviders(platform, hidden: false);

    /// <summary>The providers the platform holds an app for: "google", "apple", in the order the apps show them.</summary>
    public static IReadOnlyList<string> SocialKinds(PlatformOptions platform)
        => [.. new[] { ("google", platform.Social.Google), ("apple", platform.Social.Apple) }.Where(p => p.Item2.Configured).Select(p => p.Item1)];

    private static JsonArray RealProviders(PlatformOptions platform, bool hidden)
    {
        var providers = new JsonArray();
        if (platform.Social.Google.Configured)
        {
            providers.Add(Provider("google", "google", "Google", platform.Social.Google, new JsonObject
            {
                ["useJwksUrl"] = "true",
                ["defaultScope"] = "openid profile email",
            }, hidden));
        }
        if (platform.Social.Apple.Configured)
        {
            // Apple is not a first-class Keycloak provider: it is plain OIDC with its endpoints spelled out.
            // Asking for name and email, Apple answers only as a form post; the auth host turns that post
            // into the GET Keycloak listens for (ControlApi.AppleFormPost)
            providers.Add(Provider("apple", "oidc", "Apple", platform.Social.Apple, new JsonObject
            {
                ["authorizationUrl"] = AppleAuthorizationUrl,
                ["tokenUrl"] = "https://appleid.apple.com/auth/token",
                ["jwksUrl"] = "https://appleid.apple.com/auth/keys",
                ["issuer"] = "https://appleid.apple.com",
                ["useJwksUrl"] = "true",
                ["validateSignature"] = "true",
                ["disableUserInfo"] = "true",
                ["disableTypeClaimCheck"] = "true",
                ["clientAuthMethod"] = "client_secret_post",
                ["defaultScope"] = "openid name email",
            }, hidden));
        }
        return providers;
    }

    /// <summary>Apple's authorize endpoint, answering by form post (the only way it will with name and email asked for)</summary>
    public const string AppleAuthorizationUrl = "https://appleid.apple.com/auth/authorize?response_mode=form_post";

    private static JsonObject Provider(string alias, string providerId, string displayName, SocialProviderOptions app, JsonObject config, bool hidden = true)
    {
        config["clientId"] = app.ClientId;
        config["clientSecret"] = app.ClientSecret;
        config["syncMode"] = "IMPORT";
        return new JsonObject
        {
            ["alias"] = alias,
            ["displayName"] = displayName,
            ["providerId"] = providerId,
            ["enabled"] = true,
            // The provider has already verified the address; asking the business's customer to verify it again is a dead end on a phone
            ["trustEmail"] = true,
            ["storeToken"] = false,
            ["addReadTokenRoleOnCreate"] = false,
            ["authenticateByDefault"] = false,
            ["linkOnly"] = false,
            // Keycloak 26 keeps this on the representation; the old config.hideOnLoginPage is gone
            ["hideOnLogin"] = hidden,
            ["updateProfileFirstLoginMode"] = hidden ? "on" : "off",
            ["firstBrokerLoginFlowAlias"] = "first broker login",
            ["config"] = config,
        };
    }

    /// <summary>
    /// A realm's phone field held to the country the business is in now (PhoneRules), as the template
    /// stamps it at creation: a realm made before the pattern existed, or for another country before
    /// the business moved, took numbers the stack then refused, or kept ones without their trunk zero.
    /// True when anything changed.
    /// </summary>
    public static bool WithPhoneRule(JsonArray attributes, string? country)
    {
        if (attributes.OfType<JsonObject>().FirstOrDefault(a => a["name"]?.GetValue<string>() == "phoneNumber") is not { } phone) return false;
        var before = phone.ToJsonString();
        var (pattern, placeholder) = PhoneRules.For(country);
        var validations = phone["validations"] as JsonObject ?? new JsonObject();
        phone["validations"] = validations;
        validations["pattern"] = new JsonObject { ["pattern"] = pattern, ["error-message"] = "invalidPhone" };
        var annotations = phone["annotations"] as JsonObject ?? new JsonObject();
        phone["annotations"] = annotations;
        annotations["inputType"] = "html5-tel";
        annotations["inputTypePlaceholder"] = placeholder;
        return phone.ToJsonString() != before;
    }

    /// <summary>
    /// A realm's user-profile attributes brought to the first and last name the apps ask for: first
    /// name labelled as such, last name the customer's to see, edit and fill in, right after it.
    /// True when anything changed.
    /// </summary>
    public static bool WithNameFields(JsonArray attributes)
    {
        var first = attributes.OfType<JsonObject>().FirstOrDefault(a => a["name"]?.GetValue<string>() == "firstName");
        var last = attributes.OfType<JsonObject>().FirstOrDefault(a => a["name"]?.GetValue<string>() == "lastName");
        if (first is null || last is null) return false;

        var before = attributes.ToJsonString();
        first["displayName"] = "${firstName}";
        last["displayName"] = "${lastName}";
        last["permissions"] = new JsonObject { ["view"] = new JsonArray("admin", "user"), ["edit"] = new JsonArray("admin", "user") };
        last["required"] = new JsonObject { ["roles"] = new JsonArray("user") };
        // Right after the first name, so every form built from the profile asks for them together
        var at = attributes.IndexOf(last);
        if (at != attributes.IndexOf(first) + 1)
        {
            attributes.RemoveAt(at);
            attributes.Insert(attributes.IndexOf(first) + 1, last);
        }
        return attributes.ToJsonString() != before;
    }

    /// <summary>
    /// The hub realm itself: no registration, no passwords, nothing a person signs in to by hand. Two
    /// people who share an address at Google and at Apple are two pass-through records rather than a
    /// prompt to link accounts nobody asked to link.
    /// </summary>
    public static JsonObject HubRealm() => new()
    {
        ["realm"] = TenantNaming.HubRealm,
        ["enabled"] = true,
        ["displayName"] = "Ninja",
        ["loginTheme"] = "ninja",
        ["sslRequired"] = "external",
        ["registrationAllowed"] = false,
        ["resetPasswordAllowed"] = false,
        ["rememberMe"] = false,
        ["duplicateEmailsAllowed"] = true,
        ["loginWithEmailAllowed"] = false,
        ["editUsernameAllowed"] = false,
    };

    /// <summary>
    /// A business's client in the hub for one provider: its only redirect is the business realm's broker
    /// endpoint for it, and its browser flow is the hub's straight-to-that-provider one.
    /// </summary>
    public static JsonObject HubClient(string slug, string provider, string secret, string flowId, PlatformOptions platform) => new()
    {
        ["clientId"] = TenantNaming.HubClient(slug, provider),
        ["name"] = $"{slug} / {provider}",
        ["enabled"] = true,
        ["protocol"] = "openid-connect",
        ["publicClient"] = false,
        ["secret"] = secret,
        ["standardFlowEnabled"] = true,
        ["implicitFlowEnabled"] = false,
        ["directAccessGrantsEnabled"] = false,
        ["serviceAccountsEnabled"] = false,
        ["redirectUris"] = new JsonArray(BrokerEndpoint(slug, provider, platform)),
        ["webOrigins"] = new JsonArray(),
        ["attributes"] = new JsonObject { ["pkce.code.challenge.method"] = "S256" },
        ["authenticationFlowBindingOverrides"] = new JsonObject { ["browser"] = flowId },
    };

    /// <summary>Where the hub hands a person back to the business's realm for one provider.</summary>
    public static string BrokerEndpoint(string slug, string provider, PlatformOptions platform)
        => $"{platform.KeycloakPublicUrl.TrimEnd('/')}/realms/{TenantNaming.Realm(slug)}/broker/{TenantNaming.BrokerAlias(provider)}/endpoint";

    /// <summary>
    /// The business realm's own "Google" or "Apple" for the browser: plain OIDC against its client in the
    /// hub. Shown on the business's login page; the browser goes to the hub only (the one address the
    /// providers know), Keycloak itself to the hub's tokens and keys on the network. The customer is
    /// created in the business's realm from the hub's token, and asked there for what the business needs
    /// (a phone number) that Google and Apple do not give.
    /// </summary>
    public static JsonObject TenantBroker(string slug, string provider, string secret, PlatformOptions platform)
    {
        var browser = $"{platform.KeycloakPublicUrl.TrimEnd('/')}/realms/{TenantNaming.HubRealm}/protocol/openid-connect";
        var network = $"{platform.KeycloakInternalUrl.TrimEnd('/')}/realms/{TenantNaming.HubRealm}/protocol/openid-connect";
        return new JsonObject
        {
            ["alias"] = TenantNaming.BrokerAlias(provider),
            ["displayName"] = provider == "apple" ? "Apple" : "Google",
            ["providerId"] = "oidc",
            ["enabled"] = true,
            ["trustEmail"] = true,
            ["storeToken"] = false,
            ["addReadTokenRoleOnCreate"] = false,
            ["authenticateByDefault"] = false,
            ["linkOnly"] = false,
            ["hideOnLogin"] = false,
            ["updateProfileFirstLoginMode"] = "on",
            ["firstBrokerLoginFlowAlias"] = "first broker login",
            ["config"] = new JsonObject
            {
                ["clientId"] = TenantNaming.HubClient(slug, provider),
                ["clientSecret"] = secret,
                ["clientAuthMethod"] = "client_secret_post",
                ["authorizationUrl"] = $"{browser}/auth",
                ["tokenUrl"] = $"{network}/token",
                ["jwksUrl"] = $"{network}/certs",
                ["useJwksUrl"] = "true",
                ["validateSignature"] = "true",
                // The hub's token carries the name and the address already
                ["disableUserInfo"] = "true",
                ["defaultScope"] = "openid profile email",
                ["pkceEnabled"] = "true",
                ["pkceMethod"] = "S256",
                ["syncMode"] = "IMPORT",
                ["guiOrder"] = provider == "apple" ? "2" : "1",
            },
        };
    }

    /// <summary>
    /// What Tenant.API tells the apps about signing in with Google or Apple ("google=ninja-google,
    /// apple=ninja-apple": each provider, and the hint the browser app sends for it); null when the
    /// business has it off or the platform holds no app.
    /// </summary>
    public static string? SocialSignIn(Tenant tenant, PlatformOptions platform)
    {
        var kinds = SocialKinds(platform);
        return tenant.SocialSignIn && kinds.Count > 0 ? string.Join(',', kinds.Select(k => $"{k}={TenantNaming.BrokerAlias(k)}")) : null;
    }

    /// <summary>What Keycloak's account-console client is given (see <see cref="IKeycloakAdmin.EnsureAccountConsoleAsync"/>): whichever of these the realm has.</summary>
    public static readonly string[] AccountConsoleScopes = ["basic", "openid", "profile", "email", "roles"];

    public const string ClientRolesMapperType = "oidc-usermodel-client-role-mapper";

    /// <summary>Client roles into the access token as resource_access.{client}.roles, the way Keycloak's own roles scope carries them.</summary>
    public static JsonObject ClientRolesMapper() => new()
    {
        ["name"] = "client roles",
        ["protocol"] = "openid-connect",
        ["protocolMapper"] = ClientRolesMapperType,
        ["consentRequired"] = false,
        ["config"] = new JsonObject
        {
            ["multivalued"] = "true",
            ["claim.name"] = "resource_access.${client_id}.roles",
            ["jsonType.label"] = "String",
            ["id.token.claim"] = "false",
            ["access.token.claim"] = "true",
            ["introspection.token.claim"] = "true",
            ["userinfo.token.claim"] = "false",
        },
    };

    /// <summary>The platform's own realm, for the people who run Ninja.</summary>
    public static string PlatformRealm(PlatformOptions platform, string initialPassword)
        => Render(Read("platform-realm.json"), new Dictionary<string, string>
        {
            ["controlUrl"] = platform.ControlUrl,
            ["platformDomain"] = platform.Domain,
            ["platformPassword"] = JsonEscape(initialPassword),
            ["sslRequired"] = SslRequired(platform),
            ["smtpServer"] = SmtpServerJson(platform.Mail),
        });

    /// <summary>Keycloak's smtpServer map (every value a string) from the platform's mail settings, so a realm can send its own password resets; {} while mail is off.</summary>
    public static string SmtpServerJson(MailOptions mail)
    {
        if (!mail.Configured) return "{}";
        var auth = !string.IsNullOrEmpty(mail.User);
        var map = new Dictionary<string, string>
        {
            ["host"] = mail.Host!,
            ["port"] = mail.Port.ToString(System.Globalization.CultureInfo.InvariantCulture),
            ["from"] = mail.From,
            ["fromDisplayName"] = mail.FromName,
            ["auth"] = auth ? "true" : "false",
            ["starttls"] = mail.UseStartTls ? "true" : "false",
            ["ssl"] = "false",
        };
        if (auth)
        {
            map["user"] = mail.User!;
            map["password"] = mail.Password ?? "";
        }
        return System.Text.Json.JsonSerializer.Serialize(map);
    }

    private static string JsonEscape(string s) => System.Text.Json.JsonEncodedText.Encode(s).ToString();

    /// <summary>
    /// The stack: the services the plan runs (at most twelve) and a gateway,
    /// every name prefixed with the slug so nothing collides on the shared
    /// network, wired to the shared Postgres (its own databases), the shared
    /// broker (its own vhost) and the shared Keycloak (its own realm).
    /// </summary>
    public static string Compose(Tenant tenant, TenantHosts hosts, PlatformOptions platform)
    {
        var slug = tenant.Slug;
        var entitled = PlanCatalog.Entitlements(tenant);
        var services = PlanCatalog.Services(entitled);
        var sb = new StringBuilder();
        sb.AppendLine($"# {TenantNaming.Project(slug)} — stamped by the Ninja control plane; edits are overwritten on upgrade");
        sb.AppendLine($"name: {TenantNaming.Project(slug)}");
        sb.AppendLine("services:");

        foreach (var service in services)
        {
            var name = TenantNaming.Service(slug, service);
            sb.AppendLine($"  {name}:");
            // Releases before Branch.API became Tenant.API have no ninja-tenant image: a stack cannot be rolled back past the rename
            sb.AppendLine($"    image: \"{platform.ImageRegistry}-{service}:{tenant.ImageTag}\"");
            sb.AppendLine("    restart: \"unless-stopped\"");
            AppendLimits(sb, platform.MemoryFor(service), platform.ServiceCpus, platform);
            sb.AppendLine("    environment:");
            sb.AppendLine("      ASPNETCORE_ENVIRONMENT: \"Production\"");
            // Nothing changes appsettings inside a container: watching it only spends the
            // kernel's inotify allowance every container on the box shares
            sb.AppendLine("      DOTNET_hostBuilder__reloadConfigOnChange: \"false\"");
            sb.AppendLine("      ASPNETCORE_FORWARDEDHEADERS_ENABLED: \"true\"");
            sb.AppendLine("      HTTP_PORTS: \"8080\"");
            // Its own broker user and database role, allowed nothing beyond this vhost and these databases
            sb.AppendLine($"      ConnectionStrings__eventbus: \"amqp://{TenantNaming.BrokerUser(slug)}:${{BROKER_PASSWORD}}@{platform.RabbitHost}:5672/{TenantNaming.VHost(slug)}\"");
            sb.AppendLine($"      Identity__Url: \"{platform.KeycloakInternalUrl}/realms/{TenantNaming.Realm(slug)}\"");
            sb.AppendLine($"      Keycloak__Realm: \"{TenantNaming.Realm(slug)}\"");
            sb.AppendLine($"      OTEL_SERVICE_NAME: \"{name}\"");
            sb.AppendLine($"      Seed__Profile: \"{tenant.Seed.ToString().ToLowerInvariant()}\"");
            // A sample stack plants a menu and a floor for its kind of place
            sb.AppendLine($"      Tenant__BusinessType: \"{BusinessProfiles.Key(tenant.BusinessType)}\"");
            // Every service formats, rolls its day over and reads its offers in the tenant's locale
            sb.AppendLine($"      Tenant__Country: \"{tenant.Country}\"");
            sb.AppendLine($"      Tenant__Currency: \"{tenant.Currency}\"");
            sb.AppendLine($"      Tenant__TimeZone: \"{tenant.TimeZone}\"");
            sb.AppendLine($"      Tenant__DefaultLanguage: \"{tenant.DefaultLanguage}\"");
            sb.AppendLine($"      Tenant__ArabicStyle: \"{tenant.ArabicStyle}\"");
            sb.AppendLine($"      Tenant__ContentLanguages: \"{tenant.ContentLanguages}\"");

            var db = service switch
            {
                "identity" or "assistant" => null,
                "notification" => "notificationdb",
                _ => $"{service}db",
            };
            if (db is not null)
            {
                // A bounded pool per service, so the shared Postgres has a budget the capacity guard can count
                sb.AppendLine($"      ConnectionStrings__{db}: \"Host={platform.PostgresHost};Port={platform.PostgresPort};Username={TenantNaming.DbRole(slug)};Password=${{DB_PASSWORD}};Database={TenantNaming.Database(slug, db)};Maximum Pool Size={platform.ServicePoolSize};Minimum Pool Size=0\"");
            }

            switch (service)
            {
                case "catalog":
                    sb.AppendLine($"      CatalogOptions__PicBaseUrl: \"{hosts.ApiUrl}\"");
                    AppendChatModel(sb, tenant, platform);
                    // Talabat: the menu and what is sold out go out through the relay, like the orders' answers
                    if (platform.Talabat.Configured) AppendTalabatRelay(sb, slug, platform);
                    // Uploaded pictures are written under the content root; without a volume an upgrade loses them
                    sb.AppendLine("    volumes:");
                    sb.AppendLine($"      - \"{TenantNaming.PicsVolume(slug)}:/app/Pics\"");
                    break;
                case "inventory":
                case "finance":
                    AppendChatModel(sb, tenant, platform);
                    break;
                case "identity":
                    sb.AppendLine("      Keycloak__AdminClientId: \"identity-api-service\"");
                    sb.AppendLine("      Keycloak__AdminClientSecret: \"${IDENTITY_SECRET}\"");
                    break;
                case "assistant":
                    // The MCP endpoint as a chat app reaches it, the realm's public issuer, and the token-exchange client
                    sb.AppendLine($"      Assistant__PublicUrl: \"{hosts.ApiUrl}/mcp\"");
                    sb.AppendLine($"      Assistant__Issuer: \"{platform.KeycloakPublicUrl}/realms/{TenantNaming.Realm(slug)}\"");
                    sb.AppendLine("      Assistant__TokenExchange__ClientId: \"assistant-api\"");
                    sb.AppendLine("      Assistant__TokenExchange__ClientSecret: \"${ASSISTANT_SECRET}\"");
                    // It calls the other services by their Aspire names; service discovery reads these. A service the plan
                    // leaves out gets no line, so its name does not resolve and the tools say "not in this business's plan".
                    foreach (var target in new[] { "tenant", "sales", "finance", "inventory", "ordering", "payroll", "catalog" })
                        if (services.Contains(target))
                            sb.AppendLine($"      services__{target}-api__http__0: \"http://{TenantNaming.Service(slug, target)}:8080\"");
                    break;
                case "sales":
                    // Online payments: the key the business's provider secrets are sealed with, and where the provider calls back
                    sb.AppendLine("      Payments__Key: \"${PAYMENTS_KEY}\"");
                    sb.AppendLine($"      Payments__CallbackBaseUrl: \"{hosts.ApiUrl}\"");
                    sb.AppendLine($"      Payments__ReturnBaseUrl: \"{hosts.CustomerUrl}\"");
                    // A demo tries online payments with pretend payments until it has a Paymob account; a customer never can
                    if (tenant.Kind == TenantKind.Demo) sb.AppendLine("      Payments__Simulated: \"true\"");
                    break;
                case "notification" when !string.IsNullOrWhiteSpace(platform.FirebaseCredentialsPath):
                    // Push: the platform's Firebase account, read where the service looks for it
                    sb.AppendLine("    volumes:");
                    sb.AppendLine($"      - \"{platform.FirebaseCredentialsPath}:/app/firebase-credentials.json:ro\"");
                    break;
                case "ordering" when platform.Talabat.Configured:
                    // Talabat: what the business does with its orders goes back through the platform's relay, which holds Ninja's account
                    AppendTalabatRelay(sb, slug, platform);
                    break;
                case "tenant":
                    if (!string.IsNullOrEmpty(tenant.NameEn)) sb.AppendLine($"      Tenant__Name__En: \"{Yaml(tenant.NameEn)}\"");
                    if (!string.IsNullOrEmpty(tenant.NameAr)) sb.AppendLine($"      Tenant__Name__Ar: \"{Yaml(tenant.NameAr)}\"");
                    if (!string.IsNullOrEmpty(tenant.PrimaryColor)) sb.AppendLine($"      Tenant__PrimaryColor: \"{tenant.PrimaryColor}\"");
                    sb.AppendLine($"      Tenant__CustomerUrl: \"{hosts.CustomerUrl}\"");
                    sb.AppendLine($"      Tenant__AuthUrl: \"{platform.KeycloakPublicUrl}/realms/{TenantNaming.Realm(slug)}\"");
                    if (SocialSignIn(tenant, platform) is { } social) sb.AppendLine($"      Tenant__SocialSignIn: \"{social}\"");
                    // The native till and kitchen apps: the host a tablet connects to, and where it downloads them
                    sb.AppendLine($"      Tenant__ApiUrl: \"{hosts.ApiUrl}\"");
                    sb.AppendLine($"      Tenant__AppsUrl: \"{platform.AppsUrl}\"");
                    sb.AppendLine("      Storage__Path: \"/app/uploads\"");
                    sb.AppendLine("    volumes:");
                    sb.AppendLine($"      - \"{TenantNaming.UploadsVolume(slug)}:/app/uploads\"");
                    break;
            }

            sb.AppendLine("    networks:");
            sb.AppendLine($"      - \"{platform.Network}\"");
        }

        // The gateway: the same YARP the single stack ran, routes as the AppHost declares them, destinations prefixed
        var gateway = TenantNaming.Gateway(slug);
        sb.AppendLine($"  {gateway}:");
        sb.AppendLine($"    image: \"{platform.GatewayImage}\"");
        sb.AppendLine("    restart: \"unless-stopped\"");
        AppendLimits(sb, platform.GatewayMemoryMb, platform.GatewayCpus, platform);
        sb.AppendLine("    entrypoint: [\"dotnet\"]");
        sb.AppendLine("    command: [\"/app/yarp.dll\"]");
        sb.AppendLine("    environment:");
        sb.AppendLine("      ASPNETCORE_ENVIRONMENT: \"Production\"");
        sb.AppendLine("      DOTNET_hostBuilder__reloadConfigOnChange: \"false\"");
        sb.AppendLine("      Kestrel__EndpointDefaults__Protocols: \"Http1AndHttp2\"");
        sb.AppendLine("      HTTP_PORTS: \"5000\"");
        var i = 0;
        foreach (var (path, cluster, versions, transforms) in GatewayRoutes(entitled))
        {
            var r = $"REVERSEPROXY__ROUTES__route{i++}";
            sb.AppendLine($"      {r}__MATCH__PATH: \"{path}\"");
            sb.AppendLine($"      {r}__CLUSTERID: \"{cluster}\"");
            // A blocked route answers before anything a catch-all could say about the same path
            if (cluster == "tenant" && transforms.Any(t => t.Any(kv => kv.Item1 == "PathSet" && kv.Item2 == ModuleOffPath)))
                sb.AppendLine($"      {r}__ORDER: \"-1\"");
            // ...and a path that must pass anyway answers before the block
            else if (PlanCatalog.AlwaysOpen.Any(o => o.Path == path && !entitled.Contains(o.Module)))
                sb.AppendLine($"      {r}__ORDER: \"-2\"");
            if (versions is not null)
            {
                sb.AppendLine($"      {r}__MATCH__QUERYPARAMETERS__0__NAME: \"api-version\"");
                for (var v = 0; v < versions.Length; v++)
                    sb.AppendLine($"      {r}__MATCH__QUERYPARAMETERS__0__VALUES__{v}: \"{versions[v]}\"");
            }
            // One transform is one object: X-Forwarded and its HeaderPrefix share an index
            for (var t = 0; t < transforms.Length; t++)
                foreach (var (key, value) in transforms[t])
                    sb.AppendLine($"      {r}__TRANSFORMS__{t}__{key}: \"{value}\"");
        }
        foreach (var service in services)
            sb.AppendLine($"      REVERSEPROXY__CLUSTERS__{service}__DESTINATIONS__d1__ADDRESS: \"http://{TenantNaming.Service(slug, service)}:8080\"");
        sb.AppendLine("    networks:");
        sb.AppendLine($"      - \"{platform.Network}\"");

        sb.AppendLine("networks:");
        sb.AppendLine($"  {platform.Network}:");
        sb.AppendLine("    external: true");
        sb.AppendLine("volumes:");
        sb.AppendLine($"  {TenantNaming.UploadsVolume(slug)}: {{}}");
        sb.AppendLine($"  {TenantNaming.PicsVolume(slug)}: {{}}");
        return sb.ToString();
    }

    /// <summary>The stack's .env: its own secrets and nothing of the platform's (the superuser and the shared broker user stay on the control plane).</summary>
    public static string Env(Tenant tenant, PlatformOptions platform)
    {
        if (!tenant.HasOwnCredentials)
            throw new InvalidOperationException($"{tenant.Slug} has no credentials of its own yet; the credentials step runs first");
        return string.Join('\n',
        [
            $"DB_PASSWORD={tenant.DbPassword}",
            $"BROKER_PASSWORD={tenant.BrokerPassword}",
            $"IDENTITY_SECRET={tenant.IdentitySecret}",
            $"ASSISTANT_SECRET={tenant.AssistantSecret}",
            $"PAYMENTS_KEY={tenant.PaymentsKey}",
            // The business's key to the Talabat relay, derived from the platform's key; only when the platform has a Talabat account
            $"TALABAT_RELAY_KEY={(platform.Talabat.Configured && !string.IsNullOrWhiteSpace(platform.EncryptionKey) ? TalabatNaming.RelayKey(tenant.Slug, platform.EncryptionKey) : "")}",
            // The business's own key to the platform's AI gateway, only when its plan includes the assistant; no provider's key ever reaches a stack
            $"AI_GATEWAY_KEY={(platform.AssistantFor(tenant) ? AiGatewayKeys.For(tenant.Slug, platform.EncryptionKey) : "")}",
            "",
        ]);
    }

    /// <summary>
    /// One Caddy site per business on its own domain, proxied to that business's
    /// gateway; imported by the platform Caddyfile, rewritten on every
    /// provision and destroy. The wildcard blocks cover the platform hosts.
    /// </summary>
    public static string CustomDomains(IEnumerable<Tenant> tenants, PlatformOptions platform)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# Businesses on their own domains, written by the control plane; do not edit.");
        foreach (var tenant in tenants.Where(t => !string.IsNullOrEmpty(t.CustomerDomain)).OrderBy(t => t.Slug))
        {
            sb.AppendLine();
            sb.AppendLine($"https://{tenant.CustomerDomain} {{");
            sb.AppendLine("\ttls {");
            sb.AppendLine("\t\ton_demand");
            sb.AppendLine("\t}");
            // Only the control app and the business's own admin may frame the customer app (their live brand previews)
            sb.AppendLine($"\theader Content-Security-Policy \"frame-ancestors 'self' {platform.ControlUrl.TrimEnd('/')} {TenantHosts.For(tenant, platform).AdminUrl}\"");
            sb.AppendLine($"\timport tenant_api {TenantNaming.Gateway(tenant.Slug)}");
            sb.AppendLine("\thandle {");
            sb.AppendLine("\t\timport spa /srv/client-web");
            sb.AppendLine("\t}");
            // The paused answer is its own snippet, not part of tenant_api: a business on its
            // own domain must hear the same {"code":"paused"} as one on {slug}.{domain},
            // or its app shows a bare 502 while the stack is suspended
            sb.AppendLine("\timport paused_api");
            sb.AppendLine("}");
        }
        return sb.ToString();
    }

    /// <summary>What the container may take: compose applies deploy.resources.limits without swarm (pids belongs in there too, or compose sees two values); the log cap sits beside it.</summary>
    private static void AppendLimits(StringBuilder sb, int memoryMb, double cpus, PlatformOptions platform)
    {
        sb.AppendLine("    deploy:");
        sb.AppendLine("      resources:");
        sb.AppendLine("        limits:");
        sb.AppendLine($"          memory: \"{memoryMb}M\"");
        sb.AppendLine($"          cpus: \"{cpus.ToString("0.0#", CultureInfo.InvariantCulture)}\"");
        sb.AppendLine($"          pids: {platform.PidsLimit}");
        sb.AppendLine("    logging:");
        sb.AppendLine("      driver: \"json-file\"");
        sb.AppendLine("      options:");
        sb.AppendLine($"        max-size: \"{platform.LogMaxSize}\"");
        sb.AppendLine($"        max-file: \"{platform.LogMaxFile}\"");
    }

    private static void AppendTalabatRelay(StringBuilder sb, string slug, PlatformOptions platform)
    {
        sb.AppendLine($"      Talabat__RelayUrl: \"{platform.Talabat.RelayUrl}\"");
        sb.AppendLine($"      Talabat__Tenant: \"{slug}\"");
        sb.AppendLine("      Talabat__RelayKey: \"${TALABAT_RELAY_KEY}\"");
    }

    private static void AppendChatModel(StringBuilder sb, Tenant tenant, PlatformOptions platform)
    {
        // No connection string, no assistant: the services report it off and answer 503
        if (!platform.AssistantFor(tenant))
            return;
        // The gateway, which answers each role with whatever model the control panel points it at now: the stack names roles, not models
        sb.AppendLine($"      ConnectionStrings__chatModel: \"Endpoint={platform.AiGatewayUrl};Key=${{AI_GATEWAY_KEY}};Model={AiRoles.Main}\"");
        sb.AppendLine($"      AI__FallbackModel: \"{AiRoles.Fallback}\"");
        sb.AppendLine($"      AI__VisionModel: \"{AiRoles.Vision}\"");
    }

    /// <summary>The gateway's route table, the one ConfigureMobileBffRoutes declares; kept in step by tests/Ninja.Contracts.Tests.</summary>
    internal static IEnumerable<(string Path, string Cluster, string[]? Versions, (string, string)[][] Transforms)> GatewayRoutes()
    {
        (string, string)[][] forwarded = [[("X-Forwarded", "Set"), ("HeaderPrefix", "X-Forwarded-")]];
        (string, string)[][] none = [];
        string[] v1 = ["1.0", "1"];
        yield return ("/api/catalog/items/{id}/pic", "catalog", null, forwarded);
        yield return ("/api/catalog/{*any}", "catalog", ["1.0", "1", "2.0"], forwarded);
        yield return ("/api/orders/{*any}", "ordering", v1, none);
        // The kitchen's stations and its printers' queue live in Ordering too
        yield return ("/api/kitchen/{*any}", "ordering", v1, none);
        yield return ("/api/places/{*any}", "spaces", v1, none);
        yield return ("/api/reservations/{*any}", "spaces", v1, none);
        yield return ("/api/stays/{*any}", "spaces", v1, none);
        yield return ("/api/tickets/{*any}", "sales", v1, none);
        yield return ("/api/shifts/{*any}", "sales", v1, none);
        // Online payments; the provider's callback carries no api-version and is never blocked
        yield return ("/api/sales/payments/paymob/callback", "sales", null, none);
        yield return ("/api/sales/payments/{*any}", "sales", v1, none);
        yield return ("/api/inventory/{*any}", "inventory", v1, none);
        yield return ("/api/payroll/{*any}", "payroll", v1, none);
        yield return ("/api/finance/{*any}", "finance", v1, none);
        yield return ("/api/identity/{*any}", "identity", null, none);
        yield return ("/api/loyalty/{*any}", "loyalty", v1, none);
        yield return ("/api/notifications/{*any}", "notification", null, none);
        yield return ("/hub/{*any}", "notification", null, none);
        yield return ("/api/accounts/{*any}", "accounts", v1, none);
        yield return ("/api/branches/{*any}", "tenant", null, none);
        yield return ("/api/tenant/{*any}", "tenant", null, forwarded);
        // The owner's MCP server and its OAuth protected-resource document (RFC 9728), path-aware and at the root
        yield return ("/mcp", "assistant", null, forwarded);
        yield return ("/mcp/{*any}", "assistant", null, forwarded);
        yield return ("/.well-known/oauth-protected-resource", "assistant", null, forwarded);
        yield return ("/.well-known/oauth-protected-resource/{*any}", "assistant", null, forwarded);
        foreach (var service in TenantNaming.Services)
            yield return ($"/health/{service}", service, null, [[("PathSet", "/health")]]);
    }

    /// <summary>Where the gateway sends a request for a module the plan does not include: Tenant.API answers 402.</summary>
    internal const string ModuleOffPath = "/api/tenant/module-off";

    /// <summary>
    /// The same table with a module that is not entitled taken out: its
    /// routes keep their paths (never a duplicate template) but point at
    /// Tenant.API's 402 page, and Reservations and Time billing additionally
    /// block their place routes one by one, since /api/places itself serves
    /// tables and stations. A module's own service (inventory, finance,
    /// payroll, loyalty, accounts) is not stamped at all when the module is
    /// not entitled, so no route points at it: after the 402 re-pointing that
    /// is its health probe.
    /// </summary>
    internal static IEnumerable<(string Path, string Cluster, string[]? Versions, (string, string)[][] Transforms)> GatewayRoutes(IReadOnlySet<Module> entitled)
    {
        var blocked = PlanCatalog.Routes.Where(r => !entitled.Contains(r.Module)).ToDictionary(r => r.Path, r => r.Module);
        var services = PlanCatalog.Services(entitled).ToHashSet();
        foreach (var route in GatewayRoutes())
        {
            if (blocked.Remove(route.Path, out var module))
                yield return Block(route.Path, module);
            else if (services.Contains(route.Cluster))
                yield return route;
        }
        // The reserving and timed routes under /api/places are not in the table: they are only ever added, to block
        foreach (var (path, module) in blocked)
            yield return Block(path, module);
    }

    private static (string, string, string[]?, (string, string)[][]) Block(string path, Module module)
        => (path, "tenant", null, [[("PathSet", ModuleOffPath)], [("QueryValueParameter", "module"), ("Set", PlanCatalog.Key(module))]]);

    private static string Yaml(string s) => s.Replace("\\", "\\\\").Replace("\"", "\\\"");
}
