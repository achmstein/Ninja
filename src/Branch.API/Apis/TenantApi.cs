using System.ComponentModel;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Ninja.Branch.API.Model;
using Ninja.Branch.API.Services;

namespace Ninja.Branch.API.Apis;

/// <summary>
/// The brand every surface reads at boot (anonymous: the customer menu shows
/// it before anyone signs in) and the owner's endpoints to change it. The
/// manifest is served from here too, so installing the customer web app puts
/// the café's own name and icon on the phone without a build.
/// </summary>
public static partial class TenantApi
{
    private const string OneYear = "public, max-age=31536000, immutable";

    public static IEndpointRouteBuilder MapTenantApi(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("api/tenant").WithTags("Tenant");

        api.MapGet("/", GetTenant)
            .WithName("GetTenant")
            .WithSummary("The tenant's name, color, logo URLs and feature switches");

        api.MapPut("/", UpdateTenant)
            .WithName("UpdateTenant")
            .WithSummary("Change the name, the brand color or the feature switches")
            .RequireAuthorization("Owner");

        api.MapPut("/images/{slot}", UploadImage)
            .WithName("UploadTenantImage")
            .WithSummary("Replace one image: logo, logo-dark, wordmark-en, wordmark-en-dark, wordmark-ar or wordmark-ar-dark; the icons are cut from the logo")
            .RequireAuthorization("Owner")
            .DisableAntiforgery();

        api.MapDelete("/images/{slot}", DeleteImage)
            .WithName("DeleteTenantImage")
            .WithSummary("Remove one image; the surfaces fall back (dark to light, Arabic to English, the wordmark to the mark and the name)")
            .RequireAuthorization("Owner");

        api.MapGet("/images/{slot}", GetImage)
            .WithName("GetTenantImage")
            .WithSummary("One image as PNG, transparent margins trimmed");

        api.MapGet("/icons/{name}", GetIcon)
            .WithName("GetTenantIcon")
            .WithSummary("One of icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png, favicon.png");

        api.MapGet("/manifest", GetManifest)
            .WithName("GetTenantManifest")
            .WithSummary("The web app manifest for one surface, in the tenant's name");

        return app;
    }

    public static async Task<Ok<TenantResponse>> GetTenant(BranchContext context, IConfiguration configuration)
    {
        var tenant = await context.Tenants.AsNoTracking().SingleAsync(t => t.Id == Tenant.SingletonId);
        return TypedResults.Ok(TenantResponse.From(tenant, configuration["Tenant:AuthUrl"]));
    }

