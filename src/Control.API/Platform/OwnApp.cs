using System.Buffers.Binary;
using System.Text.RegularExpressions;
using Ninja.Control.API.Apis;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>The icons a business's own app is built with, checked as tool/stamp_tenant.dart and the stores need them.</summary>
public static class AppIcons
{
    public const int MaxBytes = 1024 * 1024;
    private static readonly byte[] Signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    /// <summary>Null when the PNG will do; what is wrong with it otherwise.</summary>
    public static string? Check(byte[] png, bool foreground)
    {
        if (png.Length > MaxBytes) return "The image is over 1 MB.";
        // The signature, then IHDR first: width, height, bit depth, colour type
        if (png.Length < 33 || !png.AsSpan(0, 8).SequenceEqual(Signature) || png[12] != 'I' || png[13] != 'H' || png[14] != 'D' || png[15] != 'R')
            return "The image must be a PNG.";
        var width = BinaryPrimitives.ReadInt32BigEndian(png.AsSpan(16, 4));
        var height = BinaryPrimitives.ReadInt32BigEndian(png.AsSpan(20, 4));
        var colour = png[25];
        if (width != height) return $"The image must be square; it is {width}x{height}.";
        if (foreground) return width < 432 ? $"The foreground must be at least 432x432; it is {width}x{height}." : null;
        if (width != 1024) return $"The icon must be 1024x1024; it is {width}x{height}.";
        // Colour types 4 and 6 carry alpha, which the App Store refuses on an icon
        return colour is 4 or 6 ? "The icon must have no transparency: export it without an alpha channel." : null;
    }
}

/// <summary>The readiness checks that need no store: what the record and the files say.</summary>
public static class AppChecks
{
    public static IEnumerable<AppCheck> Local(Tenant tenant, TenantApp app)
    {
        var appId = tenant.AppId!;
        yield return app.UploadKeystore is null
            ? new AppCheck("android-key", false, "No upload key yet: generate one, or import the business's.")
            : app.UploadKeySha256 is null
                ? new AppCheck("android-key", true, "A JKS key: its fingerprints are read by its next build.")
                : new AppCheck("android-key", true, $"Upload key {app.UploadKeySha256[..11]}…");

        yield return app.GoogleServicesJson is null
            ? new AppCheck("firebase-android", false, "No Android Firebase file yet: link it in Firebase.")
            : app.GoogleServicesJson.Contains($"\"package_name\": \"{appId}\"", StringComparison.Ordinal) || app.GoogleServicesJson.Contains($"\"package_name\":\"{appId}\"", StringComparison.Ordinal)
                ? new AppCheck("firebase-android", true, $"google-services.json names {appId}.")
                : new AppCheck("firebase-android", false, $"google-services.json does not name {appId}: link it in Firebase again.");

        var bundle = app.GoogleServiceInfoPlist is null ? null : Regex.Match(app.GoogleServiceInfoPlist, @"<key>BUNDLE_ID</key>\s*<string>([^<]*)</string>").Groups[1].Value;
        yield return bundle is null
            ? new AppCheck("firebase-ios", false, "No iOS Firebase file yet: link it in Firebase.")
            : bundle == appId
                ? new AppCheck("firebase-ios", true, $"GoogleService-Info.plist names {appId}.")
                : new AppCheck("firebase-ios", false, $"GoogleService-Info.plist names {bundle}, not {appId}: link it in Firebase again.");

        yield return app.Icon is null
            ? new AppCheck("icon", false, "No icon: the app would keep the cup.")
            : new AppCheck("icon", true, app.IconForeground is null ? "Icon set; Android uses it without an adaptive foreground." : "Icon and adaptive foreground set.");

        yield return tenant.AppleTeamId is null
            ? new AppCheck("apple-team", false, "No Apple team ID on the record: the iOS build stops without it.")
            : new AppCheck("apple-team", true, $"Team {tenant.AppleTeamId}.");

        // Installs from Play carry Play's app signing key: without its fingerprint a printed QR code opens the web app
        var fingerprints = AppLinks.Fingerprints(tenant.AndroidCertFingerprints);
        yield return fingerprints.Any(f => f != app.UploadKeySha256)
            ? new AppCheck("app-links", true, $"{fingerprints.Length} Android fingerprints on the record.")
            : new AppCheck("app-links", false, "Paste Play's app signing key SHA-256 (Play Console › App integrity) into the record's Android signing fingerprints.");
    }
}

