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
        "payrolldb", "financedb", "loyaltydb", "branchdb", "notificationdb",
    ];

    /// <summary>The services a stack runs, as image suffix → compose service suffix.</summary>
    public static readonly string[] Services =
    [
        "catalog", "ordering", "spaces", "sales", "inventory", "payroll",
        "finance", "identity", "loyalty", "notification", "accounts", "branch",
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

    public static string Project(string slug) => $"ninja-{slug}";

    public static string Realm(string slug) => slug;

    public static string VHost(string slug) => slug;

    public static string Database(string slug, string db) => $"{slug}_{db}";

    /// <summary>A compose service name, unique on the shared network: {slug}-{service}-api.</summary>
    public static string Service(string slug, string service) => $"{slug}-{service}-api";

    public static string Gateway(string slug) => $"{slug}-gateway";

    public static string UploadsVolume(string slug) => $"{slug}-branch-uploads";

    /// <summary>A URL-safe secret of 32 characters.</summary>
    public static string NewSecret()
        => Convert.ToBase64String(RandomNumberGenerator.GetBytes(24)).Replace('+', '-').Replace('/', '_');

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

    public string CustomerUrl => $"{Scheme}://{Customer}";
    public string AdminUrl => $"{Scheme}://{Admin}";
    public string PosUrl => $"{Scheme}://{Pos}";
    public string KdsUrl => $"{Scheme}://{Kds}";
    public string ApiUrl => $"{Scheme}://{Api}";

    public IEnumerable<string> All => [Customer, Admin, Pos, Kds, Api];
}