    public static async Task<Results<Ok<TenantResponse>, BadRequest<ProblemDetails>>> UpdateTenant(
        BranchContext context,
        IConfiguration configuration,
        UpdateTenantRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name.En))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The English name is required." });

        var color = request.PrimaryColor?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(color) && !HexColor().IsMatch(color))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The color must be #rrggbb." });

        var customerUrl = request.CustomerUrl?.Trim().TrimEnd('/');
        if (!string.IsNullOrEmpty(customerUrl)
            && (!Uri.TryCreate(customerUrl, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https")))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The customer URL must be an absolute http(s) URL." });

        var theme = NormalizeTheme(request.Theme, out var themeError);
        if (themeError is not null)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = themeError });

        var tenant = await context.Tenants.SingleAsync(t => t.Id == Tenant.SingletonId);
        tenant.Name = request.Name;
        tenant.PrimaryColor = string.IsNullOrEmpty(color) ? null : color;
        tenant.CustomerUrl = string.IsNullOrEmpty(customerUrl) ? null : customerUrl;
        tenant.Theme = theme;
        tenant.RoomsEnabled = request.Features.Rooms;
        tenant.LoyaltyEnabled = request.Features.Loyalty;
        tenant.TabsEnabled = request.Features.Tabs;
        tenant.InventoryEnabled = request.Features.Inventory;
        tenant.FinanceEnabled = request.Features.Finance;
        tenant.PayrollEnabled = request.Features.Payroll;
        tenant.KdsEnabled = request.Features.Kds;
        tenant.UpdatedAt = DateTimeOffset.UtcNow;
        await context.SaveChangesAsync();

        return TypedResults.Ok(TenantResponse.From(tenant, configuration["Tenant:AuthUrl"]));
    }

    public static async Task<Results<Ok<TenantResponse>, BadRequest<ProblemDetails>, NotFound>> UploadImage(
        BranchContext context,
        IConfiguration configuration,
        TenantBrandStore store,
        string slot,
        IFormFile file,
        CancellationToken ct)
    {
        if (!TenantImageSlots.IsKnown(slot))
            return TypedResults.NotFound();

        var (width, height, error) = await store.SaveAsync(slot, file, ct);
        if (error is not null)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = error });

        var tenant = await context.Tenants.SingleAsync(t => t.Id == Tenant.SingletonId, ct);
        tenant.UpdatedAt = DateTimeOffset.UtcNow;
        // A new dictionary, so the change tracker sees the property change
        tenant.Images = new Dictionary<string, TenantImage>(tenant.Images)
        {
            [slot] = new() { Version = tenant.UpdatedAt.UtcTicks, Width = width, Height = height },
        };
        await context.SaveChangesAsync(ct);

        return TypedResults.Ok(TenantResponse.From(tenant, configuration["Tenant:AuthUrl"]));
    }

    public static async Task<Results<Ok<TenantResponse>, NotFound>> DeleteImage(BranchContext context, IConfiguration configuration, TenantBrandStore store, string slot)
    {
        if (!TenantImageSlots.IsKnown(slot))
            return TypedResults.NotFound();

        store.Delete(slot);

        var tenant = await context.Tenants.SingleAsync(t => t.Id == Tenant.SingletonId);
        var images = new Dictionary<string, TenantImage>(tenant.Images);
        images.Remove(slot);
        tenant.Images = images;
        tenant.UpdatedAt = DateTimeOffset.UtcNow;
        await context.SaveChangesAsync();

        return TypedResults.Ok(TenantResponse.From(tenant, configuration["Tenant:AuthUrl"]));
    }

    public static Results<PhysicalFileHttpResult, NotFound> GetImage(
        TenantBrandStore store,
        HttpContext http,
        string slot,
        [Description("Cache key; any value makes the answer immutable")] string? v)
    {
        if (!TenantImageSlots.IsKnown(slot) || !store.HasImage(slot))
            return TypedResults.NotFound();

        SetCache(http, v);
        return TypedResults.PhysicalFile(store.PathOfSlot(slot), "image/png");
    }

    public static async Task<Results<PhysicalFileHttpResult, FileContentHttpResult, NotFound>> GetIcon(
        BranchContext context,
        TenantBrandStore store,
        HttpContext http,
        string name,
        [Description("Cache key; any value makes the answer immutable")] string? v,
        [Description("The platform's own neutral icon, for the staff apps")] bool platform = false)
    {
        if (!TenantBrandStore.Icons.TryGetValue(name, out var spec))
            return TypedResults.NotFound();

        if (platform)
        {
            // Never changes, so always immutable
            http.Response.Headers.CacheControl = OneYear;
            return TypedResults.File(TenantBrandStore.RenderPlaceholder(spec, null), "image/png");
        }

        SetCache(http, v);

        if (store.Exists(name))
            return TypedResults.PhysicalFile(store.PathOf(name), "image/png");

        var tenant = await context.Tenants.AsNoTracking().SingleAsync(t => t.Id == Tenant.SingletonId);
        return TypedResults.File(TenantBrandStore.RenderPlaceholder(spec, tenant.PrimaryColor), "image/png");
    }

    public static async Task<Results<JsonHttpResult<WebManifest>, BadRequest<ProblemDetails>>> GetManifest(
        BranchContext context,
        HttpContext http,
        [Description("client, admin, pos or kds")] string app = "client",
        [Description("en or ar")] string lang = "en")
    {
        if (app is not ("client" or "admin" or "pos" or "kds"))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "app must be client, admin, pos or kds." });

        var arabic = string.Equals(lang, "ar", StringComparison.OrdinalIgnoreCase);

        // Only the customer app wears the tenant's brand; the staff apps are
        // the platform's, whatever café they are signed into (ninja-plan.md)
        if (app != "client")
        {
            var staffName = app switch
            {
                "admin" => arabic ? "Ninja · الإدارة" : "Ninja Admin",
                "pos" => arabic ? "Ninja · الكاشير" : "Ninja Till",
                _ => arabic ? "Ninja · المطبخ" : "Ninja Kitchen",
            };
            http.Response.Headers.CacheControl = "no-cache";
            return TypedResults.Json(Manifest(staffName, "Ninja", arabic, "#18181b",
            [
                new("/api/tenant/icons/icon-192.png?platform=1", "192x192", "image/png", "any"),
                new("/api/tenant/icons/icon-512.png?platform=1", "512x512", "image/png", "any"),
                new("/api/tenant/icons/maskable-512.png?platform=1", "512x512", "image/png", "maskable"),
            ]), contentType: "application/manifest+json");
        }

        var tenant = await context.Tenants.AsNoTracking().SingleAsync(t => t.Id == Tenant.SingletonId);
        var brand = tenant.Name.GetText(arabic ? "ar" : "en");
        var v = tenant.Version;
        var manifest = Manifest(brand, brand.Length <= 12 ? brand : brand[..12].TrimEnd(), arabic, tenant.PrimaryColor ?? "#18181b",
        [
            new($"/api/tenant/icons/icon-192.png?v={v}", "192x192", "image/png", "any"),
            new($"/api/tenant/icons/icon-512.png?v={v}", "512x512", "image/png", "any"),
            new($"/api/tenant/icons/maskable-512.png?v={v}", "512x512", "image/png", "maskable"),
        ]);

        http.Response.Headers.CacheControl = "no-cache";
        return TypedResults.Json(manifest, contentType: "application/manifest+json");
    }

    private static WebManifest Manifest(string name, string shortName, bool arabic, string themeColor, IReadOnlyList<WebManifestIcon> icons)
        => new(
            Name: name,
            ShortName: shortName,
            Lang: arabic ? "ar" : "en",
            Dir: arabic ? "rtl" : "ltr",
            StartUrl: "/",
            Scope: "/",
            Display: "standalone",
            ThemeColor: themeColor,
            BackgroundColor: "#ffffff",
            Icons: icons);

    /// <summary>Trimmed, lower-cased, checked against the allowlists; empty strings become null.</summary>
    private static TenantTheme NormalizeTheme(TenantThemeDto? dto, out string? error)
    {
        error = null;
        var theme = new TenantTheme();
        if (dto is null) return theme;

        static string? Color(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToLowerInvariant();

        theme.Accent = Color(dto.Accent);
        theme.Background = Color(dto.Background);
        theme.Foreground = Color(dto.Foreground);
        foreach (var (label, value) in new[] { ("accent", theme.Accent), ("background", theme.Background), ("foreground", theme.Foreground) })
        {
            if (value is not null && !HexColor().IsMatch(value))
            {
                error = $"The {label} color must be #rrggbb.";
                return theme;
            }
        }

        theme.Radius = string.IsNullOrWhiteSpace(dto.Radius) ? null : dto.Radius.Trim().ToLowerInvariant();
        if (theme.Radius is not null && !TenantTheme.Radii.Contains(theme.Radius))
        {
            error = $"The radius must be one of {string.Join(", ", TenantTheme.Radii)}.";
            return theme;
        }

        theme.Font = string.IsNullOrWhiteSpace(dto.Font) ? null : dto.Font.Trim();
        if (theme.Font is not null)
        {
            var match = TenantTheme.Fonts.FirstOrDefault(f => string.Equals(f, theme.Font, StringComparison.OrdinalIgnoreCase));
            if (match is null)
            {
                error = $"The font must be one of {string.Join(", ", TenantTheme.Fonts)}.";
                return theme;
            }
            theme.Font = match;
        }

        return theme;
    }

    private static void SetCache(HttpContext http, string? v)
        => http.Response.Headers.CacheControl = string.IsNullOrEmpty(v) ? "no-cache" : OneYear;

    [GeneratedRegex("^#[0-9a-f]{6}$")]
    private static partial Regex HexColor();
}

