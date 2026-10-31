using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>The public hosts one tenant gets; the customer one may be the business's own domain.</summary>
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
    /// A business's own domain as the record keeps it: trimmed, lower-case, a
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
            error = "The customer domain must be a host name like menu.example.com.";
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
