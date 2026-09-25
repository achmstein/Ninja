using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>Everything that is named after the slug: hosts, project, databases, vhost, realm.</summary>
public static partial class TenantNaming
{
    /// <summary>The eleven databases every stack owns, in the service order of the AppHost.</summary>
    public static readonly string[] Databases =
    [
        "accountsdb", "catalogdb", "orderingdb", "spacesdb", "salesdb", "inventorydb",
        "payrolldb", "financedb", "loyaltydb", "tenantdb", "notificationdb",
    ];

    /// <summary>
    /// What a retired service left on the shared Postgres and broker: the
    /// database and the durable queue Branch.API had before it became
    /// Tenant.API. An upgrade drops them once the new stack answers; gone
    /// twice is nothing.
    /// </summary>
    public static readonly string[] RetiredDatabases = ["branchdb"];

    public static readonly string[] RetiredQueues = ["Branch"];

    /// <summary>Every service a stack can run, as image suffix → compose service suffix; PlanCatalog.Services says which a plan does.</summary>
    public static readonly string[] Services =
    [
        "catalog", "ordering", "spaces", "sales", "inventory", "payroll",
        "finance", "identity", "loyalty", "notification", "accounts", "tenant",
        // The owner's MCP server: no database, no bus, every plan
        "assistant",
    ];

    [GeneratedRegex("^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,23}$")]
    private static partial Regex SlugPattern();

    /// <summary>The words that would collide with the platform's own hosts or read badly on a URL.</summary>
    private static readonly HashSet<string> Reserved = new(StringComparer.OrdinalIgnoreCase)
    {
        "www", "api", "auth", "admin", "pos", "kds", "app", "control", "ninja", "platform", "mail", "status",
    };

    public static bool IsValidSlug(string? slug)
        => slug is not null && SlugPattern().IsMatch(slug) && !Reserved.Contains(slug);

    /// <summary>A slug from a name: lower-case ASCII letters and digits, dashes between words, 3–24 chars; null when nothing usable is left (an Arabic-only name).</summary>
    public static string? SlugFrom(string name)
    {
        var lowered = name.Trim().ToLowerInvariant();
        var chars = lowered.Select(c => char.IsAsciiLetterOrDigit(c) ? c : '-').ToArray();
        var collapsed = Regex.Replace(new string(chars), "-+", "-").Trim('-');
        if (collapsed.Length > 24) collapsed = collapsed[..24].TrimEnd('-');
        return IsValidSlug(collapsed) ? collapsed : null;
    }

    [GeneratedRegex("^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$")]
    private static partial Regex HostnamePattern();

    /// <summary>A public host name as a café would own one: lower-case RFC 1123 labels, at least two of them, a letter starting the last. Written into the edge's config, so nothing else may pass.</summary>
    public static bool IsValidHostname(string? host)
        => host is not null && HostnamePattern().IsMatch(host);

    public static string Project(string slug) => $"ninja-{slug}";

    /// <summary>The scratch tenant a restore drill stamps for a slug, within the 24 characters a slug may have.</summary>
    public static string DrillSlug(string slug) => $"drill-{slug}"[..Math.Min(24, slug.Length + 6)].TrimEnd('-');

    public static string Realm(string slug) => slug;

    public static string VHost(string slug) => slug;

    public static string Database(string slug, string db) => $"{slug}_{db}";

    /// <summary>The Postgres role that owns the tenant's databases and nothing else; _ is not a slug character, so it collides with no other tenant's name.</summary>
    public static string DbRole(string slug) => $"{slug}_app";

    /// <summary>The RabbitMQ user with permissions on the tenant's vhost alone.</summary>
    public static string BrokerUser(string slug) => $"{slug}_app";

    /// <summary>A compose service name, unique on the shared network: {slug}-{service}-api.</summary>
    public static string Service(string slug, string service) => $"{slug}-{service}-api";

    /// <summary>The durable queue a service consumes in the tenant's vhost: its EventBus:SubscriptionClientName, which every service spells as its own name capitalised (Inventory, Finance, …).</summary>
    public static string Queue(string service) => char.ToUpperInvariant(service[0]) + service[1..];

    /// <summary>Whether the service consumes the bus at all: the assistant only calls the other services over HTTP.</summary>
    public static bool HasQueue(string service) => service != "assistant";

    public static string Gateway(string slug) => $"{slug}-gateway";

