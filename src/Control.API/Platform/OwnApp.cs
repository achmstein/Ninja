using System.Buffers.Binary;
using System.Text.RegularExpressions;
using Ninja.Control.API.Apis;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>The two icons a build stamps, made from one logo.</summary>
public sealed record MadeIcons(byte[] Icon, byte[] Foreground);

/// <summary>
/// The icons a business's own app is built with, made here from whatever logo is given (any size or
/// shape, PNG, JPEG or WebP), so nobody prepares them by hand: the icon is the logo centred on a white
/// 1024x1024 square with a margin, without transparency (the App Store refuses it); Android's adaptive
/// foreground is the logo alone on a transparent 1024x1024 layer, inside its middle 60%, the part every
/// launcher's mask (circle, squircle, teardrop) keeps. tool/stamp_tenant.dart puts it over white.
/// </summary>
public static class AppIcons
{
    public const int MaxBytes = 8 * 1024 * 1024;
    public const int Size = 1024;

    /// <summary>How much of the icon the logo takes, and how much of the foreground layer.</summary>
    private const float IconShare = 0.78f;
    private const float ForegroundShare = 0.60f;

    /// <summary>Both icons from the logo; null and why when it is not an image that will do.</summary>
    public static MadeIcons? Make(byte[] logo, out string? error)
    {
        error = null;
        if (logo.Length > MaxBytes)
        {
            error = "The image is over 8 MB.";
            return null;
        }
        using var bitmap = Decode(logo);
        if (bitmap is null)
        {
            error = "That is not an image: give a PNG, JPEG or WebP of the logo.";
            return null;
        }
        if (Math.Max(bitmap.Width, bitmap.Height) < 256)
        {
            error = $"The logo is {bitmap.Width}x{bitmap.Height}: give one at least 512 pixels across, or it will look blurred on a phone.";
            return null;
        }
        var mark = Content(bitmap);
        return new MadeIcons(Draw(bitmap, mark, IconShare, SkiaSharp.SKColors.White), Draw(bitmap, mark, ForegroundShare, SkiaSharp.SKColors.Transparent));
    }

    /// <summary>Only the foreground, given on its own: the logo inside the middle of a transparent layer.</summary>
    public static byte[]? MakeForeground(byte[] logo, out string? error)
    {
        error = null;
        using var bitmap = logo.Length > MaxBytes ? null : Decode(logo);
        if (bitmap is null)
        {
            error = "That is not an image under 8 MB.";
            return null;
        }
        return Draw(bitmap, Content(bitmap), ForegroundShare, SkiaSharp.SKColors.Transparent);
    }

    /// <summary>The image, or null when the bytes are none Skia reads (Decode throws on them rather than saying so).</summary>
    private static SkiaSharp.SKBitmap? Decode(byte[] bytes)
    {
        using var data = SkiaSharp.SKData.CreateCopy(bytes);
        using var codec = SkiaSharp.SKCodec.Create(data);
        return codec is null ? null : SkiaSharp.SKBitmap.Decode(codec);
    }

    /// <summary>The part of the image that is the logo: what is neither transparent nor near white, the margins trimmed.</summary>
    private static SkiaSharp.SKRectI Content(SkiaSharp.SKBitmap bitmap)
    {
        int left = bitmap.Width, top = bitmap.Height, right = -1, bottom = -1;
        for (var y = 0; y < bitmap.Height; y++)
        for (var x = 0; x < bitmap.Width; x++)
        {
            var c = bitmap.GetPixel(x, y);
            if (c.Alpha < 16 || (c.Red > 245 && c.Green > 245 && c.Blue > 245)) continue;
            if (x < left) left = x;
            if (x > right) right = x;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
        }
        return right < 0 ? new SkiaSharp.SKRectI(0, 0, bitmap.Width, bitmap.Height) : new SkiaSharp.SKRectI(left, top, right + 1, bottom + 1);
    }

    /// <summary>The logo's content scaled to fit <paramref name="share"/> of a 1024 square, centred, over the background.</summary>
    private static byte[] Draw(SkiaSharp.SKBitmap bitmap, SkiaSharp.SKRectI mark, float share, SkiaSharp.SKColor background)
    {
        var info = new SkiaSharp.SKImageInfo(Size, Size, SkiaSharp.SKColorType.Rgba8888,
            background.Alpha == 255 ? SkiaSharp.SKAlphaType.Opaque : SkiaSharp.SKAlphaType.Premul);
        using var surface = SkiaSharp.SKSurface.Create(info);
        var canvas = surface.Canvas;
        canvas.Clear(background);
        var scale = Size * share / Math.Max(mark.Width, mark.Height);
        var width = mark.Width * scale;
        var height = mark.Height * scale;
        var target = SkiaSharp.SKRect.Create((Size - width) / 2, (Size - height) / 2, width, height);
        using var image = SkiaSharp.SKImage.FromBitmap(bitmap);
        using var paint = new SkiaSharp.SKPaint { IsAntialias = true };
        canvas.DrawImage(image, mark, target, new SkiaSharp.SKSamplingOptions(SkiaSharp.SKCubicResampler.Mitchell), paint);
        using var snapshot = surface.Snapshot();
        using var png = snapshot.Encode(SkiaSharp.SKEncodedImageFormat.Png, 100);
        return png.ToArray();
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

        // Installs from Play carry Play's app signing key, which is the upload key for an app Play does not re-sign:
        // one fingerprint may be all there is, so only none at all is surely wrong
        var fingerprints = AppLinks.Fingerprints(tenant.AndroidCertFingerprints);
        yield return fingerprints.Length == 0
            ? new AppCheck("app-links", false, "No Android signing fingerprints: a printed QR code opens the web app instead of the app.")
            : fingerprints.All(f => f == app.UploadKeySha256)
                ? new AppCheck("app-links", true, "The upload key's fingerprint. If Play re-signs the app (App integrity shows a different app signing key), add that one too.")
                : new AppCheck("app-links", true, $"{fingerprints.Length} Android fingerprints on the record.");
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