/// <summary>A business's GitHub environment carried onto its record once: only what is empty is filled.</summary>
public static partial class AppCarry
{
    public static CarryAppKitResult Apply(Tenant tenant, TenantApp app, CarryAppKitRequest request)
    {
        var filled = new List<string>();
        var kept = new List<string>();
        var refused = new List<string>();

        void Fill(string name, string? given, Func<string?> current, Action<string> set, Func<string, string?>? check = null)
        {
            if (string.IsNullOrWhiteSpace(given)) return;
            if (current() is not null)
            {
                kept.Add(name);
                return;
            }
            if (check?.Invoke(given.Trim()) is { } why)
            {
                refused.Add($"{name}: {why}");
                return;
            }
            set(given.Trim());
            filled.Add(name);
        }

        // The keystore goes in as one: file, alias and passwords together, checked as the console checks it
        if (!string.IsNullOrWhiteSpace(request.Keystore))
        {
            if (app.UploadKeystore is not null) kept.Add("keystore");
            else
            {
                byte[]? bytes = null;
                try { bytes = Convert.FromBase64String(request.Keystore.Trim()); } catch (FormatException) { }
                var key = bytes is null ? null : UploadKeys.Import(bytes, request.KeyAlias ?? "", request.KeyPassword ?? request.StorePassword ?? "", request.StorePassword ?? "", out var error);
                if (key is null) refused.Add("keystore: " + (bytes is null ? "not base64" : "the alias or passwords do not open it"));
                else
                {
                    ControlApi.SetUploadKey(tenant, app, key);
                    filled.Add("keystore");
                }
            }
        }

        Fill("play", request.PlayServiceAccountJson, () => app.PlayServiceAccountJson, v => app.PlayServiceAccountJson = v,
            v => GoogleServiceAccount.Parse(v, out var e) is null ? e : null);
        if (!string.IsNullOrWhiteSpace(request.AscPrivateKey))
        {
            if (app.AscPrivateKey is not null) kept.Add("apple");
            else if (!StoreKeys.IsAscKey(request.AscPrivateKey) || string.IsNullOrWhiteSpace(request.AscKeyId) || string.IsNullOrWhiteSpace(request.AscIssuerId))
                refused.Add("apple: the key id, issuer id and .p8 do not make an App Store Connect key");
            else
            {
                app.AscKeyId = request.AscKeyId.Trim().ToUpperInvariant();
                app.AscIssuerId = request.AscIssuerId.Trim().ToLowerInvariant();
                app.AscPrivateKey = request.AscPrivateKey.Trim();
                filled.Add("apple");
            }
        }
        Fill("google-services.json", request.GoogleServicesJson, () => app.GoogleServicesJson, v => app.GoogleServicesJson = v,
            v => v.Contains(tenant.AppId!, StringComparison.Ordinal) ? null : $"it does not name {tenant.AppId}");
        Fill("GoogleService-Info.plist", request.GoogleServiceInfoPlist, () => app.GoogleServiceInfoPlist, v => app.GoogleServiceInfoPlist = v,
            v => v.Contains($"<string>{tenant.AppId}</string>", StringComparison.Ordinal) ? null : $"it does not name {tenant.AppId}");

        return new CarryAppKitResult(filled, kept, refused);
    }

    /// <summary>A SHA-1 fingerprint as AA:BB:…, from keytool's or any hex; null when it is not one.</summary>
    public static string? NormalizeSha1(string? value)
    {
        var hex = (value ?? "").Trim().Replace(":", "").ToUpperInvariant();
        return Sha1Hex().IsMatch(hex) ? string.Join(':', hex.Chunk(2).Select(c => new string(c))) : null;
    }

    [GeneratedRegex("^[0-9A-F]{40}$")]
    private static partial Regex Sha1Hex();
}
