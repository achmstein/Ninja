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

        api.MapPut("/logo", UploadLogo)
            .WithName("UploadTenantLogo")
            .WithSummary("Replace the logo; the icons are cut from it")
            .RequireAuthorization("Owner")
            .DisableAntiforgery();

        api.MapDelete("/logo", DeleteLogo)
            .WithName("DeleteTenantLogo")
            .WithSummary("Remove the logo; the icons fall back to a tile in the brand color")
            .RequireAuthorization("Owner");

        api.MapGet("/logo", GetLogo)
            .WithName("GetTenantLogo")
            .WithSummary("The logo as PNG, transparent margins trimmed");

        api.MapGet("/icons/{name}", GetIcon)
            .WithName("GetTenantIcon")
            .WithSummary("One of icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png, favicon.png");

        api.MapGet("/manifest", GetManifest)
            .WithName("GetTenantManifest")
            .WithSummary("The web app manifest for one surface, in the tenant's name");

        return app;
    }

    public static async Task<Ok<TenantResponse>> GetTenant(BranchContext context)
    {
        var tenant = await context.Tenants.AsNoTracking().SingleAsync(t => t.Id == Tenant.SingletonId);
        return TypedResults.Ok(TenantResponse.From(tenant));
    }

    public static async Task<Results<Ok<TenantResponse>, BadRequest<ProblemDetails>>> UpdateTenant(
        BranchContext context,
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

        var tenant = await context.Tenants.SingleAsync(t => t.Id == Tenant.SingletonId);
        tenant.Name = request.Name;
        tenant.PrimaryColor = string.IsNullOrEmpty(color) ? null : color;
        tenant.CustomerUrl = string.IsNullOrEmpty(customerUrl) ? null : customerUrl;
        tenant.RoomsEnabled = request.Features.Rooms;
        tenant.LoyaltyEnabled = request.Features.Loyalty;
        tenant.TabsEnabled = request.Features.Tabs;
        tenant.InventoryEnabled = request.Features.Inventory;
        tenant.FinanceEnabled = request.Features.Finance;
        tenant.PayrollEnabled = request.Features.Payroll;
        tenant.KdsEnabled = request.Features.Kds;
        tenant.UpdatedAt = DateTimeOffset.UtcNow;
        await context.SaveChangesAsync();

        return TypedResults.Ok(TenantResponse.From(tenant));
    }

    public static async Task<Results<Ok<TenantResponse>, BadRequest<ProblemDetails>>> UploadLogo(
        BranchContext context,
        TenantBrandStore store,
        IFormFile file,
        CancellationToken ct)
    {
        var error = await store.SaveLogoAsync(file, ct);
        if (error is not null)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = error });

        var tenant = await context.Tenants.SingleAsync(t => t.Id == Tenant.SingletonId, ct);
        tenant.UpdatedAt = DateTimeOffset.UtcNow;
        tenant.LogoVersion = tenant.UpdatedAt.UtcTicks;
        await context.SaveChangesAsync(ct);

        return TypedResults.Ok(TenantResponse.From(tenant));
    }

    public static async Task<Ok<TenantResponse>> DeleteLogo(BranchContext context, TenantBrandStore store)
    {
        store.DeleteLogo();

        var tenant = await context.Tenants.SingleAsync(t => t.Id == Tenant.SingletonId);
        tenant.LogoVersion = 0;
        tenant.UpdatedAt = DateTimeOffset.UtcNow;
        await context.SaveChangesAsync();

        return TypedResults.Ok(TenantResponse.From(tenant));
    }

    public static Results<PhysicalFileHttpResult, NotFound> GetLogo(
        TenantBrandStore store,
        HttpContext http,
        [Description("Cache key; any value makes the answer immutable")] string? v)
    {
        if (!store.Exists(TenantBrandStore.LogoFile))
            return TypedResults.NotFound();

        SetCache(http, v);
        return TypedResults.PhysicalFile(store.PathOf(TenantBrandStore.LogoFile), "image/png");
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

    private static void SetCache(HttpContext http, string? v)
        => http.Response.Headers.CacheControl = string.IsNullOrEmpty(v) ? "no-cache" : OneYear;

    [GeneratedRegex("^#[0-9a-f]{6}$")]
    private static partial Regex HexColor();
}

public record TenantFeatures(bool Rooms, bool Loyalty, bool Tabs, bool Inventory, bool Finance, bool Payroll, bool Kds);

public record TenantIcons(string Icon192, string Icon512, string Maskable512, string AppleTouch, string Favicon);

public record TenantResponse(
    LocalizedText Name,
    string? PrimaryColor,
    string? CustomerUrl,
    string? LogoUrl,
    TenantIcons Icons,
    TenantFeatures Features,
    long Version)
{
    public static TenantResponse From(Tenant t)
    {
        var v = t.Version;
        return new(
            t.Name,
            t.PrimaryColor,
            t.CustomerUrl,
            t.HasLogo ? $"/api/tenant/logo?v={t.LogoVersion}" : null,
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

public record UpdateTenantRequest(LocalizedText Name, string? PrimaryColor, string? CustomerUrl, TenantFeatures Features);

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
