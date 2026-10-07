using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>
/// The files that let a business's own app open its printed QR codes (App Links on Android, Universal
/// Links on iOS): served on its customer host at /.well-known/, which the edge hands to the control
/// plane, from what the record says about the app. A business with no app of its own, or whose record
/// lacks what a file needs, has none: the link then opens the web app, as it does without an app.
/// </summary>
public static partial class AppLinks
{
    /// <summary>The links the app opens: what tool/stamp_tenant.dart leaves in AndroidManifest.xml, on the business's host</summary>
    public static readonly string[] Paths = ["/room/*", "/table/*", "/claim", "/item/*"];

    /// <summary>Android's assetlinks.json: the app's package, and the certificates its installs are signed with</summary>
    public static JsonArray? AssetLinks(Tenant tenant)
    {
        var fingerprints = Fingerprints(tenant.AndroidCertFingerprints);
        if (tenant.AppId is null || fingerprints.Length == 0) return null;
        return
        [
            new JsonObject
            {
                ["relation"] = new JsonArray("delegate_permission/common.handle_all_urls"),
                ["target"] = new JsonObject
                {
                    ["namespace"] = "android_app",
                    ["package_name"] = tenant.AppId,
                    ["sha256_cert_fingerprints"] = new JsonArray([.. fingerprints.Select(f => JsonValue.Create(f))]),
                },
            },
        ];
    }

    /// <summary>iOS's apple-app-site-association: the app as its team names it, and the paths it opens</summary>
    public static JsonObject? SiteAssociation(Tenant tenant)
    {
        if (tenant.AppId is null || tenant.AppleTeamId is null) return null;
        return new JsonObject
        {
            ["applinks"] = new JsonObject
            {
                ["details"] = new JsonArray(new JsonObject
                {
                    ["appIDs"] = new JsonArray($"{tenant.AppleTeamId}.{tenant.AppId}"),
                    ["components"] = new JsonArray([.. Paths.Select(p => new JsonObject { ["/"] = p })]),
                }),
            },
        };
    }

    /// <summary>The fingerprints as the record keeps them, comma-separated</summary>
    public static string[] Fingerprints(string? stored)
        => string.IsNullOrEmpty(stored) ? [] : stored.Split(',', StringSplitOptions.RemoveEmptyEntries);

    /// <summary>
    /// SHA-256 certificate fingerprints as Play Console shows them (App integrity: the app signing key, and
    /// the upload key for a build installed outside the store), one or more, separated by spaces, commas or
    /// lines, with or without colons, in either case; kept as AA:BB:… comma-separated. Null for none; the
    /// error says what was refused.
    /// </summary>
    public static string? NormalizeFingerprints(string? value, out string? error)
    {
        error = null;
        if (string.IsNullOrWhiteSpace(value)) return null;
        var kept = new List<string>();
        foreach (var part in Separators().Split(value.Trim()).Where(p => p.Length > 0))
        {
            var hex = part.Replace(":", "").ToUpperInvariant();
            if (!Sha256Hex().IsMatch(hex))
            {
                error = $"{part} is not a SHA-256 fingerprint: 32 bytes in hex, like 14:6D:E9:…, as Play Console shows it under App integrity.";
                return null;
            }
            var formatted = string.Join(':', hex.Chunk(2).Select(c => new string(c)));
            if (!kept.Contains(formatted)) kept.Add(formatted);
        }
        if (kept.Count > 10)
        {
            error = "Ten fingerprints at most.";
            return null;
        }
        return string.Join(',', kept);
    }

    /// <summary>An Apple team ID: ten capital letters and digits, from the business's developer account (Membership)</summary>
    public static bool IsTeamId(string value) => TeamId().IsMatch(value);

    [GeneratedRegex(@"[\s,;]+")]
    private static partial Regex Separators();

    [GeneratedRegex("^[0-9A-F]{64}$")]
    private static partial Regex Sha256Hex();

    [GeneratedRegex("^[A-Z0-9]{10}$")]
    private static partial Regex TeamId();
}