    /// <summary>Tenant.API's uploads (the café's logo and icons). Named when the service was Branch.API, and left as it was.</summary>
    public static string UploadsVolume(string slug) => $"{slug}-branch-uploads";

    /// <summary>The volume as docker names it: compose prefixes the project, so anything outside the compose file (a backup) must too.</summary>
    public static string UploadsVolumeOnDocker(string slug) => $"{Project(slug)}_{UploadsVolume(slug)}";

    /// <summary>The menu's pictures: catalog keeps them on disk, so they must outlive its container.</summary>
    public static string PicsVolume(string slug) => $"{slug}-catalog-pics";

    public static string PicsVolumeOnDocker(string slug) => $"{Project(slug)}_{PicsVolume(slug)}";

    /// <summary>
    /// A URL-safe secret of 32 characters that never starts with '-': the
    /// same secrets go on rabbitmqctl's command line, which would read one
    /// starting with a dash as an option and refuse the user.
    /// </summary>
    public static string NewSecret()
    {
        const string letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        var secret = Convert.ToBase64String(RandomNumberGenerator.GetBytes(24)).Replace('+', '-').Replace('/', '_');
        return secret[0] is '-' or '_' ? letters[RandomNumberGenerator.GetInt32(letters.Length)] + secret[1..] : secret;
    }

    /// <summary>A first password an owner can type from a demo email: 12 characters, no look-alikes.</summary>
    public static string NewPassword()
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
        return string.Create(12, alphabet, (span, a) =>
        {
            for (var i = 0; i < span.Length; i++) span[i] = a[RandomNumberGenerator.GetInt32(a.Length)];
        });
    }
}

/// <summary>The public hosts one tenant gets; the customer one may be the café's own domain.</summary>
public sealed record TenantHosts(string Customer, string Admin, string Pos, string Kds, string Api, string Scheme = "https")
{
    public static TenantHosts For(Tenant tenant, PlatformOptions platform)
    {
        var d = platform.Domain;
        var slug = tenant.Slug;
        return new(
            Customer: tenant.CustomerDomain ?? $"{slug}.{d}",
            Admin: $"admin.{slug}.{d}",
            Pos: $"pos.{slug}.{d}",
            Kds: $"kds.{slug}.{d}",
            Api: $"api.{slug}.{d}",
            Scheme: platform.Scheme);
    }

    /// <summary>The prefixes the staff and API hosts carry in front of the slug.</summary>
    private static readonly string[] Prefixes = ["admin.", "pos.", "kds.", "api."];

    /// <summary>
    /// The slug a platform host names: blue.ninja.app and admin.blue.ninja.app
    /// both say "blue". Null for a host that is not under the platform domain,
    /// or whose slug part is not a slug.
    /// </summary>
    public static string? SlugFromHost(string host, PlatformOptions platform)
    {
        var suffix = $".{platform.Domain}";
        if (!host.EndsWith(suffix, StringComparison.Ordinal)) return null;
        var rest = host[..^suffix.Length];
        foreach (var prefix in Prefixes)
        {
            if (rest.StartsWith(prefix, StringComparison.Ordinal))
            {
                rest = rest[prefix.Length..];
                break;
            }
        }
        return TenantNaming.IsValidSlug(rest) ? rest : null;
    }

    /// <summary>
    /// A café's own domain as the record keeps it: trimmed, lower-case, a
    /// real host name, and not one of the platform's own (those are served
    /// already). Null for none; the error says why one was refused.
    /// </summary>
    public static string? NormalizeCustomerDomain(string? value, PlatformOptions platform, out string? error)
    {
        error = null;
        if (string.IsNullOrWhiteSpace(value)) return null;
        var host = value.Trim().ToLowerInvariant();
        if (!TenantNaming.IsValidHostname(host))
        {
            error = "The customer domain must be a host name like menu.cafe.com.";
            return null;
        }
        if (host == platform.Domain || host.EndsWith($".{platform.Domain}", StringComparison.Ordinal))
        {
            error = $"Hosts under {platform.Domain} are the platform's own; leave the domain empty to use {{slug}}.{platform.Domain}.";
            return null;
        }
        return host;
    }

    public string CustomerUrl => $"{Scheme}://{Customer}";
    public string AdminUrl => $"{Scheme}://{Admin}";
    public string PosUrl => $"{Scheme}://{Pos}";
    public string KdsUrl => $"{Scheme}://{Kds}";
    public string ApiUrl => $"{Scheme}://{Api}";

    public IEnumerable<string> All => [Customer, Admin, Pos, Kds, Api];
}
