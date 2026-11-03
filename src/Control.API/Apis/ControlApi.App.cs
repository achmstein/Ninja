using System.ComponentModel;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Apis;

public sealed record AndroidKeyStatus(
    bool Set,
    [property: Description("pkcs12 when it was made here or could be read, jks when its fingerprints come from its first build")] string? Format,
    string? Alias,
    string? Sha1,
    string? Sha256);

public sealed record PlayKeyStatus(bool Set, [property: Description("The service account, the one part shown again")] string? ClientEmail);

public sealed record AppleKeyStatus(bool Set, string? KeyId, string? IssuerId);

public sealed record AppIconsStatus(bool Icon, bool Foreground);

public sealed record AppFirebaseStatus(
    [property: Description("Whether the Platform page's Firebase tab has its service account")] bool PlatformReady,
    string? AndroidAppId,
    string? IosAppId,
    bool AndroidFile,
    bool IosFile);

/// <param name="Item">android-key, play, apple, firebase-android, firebase-ios, icon, apple-team, app-links</param>
public sealed record AppCheck(string Item, bool Ok, string Detail);

/// <summary>What the business's own app holds, never a key's value.</summary>
public sealed record TenantAppStatus(
    [property: Description("The record's own app id; null: the business is on the shared app and nothing here is used")] string? AppId,
    AndroidKeyStatus AndroidKey,
    PlayKeyStatus Play,
    AppleKeyStatus Apple,
    AppIconsStatus Icons,
    AppFirebaseStatus Firebase,
    IReadOnlyList<AppCheck> Checks,
    DateTime? CheckedAt);

public sealed record ImportAndroidKeyRequest(
    [property: Description("The keystore file, base64")] string Keystore,
    string Alias,
    string StorePassword,
    [property: Description("Left out: the store password, as PKCS12 keys have")] string? KeyPassword = null,
    [property: Description("Required to replace a key already set: Play refuses another upload key until it is reset in Play Console")] bool Confirm = false);

public sealed record GenerateAndroidKeyRequest(bool Confirm = false);

public sealed record PlayKeyRequest([property: Description("The service account's key file, as Google gives it")] string ServiceAccountJson);

public sealed record AppleKeyRequest(string KeyId, string IssuerId, [property: Description("The .p8 file's contents")] string PrivateKey);

public sealed record AppIconsRequest(
    [property: Description("The logo, any size or shape (PNG, JPEG, WebP), base64: the icon and Android's foreground are made from it; left out keeps the saved ones")] string? Icon = null,
    [property: Description("Another image for Android's adaptive foreground only, placed in its middle; left out, the logo's")] string? Foreground = null,
    bool ClearForeground = false);

public sealed record FirebaseLinkResponse(TenantAppStatus App, IReadOnlyList<string> Done);

/// <summary>Everything one platform's build signs and uploads with; files base64.</summary>
public sealed record AppKit(
    string? GoogleServicesJson = null,
    string? GoogleServiceInfoPlist = null,
    string? Keystore = null,
    string? KeyAlias = null,
    string? KeyPassword = null,
    string? StorePassword = null,
    [property: Description("Whether the upload key's fingerprints are known; when not, the build reports them (app-kit/report)")] bool FingerprintsKnown = false,
    string? PlayServiceAccountJson = null,
    string? AscKeyId = null,
    string? AscIssuerId = null,
    string? AscPrivateKey = null,
    string? Icon = null,
    string? IconForeground = null);

/// <summary>What a business's GitHub environment held, carried once: only empty slots are filled.</summary>
public sealed record CarryAppKitRequest(
    string? Keystore = null,
    string? KeyAlias = null,
    string? KeyPassword = null,
    string? StorePassword = null,
    string? PlayServiceAccountJson = null,
    string? AscKeyId = null,
    string? AscIssuerId = null,
    string? AscPrivateKey = null,
    string? GoogleServicesJson = null,
    string? GoogleServiceInfoPlist = null);

public sealed record CarryAppKitResult(IReadOnlyList<string> Filled, IReadOnlyList<string> Kept, IReadOnlyList<string> Refused);

public sealed record ReportFingerprintsRequest(string Sha1, string Sha256);

/// <summary>
/// A business's own app, kept on the control plane: the console sets its keys and icons and links it
/// in Firebase (the App tab), and the build reads what it signs and uploads with (tenants/fetch-kit.sh),
/// so nothing is set per business in GitHub.
/// </summary>
public static partial class ControlApi
{
    public const string StoreClient = "stores";