public record TenantFeatures(bool Rooms, bool Loyalty, bool Tabs, bool Inventory, bool Finance, bool Payroll, bool Kds);

public record TenantIcons(string Icon192, string Icon512, string Maskable512, string AppleTouch, string Favicon);

/// <param name="Url">Versioned, immutable.</param>
/// <param name="Width">Pixels after trimming, so a surface can reserve the box before the image loads.</param>
public record TenantWordmark(string Url, int Width, int Height)
{
    public static TenantWordmark? From(Tenant t, string slot)
        => t.Image(slot) is { } image ? new(ImageUrl(slot, image), image.Width, image.Height) : null;

    public static string ImageUrl(string slot, TenantImage image) => $"/api/tenant/images/{slot}?v={image.Version}";
}

/// <summary>The wide lockups by language and scheme; a null falls back on the surface: dark to light, Arabic to English, then the mark and the name.</summary>
public record TenantWordmarks(TenantWordmark? En, TenantWordmark? EnDark, TenantWordmark? Ar, TenantWordmark? ArDark)
{
    public static TenantWordmarks From(Tenant t) => new(
        TenantWordmark.From(t, TenantImageSlots.WordmarkEn),
        TenantWordmark.From(t, TenantImageSlots.WordmarkEnDark),
        TenantWordmark.From(t, TenantImageSlots.WordmarkAr),
        TenantWordmark.From(t, TenantImageSlots.WordmarkArDark));
}

