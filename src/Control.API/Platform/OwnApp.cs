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

/// <summary>Fingerprints as the build reports them.</summary>
public static partial class Fingerprint
{
    /// <summary>A SHA-1 fingerprint as AA:BB:…, from keytool's or any hex; null when it is not one.</summary>
    public static string? NormalizeSha1(string? value)
    {
        var hex = (value ?? "").Trim().Replace(":", "").ToUpperInvariant();
        return Sha1Hex().IsMatch(hex) ? string.Join(':', hex.Chunk(2).Select(c => new string(c))) : null;
    }

    [GeneratedRegex("^[0-9A-F]{40}$")]
    private static partial Regex Sha1Hex();
}

/// <summary>
/// Google sign-in in a business's own app. The app asks for the platform's web client
/// (GOOGLE_SERVER_CLIENT_ID, the realm's Google provider), and Google only answers an app whose own
/// OAuth clients are in that client's Google Cloud project: an Android client naming the app id and
/// the SHA-1 of the key the installed app is signed with (Play's app signing key, and the upload key
/// for a build installed by hand), and an iOS client naming the bundle id, whose id the app carries in
/// its iOS Firebase file. Google gives no API to make either, so they are made by hand; this says
/// where and checks what can be checked.
/// </summary>
public static partial class GoogleSignIn
{
    /// <summary>The Google Cloud project number an OAuth client id belongs to: its part before the dash.</summary>
    public static string? Project(string? clientId)
        => clientId is null ? null : ClientIdPattern().Match(clientId) is { Success: true } m ? m.Groups[1].Value : null;

    public static bool IsClientId(string? clientId) => clientId is not null && ClientIdPattern().IsMatch(clientId);

    /// <summary>The iOS client the Firebase file names, if any.</summary>
    public static string? PlistClientId(string? plist)
        => plist is null ? null : Regex.Match(plist, @"<key>CLIENT_ID</key>\s*<string>([^<]*)</string>") is { Success: true } m ? m.Groups[1].Value : null;

    /// <summary>The iOS client the app signs in with: the one given on the App tab, else the Firebase file's.</summary>
    public static string? IosClientId(TenantApp app) => app.GoogleIosClientId ?? PlistClientId(app.GoogleServiceInfoPlist);

    /// <summary>The Firebase file with CLIENT_ID and REVERSED_CLIENT_ID set to the given client, replaced or added.</summary>
    public static string WithClientId(string plist, string clientId)
    {
        var reversed = "com.googleusercontent.apps." + clientId[..^".apps.googleusercontent.com".Length];
        foreach (var (key, value) in new[] { ("CLIENT_ID", clientId), ("REVERSED_CLIENT_ID", reversed) })
        {
            var existing = new Regex($@"(<key>{key}</key>\s*<string>)[^<]*(</string>)");
            plist = existing.IsMatch(plist)
                ? existing.Replace(plist, m => m.Groups[1].Value + value + m.Groups[2].Value, 1)
                : new Regex(@"<dict>").Replace(plist, $"<dict>\n\t<key>{key}</key>\n\t<string>{value}</string>", 1);
        }
        return plist;
    }

    /// <summary>The check: the iOS client in the sign-in client's project; Android said, as it cannot be asked.</summary>
    public static AppCheck? Check(Tenant tenant, TenantApp app, string? webClientId)
    {
        if (Project(webClientId) is not { } project) return null;
        var ios = IosClientId(app);
        var android = app.PlaySigningSha1 is null
            ? $"Android: give the SHA-1 of Play's app signing key (Play Console, App integrity) on the App tab and link Firebase again, or the app as Play installs it cannot sign in with Google."
            : $"Android: Play's app signing SHA-1 is given; Firebase must be linked since (in project {project}) for Google to know it.";
        if (ios is null)
            return new AppCheck("google-sign-in", false, $"No iOS client for Google sign-in: make an iOS OAuth client for {tenant.AppId} in Google Cloud project {project} and give its id on the App tab. {android}");
        if (Project(ios) != project)
            return new AppCheck("google-sign-in", false, $"The iOS client is in Google Cloud project {Project(ios)}, sign-in is in {project}: make an iOS OAuth client for {tenant.AppId} in {project} and give its id on the App tab. {android}");
        return new AppCheck("google-sign-in", app.PlaySigningSha1 is not null, $"iOS signs in with project {project}'s client. {android}");
    }

    [GeneratedRegex(@"^(\d+)-[a-z0-9]+\.apps\.googleusercontent\.com$")]
    private static partial Regex ClientIdPattern();
}
