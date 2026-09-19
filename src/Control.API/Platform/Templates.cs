using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>
/// The files a tenant is stamped from, as embedded resources with
/// {{placeholder}} slots. The compose file is built here rather than kept as
/// a template because its shape (twelve services and a gateway) is the
/// AppHost's shape, and the names must not collide on the shared network.
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
    public static string TenantRealm(Tenant tenant, TenantHosts hosts)
        => Render(Read("tenant-realm.json"), new Dictionary<string, string>
        {
            ["slug"] = tenant.Slug,
            ["displayName"] = JsonEscape(tenant.NameEn),
            ["customerUrl"] = hosts.CustomerUrl,
            ["adminUrl"] = hosts.AdminUrl,
            ["posUrl"] = hosts.PosUrl,
            ["kdsUrl"] = hosts.KdsUrl,
            ["identitySecret"] = tenant.IdentitySecret,
            ["controlSecret"] = tenant.ControlSecret,
        });

    /// <summary>The platform's own realm, for the people who run Ninja.</summary>
    public static string PlatformRealm(PlatformOptions platform, string initialPassword)
        => Render(Read("platform-realm.json"), new Dictionary<string, string>
        {
            ["controlUrl"] = platform.ControlUrl,
            ["platformDomain"] = platform.Domain,
            ["platformPassword"] = JsonEscape(initialPassword),
        });

    private static string JsonEscape(string s) => System.Text.Json.JsonEncodedText.Encode(s).ToString();

    /// <summary>
    /// The stack: twelve services and a gateway, every name prefixed with the
    /// slug so nothing collides on the shared network, wired to the shared
    /// Postgres (its own databases), the shared broker (its own vhost) and
    /// the shared Keycloak (its own realm).
    /// </summary>
    public static string Compose(Tenant tenant, TenantHosts hosts, PlatformOptions platform)
    {
        var slug = tenant.Slug;
        var sb = new StringBuilder();
        sb.AppendLine($"# {TenantNaming.Project(slug)} — stamped by the Ninja control plane; edits are overwritten on upgrade");
        sb.AppendLine($"name: {TenantNaming.Project(slug)}");
        sb.AppendLine("services:");

        foreach (var service in TenantNaming.Services)
        {
            var name = TenantNaming.Service(slug, service);
            sb.AppendLine($"  {name}:");
            sb.AppendLine($"    image: \"{platform.ImageRegistry}-{service}:{tenant.ImageTag}\"");
            sb.AppendLine("    restart: \"unless-stopped\"");
            sb.AppendLine("    environment:");
            sb.AppendLine("      ASPNETCORE_ENVIRONMENT: \"Production\"");
            sb.AppendLine("      ASPNETCORE_FORWARDEDHEADERS_ENABLED: \"true\"");
            sb.AppendLine("      HTTP_PORTS: \"8080\"");
            sb.AppendLine($"      ConnectionStrings__eventbus: \"amqp://{platform.RabbitUser}:${{RABBIT_PASSWORD}}@{platform.RabbitHost}:5672/{TenantNaming.VHost(slug)}\"");
            sb.AppendLine($"      Identity__Url: \"{platform.KeycloakInternalUrl}/realms/{TenantNaming.Realm(slug)}\"");
            sb.AppendLine($"      Keycloak__Realm: \"{TenantNaming.Realm(slug)}\"");
            sb.AppendLine($"      OTEL_SERVICE_NAME: \"{name}\"");

            var db = service switch
            {
                "identity" => null,
                "notification" => "notificationdb",
                _ => $"{service}db",
            };
            if (db is not null)
            {
                sb.AppendLine($"      ConnectionStrings__{db}: \"Host={platform.PostgresHost};Port=5432;Username={platform.PostgresUser};Password=${{POSTGRES_PASSWORD}};Database={TenantNaming.Database(slug, db)}\"");
            }

            switch (service)
            {
                case "catalog":
                    sb.AppendLine($"      CatalogOptions__PicBaseUrl: \"{hosts.ApiUrl}\"");
                    AppendChatModel(sb, platform);
                    break;
                case "inventory":
                case "finance":
                    AppendChatModel(sb, platform);
                    break;
                case "identity":
                    sb.AppendLine("      Keycloak__AdminClientId: \"identity-api-service\"");
                    sb.AppendLine("      Keycloak__AdminClientSecret: \"${IDENTITY_SECRET}\"");
                    break;
                case "branch":
                    sb.AppendLine($"      Tenant__Name__En: \"{Yaml(tenant.NameEn)}\"");
                    if (!string.IsNullOrEmpty(tenant.NameAr)) sb.AppendLine($"      Tenant__Name__Ar: \"{Yaml(tenant.NameAr)}\"");
                    if (!string.IsNullOrEmpty(tenant.PrimaryColor)) sb.AppendLine($"      Tenant__PrimaryColor: \"{tenant.PrimaryColor}\"");
                    sb.AppendLine($"      Tenant__CustomerUrl: \"{hosts.CustomerUrl}\"");
                    sb.AppendLine($"      Tenant__AuthUrl: \"{platform.KeycloakPublicUrl}/realms/{TenantNaming.Realm(slug)}\"");
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
        sb.AppendLine("    entrypoint: [\"dotnet\"]");
        sb.AppendLine("    command: [\"/app/yarp.dll\"]");
        sb.AppendLine("    environment:");
        sb.AppendLine("      ASPNETCORE_ENVIRONMENT: \"Production\"");
        sb.AppendLine("      Kestrel__EndpointDefaults__Protocols: \"Http1AndHttp2\"");
        sb.AppendLine("      HTTP_PORTS: \"5000\"");
        var i = 0;
        foreach (var (path, cluster, versions, transforms) in GatewayRoutes())
        {
            var r = $"REVERSEPROXY__ROUTES__route{i++}";
            sb.AppendLine($"      {r}__MATCH__PATH: \"{path}\"");
            sb.AppendLine($"      {r}__CLUSTERID: \"{cluster}\"");
            if (versions is not null)
            {
                sb.AppendLine($"      {r}__MATCH__QUERYPARAMETERS__0__NAME: \"api-version\"");
                for (var v = 0; v < versions.Length; v++)
                    sb.AppendLine($"      {r}__MATCH__QUERYPARAMETERS__0__VALUES__{v}: \"{versions[v]}\"");
            }
            var t = 0;
            foreach (var (key, value) in transforms)
                sb.AppendLine($"      {r}__TRANSFORMS__{t++}__{key}: \"{value}\"");
        }
        foreach (var service in TenantNaming.Services)
            sb.AppendLine($"      REVERSEPROXY__CLUSTERS__{service}__DESTINATIONS__d1__ADDRESS: \"http://{TenantNaming.Service(slug, service)}:8080\"");
        sb.AppendLine("    networks:");
        sb.AppendLine($"      - \"{platform.Network}\"");

        sb.AppendLine("networks:");
        sb.AppendLine($"  {platform.Network}:");
        sb.AppendLine("    external: true");
        sb.AppendLine("volumes:");
        sb.AppendLine($"  {TenantNaming.UploadsVolume(slug)}: {{}}");
        return sb.ToString();
    }

    /// <summary>The stack's .env: the shared secrets and its own.</summary>
    public static string Env(Tenant tenant, PlatformOptions platform)
        => string.Join('\n',
        [
            $"POSTGRES_PASSWORD={platform.PostgresPassword}",
            $"RABBIT_PASSWORD={platform.RabbitPassword}",
            $"IDENTITY_SECRET={tenant.IdentitySecret}",
            $"GEMINI_API_KEY={platform.GeminiApiKey ?? ""}",
            "",
        ]);

    /// <summary>
    /// One Caddy site per café on its own domain, proxied to that café's
    /// gateway; imported by the platform Caddyfile, rewritten on every
    /// provision and destroy. The wildcard blocks cover the platform hosts.
    /// </summary>
    public static string CustomDomains(IEnumerable<Tenant> tenants)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# Cafés on their own domains, written by the control plane; do not edit.");
        foreach (var tenant in tenants.Where(t => !string.IsNullOrEmpty(t.CustomerDomain)).OrderBy(t => t.Slug))
        {
            sb.AppendLine();
            sb.AppendLine($"https://{tenant.CustomerDomain} {{");
            sb.AppendLine("\ttls {");
            sb.AppendLine("\t\ton_demand");
            sb.AppendLine("\t}");
            sb.AppendLine($"\timport tenant_api {TenantNaming.Gateway(tenant.Slug)}");
            sb.AppendLine("\thandle {");
            sb.AppendLine("\t\timport spa /srv/client-web");
            sb.AppendLine("\t}");
            sb.AppendLine("}");
        }
        return sb.ToString();
    }

    private static void AppendChatModel(StringBuilder sb, PlatformOptions platform)
    {
        if (string.IsNullOrEmpty(platform.GeminiApiKey))
        {
            sb.AppendLine("      AI__Enabled: \"false\"");
            return;
        }
        sb.AppendLine("      ConnectionStrings__chatModel: \"Endpoint=https://generativelanguage.googleapis.com/v1beta/openai/;Key=${GEMINI_API_KEY};Model=gemini-3.8-flash\"");
    }

    /// <summary>The gateway's route table, the one ConfigureMobileBffRoutes declares; kept in step by tests/Ninja.Contracts.Tests.</summary>
    internal static IEnumerable<(string Path, string Cluster, string[]? Versions, (string, string)[] Transforms)> GatewayRoutes()
    {
        (string, string)[] forwarded = [("X-Forwarded", "Set"), ("HeaderPrefix", "X-Forwarded-")];
        (string, string)[] none = [];
        string[] v1 = ["1.0", "1"];
        yield return ("/api/catalog/items/{id}/pic", "catalog", null, forwarded);
        yield return ("/api/catalog/{*any}", "catalog", ["1.0", "1", "2.0"], forwarded);
        yield return ("/api/orders/{*any}", "ordering", v1, none);
        yield return ("/api/places/{*any}", "spaces", v1, none);
        yield return ("/api/stays/{*any}", "spaces", v1, none);
        yield return ("/api/rooms/{*any}", "spaces", v1, none);
        yield return ("/api/sessions/{*any}", "spaces", v1, none);
        yield return ("/api/tables/{*any}", "spaces", v1, none);
        yield return ("/api/tickets/{*any}", "sales", v1, none);
        yield return ("/api/shifts/{*any}", "sales", v1, none);
        yield return ("/api/inventory/{*any}", "inventory", v1, none);
        yield return ("/api/payroll/{*any}", "payroll", v1, none);
        yield return ("/api/finance/{*any}", "finance", v1, none);
        yield return ("/api/identity/{*any}", "identity", null, none);
        yield return ("/api/loyalty/{*any}", "loyalty", v1, none);
        yield return ("/api/notifications/{*any}", "notification", null, none);
        yield return ("/hub/{*any}", "notification", null, none);
        yield return ("/api/accounts/{*any}", "accounts", v1, none);
        yield return ("/api/branches/{*any}", "branch", null, none);
        yield return ("/api/tenant/{*any}", "branch", null, forwarded);
        foreach (var service in TenantNaming.Services)
            yield return ($"/health/{service}", service, null, [("PathSet", "/health")]);
    }

    private static string Yaml(string s) => s.Replace("\\", "\\\\").Replace("\"", "\\\"");
}