public record TenantThemeDto(string? Accent, string? Background, string? Foreground, string? Radius, string? Font)
{
    public static TenantThemeDto From(TenantTheme t) => new(t.Accent, t.Background, t.Foreground, t.Radius, t.Font);
}

/// <param name="Authority">The OpenID issuer the apps sign in against ("https://auth.example.com/realms/slug"); null when the build's own setting stands.</param>
public record TenantAuth(string Authority);

/// <param name="LogoUrl">The square mark, light scheme; null when none is uploaded (the icons are then a tile in the brand color).</param>
/// <param name="LogoDarkUrl">The mark for dark backgrounds; null falls back to <paramref name="LogoUrl"/>.</param>
public record TenantResponse(
    LocalizedText Name,
    string? PrimaryColor,
    string? CustomerUrl,
    TenantAuth? Auth,
    string? LogoUrl,
    string? LogoDarkUrl,
    TenantWordmarks Wordmarks,
    TenantThemeDto Theme,
    TenantIcons Icons,
    TenantFeatures Features,
    long Version)
{
    public static TenantResponse From(Tenant t, string? authUrl)
    {
        var v = t.Version;
        return new(
            t.Name,
            t.PrimaryColor,
            t.CustomerUrl,
            string.IsNullOrWhiteSpace(authUrl) ? null : new TenantAuth(authUrl.TrimEnd('/')),
            t.Image(TenantImageSlots.Logo) is { } logo ? TenantWordmark.ImageUrl(TenantImageSlots.Logo, logo) : null,
            t.Image(TenantImageSlots.LogoDark) is { } logoDark ? TenantWordmark.ImageUrl(TenantImageSlots.LogoDark, logoDark) : null,
            TenantWordmarks.From(t),
            TenantThemeDto.From(t.Theme),
            new(
                $"/api/tenant/icons/icon-192.png?v={v}",
                $"/api/tenant/icons/icon-512.png?v={v}",
                $"/api/tenant/icons/maskable-512.png?v={v}",
                $"/api/tenant/icons/apple-touch-icon.png?v={v}",
                $"/api/tenant/icons/favicon.png?v={v}"),
            new(t.RoomsEnabled, t.LoyaltyEnabled, t.TabsEnabled, t.InventoryEnabled, t.FinanceEnabled, t.PayrollEnabled, t.KdsEnabled),
            v);
    }
}

public record UpdateTenantRequest(LocalizedText Name, string? PrimaryColor, string? CustomerUrl, TenantFeatures Features, TenantThemeDto? Theme = null);

public record WebManifestIcon(string Src, string Sizes, string Type, string Purpose);

public record WebManifest(
    string Name,
    string ShortName,
    string Lang,
    string Dir,
    string StartUrl,
    string Scope,
    string Display,
    string ThemeColor,
    string BackgroundColor,
    IReadOnlyList<WebManifestIcon> Icons);