    private static void MapAppApi(RouteGroupBuilder api)
    {
        api.MapGet("/tenants/{slug}/app", GetApp).WithName("GetTenantApp").WithSummary("What the business's own app holds (keys only as set or not, fingerprints, Firebase ids) and its last check").RequireAuthorization("Platform");
        api.MapPut("/tenants/{slug}/app/android-key", ImportAndroidKey).WithName("ImportAndroidKey").WithSummary("Take in the business's existing Android upload keystore, checked; its SHA-256 joins the record's App Links fingerprints").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/app/android-key/generate", GenerateAndroidKey).WithName("GenerateAndroidKey").WithSummary("Make a new Android upload key for the business (RSA 2048, 25 years); its SHA-256 joins the record's App Links fingerprints").RequireAuthorization("Platform");
        api.MapPut("/tenants/{slug}/app/play", SetPlayKey).WithName("SetPlayKey").WithSummary("The Google service account with release rights on the business's Play account").RequireAuthorization("Platform");
        api.MapPut("/tenants/{slug}/app/apple", SetAppleKey).WithName("SetAppleKey").WithSummary("The App Store Connect API key from the business's account (App Manager)").RequireAuthorization("Platform");
        api.MapPut("/tenants/{slug}/app/icons", SetAppIcons).WithName("SetAppIcons").WithSummary("The app's logo, any size: its icon (1024x1024 on white) and Android's adaptive foreground are made from it").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/app/icons/from-brand", AppIconsFromBrand).WithName("SetAppIconsFromBrand").WithSummary("Make the app's icons from the logo on the business's brand, as the running stack serves it").RequireAuthorization("Platform");
        api.MapGet("/tenants/{slug}/app/icons/{which}", GetAppIcon).WithName("GetAppIcon").WithSummary("The saved icon (icon) or foreground (foreground), as PNG").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/app/firebase", LinkFirebase).WithName("LinkFirebaseApps").WithSummary("Find or make the business's Android and iOS apps in the platform's Firebase project, give Android its certificates, and keep both config files").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/app/check", CheckApp).WithName("CheckTenantApp").WithSummary("Try every key from the server (Apple finds the app, Play opens an edit) and check the files, icon and record: one line each").RequireAuthorization("Platform");

        api.MapGet("/tenants/{slug}/app-kit", GetAppKit).WithName("GetTenantAppKit").WithSummary("What the build signs and uploads the business's own app with, for one platform; each read is audited. tenants/fetch-kit.sh reads it as the app-builder client").RequireAuthorization(Extensions.Extensions.AppBuildPolicy);
        api.MapPost("/tenants/{slug}/app-kit/carry", CarryAppKit).WithName("CarryTenantAppKit").WithSummary("Fill the empty slots of the business's app with what its GitHub environment held (carry-app-secrets.yml); never replaces one").RequireAuthorization(Extensions.Extensions.AppBuildPolicy);
        api.MapPost("/tenants/{slug}/app-kit/report", ReportUploadKey).WithName("ReportUploadKeyFingerprints").WithSummary("The build's reading of a JKS upload key's fingerprints, taken only while none are known").RequireAuthorization(Extensions.Extensions.AppBuildPolicy);
    }

    public static async Task<Results<Ok<TenantAppStatus>, NotFound>> GetApp(ControlContext context, string slug, CancellationToken ct)
    {
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        var app = await context.TenantApps.AsNoTracking().SingleOrDefaultAsync(a => a.TenantId == tenant.Id, ct);
        return TypedResults.Ok(await AppStatusAsync(context, tenant, app, ct));
    }

    public static async Task<Results<Ok<TenantAppStatus>, NotFound, BadRequest<ProblemDetails>>> ImportAndroidKey(
        ControlContext context, IAuditWriter audit, string slug, ImportAndroidKeyRequest request, CancellationToken ct)
    {
        if (await OwnAppAsync(context, slug, ct) is not { } found) return TypedResults.NotFound();
        var (tenant, app) = found;
        if (Refuse(tenant) is { } refused) return refused;
        if (app.UploadKeystore is not null && !request.Confirm)
            return Problem("The business already has an upload key. Play refuses another until the upload key is reset in Play Console (App integrity); confirm to replace it.");
        byte[] bytes;
        try
        {
            bytes = System.Convert.FromBase64String(request.Keystore ?? "");
        }
        catch (FormatException)
        {
            return Problem("The keystore did not arrive as a file.");
        }
        var key = UploadKeys.Import(bytes, request.Alias ?? "", request.KeyPassword is { Length: > 0 } k ? k : request.StorePassword ?? "", request.StorePassword ?? "", out var error);
        if (key is null) return Problem(error!);

        var replaced = app.UploadKeystore is not null;
        SetUploadKey(tenant, app, key);
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("tenant.app.android-key", slug, new { how = "imported", replaced, format = key.Sha256 is null ? "jks" : "pkcs12" }, ct);
        return TypedResults.Ok(await AppStatusAsync(context, tenant, app, ct));
    }

    public static async Task<Results<Ok<TenantAppStatus>, NotFound, BadRequest<ProblemDetails>>> GenerateAndroidKey(
        ControlContext context, IAuditWriter audit, string slug, GenerateAndroidKeyRequest? request, CancellationToken ct)
    {
        if (await OwnAppAsync(context, slug, ct) is not { } found) return TypedResults.NotFound();
        var (tenant, app) = found;
        if (Refuse(tenant) is { } refused) return refused;
        if (app.UploadKeystore is not null && request?.Confirm != true)
            return Problem("The business already has an upload key. Play refuses another until the upload key is reset in Play Console (App integrity); confirm to replace it.");

        var replaced = app.UploadKeystore is not null;
        SetUploadKey(tenant, app, UploadKeys.Generate(tenant.NameEn ?? tenant.NameAr ?? tenant.Slug));
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("tenant.app.android-key", slug, new { how = "generated", replaced }, ct);
        return TypedResults.Ok(await AppStatusAsync(context, tenant, app, ct));
    }

    public static async Task<Results<Ok<TenantAppStatus>, NotFound, BadRequest<ProblemDetails>>> SetPlayKey(
        ControlContext context, IAuditWriter audit, string slug, PlayKeyRequest request, CancellationToken ct)
    {
        if (await OwnAppAsync(context, slug, ct) is not { } found) return TypedResults.NotFound();
        var (tenant, app) = found;
        if (Refuse(tenant) is { } refused) return refused;
        if (GoogleServiceAccount.Parse(request.ServiceAccountJson, out var error) is not { } account) return Problem(error!);

        app.PlayServiceAccountJson = request.ServiceAccountJson.Trim();
        app.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("tenant.app.play", slug, new { account.ClientEmail }, ct);
        return TypedResults.Ok(await AppStatusAsync(context, tenant, app, ct));
    }

    public static async Task<Results<Ok<TenantAppStatus>, NotFound, BadRequest<ProblemDetails>>> SetAppleKey(
        ControlContext context, IAuditWriter audit, string slug, AppleKeyRequest request, CancellationToken ct)
    {
        if (await OwnAppAsync(context, slug, ct) is not { } found) return TypedResults.NotFound();
        var (tenant, app) = found;
        if (Refuse(tenant) is { } refused) return refused;
        var keyId = (request.KeyId ?? "").Trim().ToUpperInvariant();
        var issuer = (request.IssuerId ?? "").Trim().ToLowerInvariant();
        if (!AscKeyId().IsMatch(keyId))
            return Problem("The key ID is ten letters and digits, as App Store Connect shows it under Users and Access › Integrations.");
        if (!Guid.TryParse(issuer, out _))
            return Problem("The issuer ID is a UUID, shown above the keys in App Store Connect.");
        if (!StoreKeys.IsAscKey(request.PrivateKey ?? ""))
            return Problem("The private key is the .p8 file's contents, from -----BEGIN PRIVATE KEY----- to its end.");

        app.AscKeyId = keyId;
        app.AscIssuerId = issuer;
        app.AscPrivateKey = request.PrivateKey!.Trim();
        app.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("tenant.app.apple", slug, new { keyId, issuer }, ct);
        return TypedResults.Ok(await AppStatusAsync(context, tenant, app, ct));
    }

    public static async Task<Results<Ok<TenantAppStatus>, NotFound, BadRequest<ProblemDetails>>> SetAppIcons(
        ControlContext context, IAuditWriter audit, string slug, AppIconsRequest request, CancellationToken ct)
    {
        if (await OwnAppAsync(context, slug, ct) is not { } found) return TypedResults.NotFound();
        var (tenant, app) = found;
        if (Refuse(tenant) is { } refused) return refused;

        var changed = new List<string>();
        // The logo as it is: both icons are made from it, Android's foreground too unless one is given beside it
        if (!string.IsNullOrWhiteSpace(request.Icon))
        {
            if (Png(request.Icon) is not { } logo) return Problem("The logo did not arrive as a file.");
            if (AppIcons.Make(logo, out var error) is not { } made) return Problem(error!);
            app.Icon = made.Icon;
            changed.Add("icon");
            if (string.IsNullOrWhiteSpace(request.Foreground))
            {
                app.IconForeground = made.Foreground;
                changed.Add("foreground from the logo");
            }
        }
        if (!string.IsNullOrWhiteSpace(request.Foreground))
        {
            if (Png(request.Foreground) is not { } given) return Problem("The foreground did not arrive as a file.");
            if (AppIcons.MakeForeground(given, out var error) is not { } foreground) return Problem(error!);
            app.IconForeground = foreground;
            changed.Add("foreground");
        }
        else if (request.ClearForeground && app.IconForeground is not null)
        {
            app.IconForeground = null;
            changed.Add("foreground cleared");
        }
        if (changed.Count == 0) return TypedResults.Ok(await AppStatusAsync(context, tenant, app, ct));

        app.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("tenant.app.icons", slug, new { changed }, ct);
        return TypedResults.Ok(await AppStatusAsync(context, tenant, app, ct));
    }

    public static async Task<Results<Ok<TenantAppStatus>, NotFound, BadRequest<ProblemDetails>>> AppIconsFromBrand(
        ControlContext context, IAuditWriter audit, IStackProxy stack, string slug, CancellationToken ct)
    {
        if (await OwnAppAsync(context, slug, ct) is not { } found) return TypedResults.NotFound();
        var (tenant, app) = found;
        if (Refuse(tenant) is { } refused) return refused;
        if (await IconsFromBrandAsync(stack, tenant, app, ct) is { } error) return Problem(error);
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("tenant.app.icons", slug, new { changed = new[] { "icon and foreground from the brand logo" } }, ct);
        return TypedResults.Ok(await AppStatusAsync(context, tenant, app, ct));
    }

    /// <summary>
    /// Both icons made from the logo the business's brand has (the one its web app and receipts show),
    /// read from its running stack. Null when done; why not otherwise.
    /// </summary>
    internal static async Task<string?> IconsFromBrandAsync(IStackProxy stack, Tenant tenant, TenantApp app, CancellationToken ct)
    {
        if (tenant.Status != TenantStatus.Running) return $"The brand logo lives on the business's stack, and it is {tenant.Status}.";
        byte[] logo;
        try
        {
            using var response = await stack.SendAsync(tenant, HttpMethod.Get, "/api/tenant/images/logo", null, StackAuth.Anonymous, ct);
            if (response.StatusCode == System.Net.HttpStatusCode.NotFound) return "The brand has no logo yet: upload one on the Brand tab, or an icon here.";
            if (!response.IsSuccessStatusCode) return $"The business's stack answered {(int)response.StatusCode} for its logo.";
            logo = await response.Content.ReadAsByteArrayAsync(ct);
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
        {
            return $"The business's stack did not answer: {e.Message}";
        }
        if (AppIcons.Make(logo, out var error) is not { } made) return $"The brand logo: {error}";
        app.Icon = made.Icon;
        app.IconForeground = made.Foreground;
        app.UpdatedAt = DateTime.UtcNow;
        return null;
    }

    public static async Task<Results<FileContentHttpResult, NotFound>> GetAppIcon(ControlContext context, string slug, string which, CancellationToken ct)
    {
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        var app = await context.TenantApps.AsNoTracking().SingleOrDefaultAsync(a => a.TenantId == tenant.Id, ct);
        var bytes = which switch { "icon" => app?.Icon, "foreground" => app?.IconForeground, _ => null };
        return bytes is null ? TypedResults.NotFound() : TypedResults.File(bytes, "image/png");
    }

    public static async Task<Results<Ok<FirebaseLinkResponse>, NotFound, BadRequest<ProblemDetails>>> LinkFirebase(
        ControlContext context, IAuditWriter audit, IHttpClientFactory clients, string slug, CancellationToken ct)
    {
        if (await OwnAppAsync(context, slug, ct) is not { } found) return TypedResults.NotFound();
        var (tenant, app) = found;
        if (Refuse(tenant) is { } refused) return refused;
        if (await FirebaseAppsAsync(context, clients, ct) is not { } firebase)
            return Problem("Set the Firebase service account on the Platform page's Firebase tab first.");

        // Android's certificates: the upload key's, and whatever else the record lists (Play's app signing key)
        var sha256 = AppLinks.Fingerprints(tenant.AndroidCertFingerprints).ToList();
        if (app.UploadKeySha256 is { } upload && !sha256.Contains(upload)) sha256.Add(upload);
        var sha1 = app.UploadKeySha1 is { } s ? new[] { s } : [];

        FirebaseLinkResult result;
        try
        {
            result = await firebase.LinkAsync(tenant.AppId!, tenant.NameEn ?? tenant.NameAr ?? tenant.Slug, tenant.AppleTeamId, sha1, sha256, ct);
        }
        catch (StoreKeyException e)
        {
            return Problem(e.Message);
        }

        app.FirebaseAndroidAppId = result.Android?.AppId;
        app.GoogleServicesJson = result.Android?.ConfigFile;
        app.FirebaseIosAppId = result.Ios?.AppId;
        app.GoogleServiceInfoPlist = result.Ios?.ConfigFile;
        app.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("tenant.app.firebase", slug, new { project = firebase.Project, android = app.FirebaseAndroidAppId, ios = app.FirebaseIosAppId, result.Done }, ct);
        return TypedResults.Ok(new FirebaseLinkResponse(await AppStatusAsync(context, tenant, app, ct), result.Done));
    }

    public static async Task<Results<Ok<TenantAppStatus>, NotFound, BadRequest<ProblemDetails>>> CheckApp(
        ControlContext context, IAuditWriter audit, IHttpClientFactory clients, string slug, CancellationToken ct)
    {
        if (await OwnAppAsync(context, slug, ct) is not { } found) return TypedResults.NotFound();
        var (tenant, app) = found;
        if (Refuse(tenant) is { } refused) return refused;

        var http = clients.CreateClient(StoreClient);
        var checks = new List<AppCheck>(AppChecks.Local(tenant, app));
        checks.Insert(1, await TryAsync("play", async () =>
        {
            if (GoogleServiceAccount.Parse(app.PlayServiceAccountJson, out _) is not { } account) return "No Play service account yet.";
            await StoreKeys.CheckPlayAsync(http, account, tenant.AppId!, ct);
            return null;
        }, $"{GoogleServiceAccount.Parse(app.PlayServiceAccountJson, out _)?.ClientEmail} may release {tenant.AppId}."));
        string? appName = null;
        checks.Insert(2, await TryAsync("apple", async () =>
        {
            if (app.AscKeyId is null || app.AscIssuerId is null || app.AscPrivateKey is null) return "No App Store Connect key yet.";
            appName = await StoreKeys.FindAscAppAsync(http, app.AscKeyId, app.AscIssuerId, app.AscPrivateKey, tenant.AppId!, ct);
            return null;
        }, () => $"App Store Connect has {appName}."));

        app.Checks = System.Text.Json.JsonSerializer.Serialize(checks, System.Text.Json.JsonSerializerOptions.Web);
        app.CheckedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("tenant.app.checked", slug, new { failed = checks.Where(c => !c.Ok).Select(c => c.Item) }, ct);
        return TypedResults.Ok(await AppStatusAsync(context, tenant, app, ct));
    }

    public static async Task<Results<Ok<AppKit>, NotFound, BadRequest<ProblemDetails>>> GetAppKit(
        HttpContext http, ControlContext context, IAuditWriter audit, string slug, string platform, CancellationToken ct)
    {
        if (platform is not ("android" or "ios")) return Problem("The platform is android or ios.");
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        var app = await context.TenantApps.AsNoTracking().SingleOrDefaultAsync(a => a.TenantId == tenant.Id, ct);
        // The shared app, or an own app with nothing set yet: an empty kit, and the build keeps its environment's secrets
        var kit = tenant.AppId is null || app is null ? new AppKit() : Kit(app, platform);
        // Who read what, never a value: the run is named by the header fetch-kit.sh sends
        var given = kit.GetType().GetProperties().Where(p => p.PropertyType == typeof(string) && p.GetValue(kit) is not null).Select(p => p.Name).ToList();
        await audit.WriteAsync("tenant.app.kit.read", slug, new { platform, run = http.Request.Headers["X-Build-Run"].ToString(), given }, ct);
        return TypedResults.Ok(kit);
    }

    public static async Task<Results<Ok<CarryAppKitResult>, NotFound, BadRequest<ProblemDetails>>> CarryAppKit(
        ControlContext context, IAuditWriter audit, string slug, CarryAppKitRequest request, CancellationToken ct)
    {
        if (await OwnAppAsync(context, slug, ct) is not { } found) return TypedResults.NotFound();
        var (tenant, app) = found;
        if (Refuse(tenant) is { } refused) return refused;

        var result = AppCarry.Apply(tenant, app, request);
        if (result.Filled.Count > 0)
        {
            app.UpdatedAt = DateTime.UtcNow;
            await context.SaveChangesAsync(ct);
        }
        await audit.WriteAsync("tenant.app.carried", slug, result, ct);
        return TypedResults.Ok(result);
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>, Conflict<ProblemDetails>>> ReportUploadKey(
        ControlContext context, IAuditWriter audit, string slug, ReportFingerprintsRequest request, CancellationToken ct)
    {
        if (await OwnAppAsync(context, slug, ct) is not { } found) return TypedResults.NotFound();
        var (tenant, app) = found;
        if (app.UploadKeystore is null) return Problem("The business has no upload key here.");
        var sha256 = AppLinks.NormalizeFingerprints(request.Sha256, out var error);
        if (sha256 is null || sha256.Contains(',')) return Problem(error ?? "One SHA-256 fingerprint.");
        var sha1 = AppCarry.NormalizeSha1(request.Sha1);
        if (sha1 is null) return Problem("The SHA-1 is 20 bytes in hex, as keytool -list -v shows it.");
        // Taken once: a key whose fingerprints are known is not re-described by a build
        if (app.UploadKeySha256 is not null)
            return app.UploadKeySha256 == sha256 ? TypedResults.Ok() : TypedResults.Conflict(new ProblemDetails { Detail = "The upload key's fingerprints are known and differ from these." });

        app.UploadKeySha1 = sha1;
        app.UploadKeySha256 = sha256;
        tenant.AndroidCertFingerprints = MergeFingerprints(tenant.AndroidCertFingerprints, add: sha256, remove: null);
        app.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("tenant.app.android-key", slug, new { how = "reported by the build", sha256 }, ct);
        return TypedResults.Ok();
    }

    internal static AppKit Kit(TenantApp app, string platform)
    {
        string? Base64(byte[]? bytes) => bytes is null ? null : System.Convert.ToBase64String(bytes);
        return platform == "android"
            ? new AppKit(
                GoogleServicesJson: app.GoogleServicesJson,
                Keystore: app.UploadKeystore,
                KeyAlias: app.KeyAlias,
                KeyPassword: app.KeyPassword,
                StorePassword: app.StorePassword,
                FingerprintsKnown: app.UploadKeySha256 is not null,
                PlayServiceAccountJson: app.PlayServiceAccountJson,
                Icon: Base64(app.Icon),
                IconForeground: Base64(app.IconForeground))
            : new AppKit(
                GoogleServiceInfoPlist: app.GoogleServiceInfoPlist,
                AscKeyId: app.AscKeyId,
                AscIssuerId: app.AscIssuerId,
                AscPrivateKey: app.AscPrivateKey,
                Icon: Base64(app.Icon));
    }

    /// <summary>The key in place of the old one; the record's App Links fingerprints lose the old upload key's and gain the new one's.</summary>
    internal static void SetUploadKey(Tenant tenant, TenantApp app, UploadKey key)
    {
        tenant.AndroidCertFingerprints = MergeFingerprints(tenant.AndroidCertFingerprints, add: key.Sha256, remove: app.UploadKeySha256);
        app.UploadKeystore = System.Convert.ToBase64String(key.Keystore);
        app.KeyAlias = key.Alias;
        app.KeyPassword = key.KeyPassword;
        app.StorePassword = key.StorePassword;
        app.UploadKeySha1 = key.Sha1;
        app.UploadKeySha256 = key.Sha256;
        app.UpdatedAt = DateTime.UtcNow;
    }

    internal static string? MergeFingerprints(string? stored, string? add, string? remove)
    {
        var list = AppLinks.Fingerprints(stored).Where(f => f != remove).ToList();
        if (add is not null && !list.Contains(add)) list.Add(add);
        return list.Count == 0 ? null : string.Join(',', list);
    }

    private static async Task<(Tenant Tenant, TenantApp App)?> OwnAppAsync(ControlContext context, string slug, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return null;
        var app = await context.TenantApps.SingleOrDefaultAsync(a => a.TenantId == tenant.Id, ct);
        if (app is null)
        {
            app = new TenantApp { TenantId = tenant.Id, UpdatedAt = DateTime.UtcNow };
            context.TenantApps.Add(app);
        }
        return (tenant, app);
    }

    private static BadRequest<ProblemDetails>? Refuse(Tenant tenant)
        => tenant.AppId is null ? Problem("The business has no app of its own: give its app id on the record (Own customer app) first.") : null;

    private static BadRequest<ProblemDetails> Problem(string detail) => TypedResults.BadRequest(new ProblemDetails { Detail = detail });

    private static byte[]? Png(string base64)
    {
        try
        {
            return System.Convert.FromBase64String(base64.Contains(',') ? base64[(base64.IndexOf(',') + 1)..] : base64);
        }
        catch (FormatException)
        {
            return null;
        }
    }

    private static Task<AppCheck> TryAsync(string item, Func<Task<string?>> check, string ok) => TryAsync(item, check, () => ok);

    private static async Task<AppCheck> TryAsync(string item, Func<Task<string?>> check, Func<string> ok)
    {
        try
        {
            return await check() is { } missing ? new AppCheck(item, false, missing) : new AppCheck(item, true, ok());
        }
        catch (StoreKeyException e)
        {
            return new AppCheck(item, false, e.Message);
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or System.Security.Cryptography.CryptographicException)
        {
            return new AppCheck(item, false, $"Could not ask: {e.Message}");
        }
    }

    internal static async Task<FirebaseApps?> FirebaseAppsAsync(ControlContext context, IHttpClientFactory clients, CancellationToken ct)
    {
        var settings = await context.FirebaseSettings.AsNoTracking().SingleOrDefaultAsync(f => f.Id == FirebaseSettings.SingletonId, ct);
        return GoogleServiceAccount.Parse(settings?.ServiceAccountJson, out _) is { } account && account.ProjectId.Length > 0
            ? new FirebaseApps(clients.CreateClient(FirebaseApps.ClientName), account)
            : null;
    }

    private static async Task<TenantAppStatus> AppStatusAsync(ControlContext context, Tenant tenant, TenantApp? app, CancellationToken ct)
    {
        var platformReady = await context.FirebaseSettings.AsNoTracking().AnyAsync(f => f.Id == FirebaseSettings.SingletonId && f.ServiceAccountJson != null, ct);
        var checks = app?.Checks is { } json ? System.Text.Json.JsonSerializer.Deserialize<List<AppCheck>>(json, System.Text.Json.JsonSerializerOptions.Web) ?? [] : [];
        return new TenantAppStatus(
            tenant.AppId,
            new AndroidKeyStatus(app?.UploadKeystore is not null,
                app?.UploadKeystore is null ? null : app.UploadKeySha256 is null && UploadKeys.IsJks(System.Convert.FromBase64String(app.UploadKeystore)) ? "jks" : "pkcs12",
                app?.KeyAlias, app?.UploadKeySha1, app?.UploadKeySha256),
            new PlayKeyStatus(app?.PlayServiceAccountJson is not null, GoogleServiceAccount.Parse(app?.PlayServiceAccountJson, out _)?.ClientEmail),
            new AppleKeyStatus(app?.AscPrivateKey is not null, app?.AscKeyId, app?.AscIssuerId),
            new AppIconsStatus(app?.Icon is not null, app?.IconForeground is not null),
            new AppFirebaseStatus(platformReady, app?.FirebaseAndroidAppId, app?.FirebaseIosAppId, app?.GoogleServicesJson is not null, app?.GoogleServiceInfoPlist is not null),
            checks,
            app?.CheckedAt);
    }

    [System.Text.RegularExpressions.GeneratedRegex("^[A-Z0-9]{10}$")]
    private static partial System.Text.RegularExpressions.Regex AscKeyId();
}
