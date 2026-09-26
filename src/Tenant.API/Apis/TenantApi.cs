using Ninja.ServiceDefaults;
using System.ComponentModel;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Ninja.Tenant.API.IntegrationEvents;
using Ninja.Tenant.API.Model;
using Ninja.Tenant.API.Services;
using Ninja.EventBus.Abstractions;

namespace Ninja.Tenant.API.Apis;

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
            .WithSummary("Change the name, the brand color or the feature switches (within what the plan allows)")
            .RequireAuthorization("Owner");

        api.MapPut("/assistant", SetAssistant)
            .WithName("SetTenantAssistant")
            .WithSummary("How the owner's AI assistant speaks: its tone, manner, language and the café's notes for it")
            .RequireAuthorization("Owner");

        api.MapPut("/entitlements", SetEntitlements)
            .WithName("SetTenantEntitlements")
            .WithSummary("The modules the café's plan allows; a switch outside them goes off. The control plane only")
            .RequireAuthorization("Control");

        // Where the gateway sends a request for a module that is not in the plan
        api.MapMethods("/module-off", ["GET", "POST", "PUT", "DELETE", "PATCH"], ModuleOff)
            .WithName("ModuleOff")
            .ExcludeFromDescription();

        api.MapPut("/images/{slot}", UploadImage)
            .WithName("UploadTenantImage")
            .WithSummary("Replace one image: logo, logo-dark, wordmark-en, wordmark-en-dark, wordmark-ar, wordmark-ar-dark or cover; the icons are cut from the logo")
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

    public static async Task<Ok<TenantResponse>> GetTenant(TenantContext context, IConfiguration configuration)
    {
        var tenant = await context.Tenants.AsNoTracking().SingleAsync(t => t.Id == Model.Tenant.SingletonId);
        return TypedResults.Ok(TenantResponse.From(tenant, configuration));
    }

    public static async Task<Results<Ok<TenantResponse>, BadRequest<ProblemDetails>>> UpdateTenant(
        TenantContext context,
        IConfiguration configuration,
        IEventBus eventBus,
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

        var locale = NormalizeLocale(request.Locale, out var localeError);
        if (localeError is not null)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = localeError });

        var tenant = await context.Tenants.SingleAsync(t => t.Id == Model.Tenant.SingletonId);
        tenant.Name = request.Name;
        tenant.PrimaryColor = string.IsNullOrEmpty(color) ? null : color;
        tenant.CustomerUrl = string.IsNullOrEmpty(customerUrl) ? null : customerUrl;
        tenant.Theme = theme;
        if (request.BusinessType is { Length: > 0 } business) tenant.BusinessType = business.Trim().ToLowerInvariant();
        var guestsChanged = request.GuestOrdersAnywhere is { } anywhere && anywhere != tenant.GuestOrdersAnywhere;
        if (guestsChanged) tenant.GuestOrdersAnywhere = request.GuestOrdersAnywhere!.Value;
        if (locale is { } l)
        {
            tenant.Country = l.Country;
            tenant.Currency = l.Currency;
            tenant.TimeZone = l.TimeZone;
            tenant.DefaultLanguage = l.Language;
            if (l.ArabicStyle is not null) tenant.ArabicStyle = l.ArabicStyle;
        }
        // An owner may switch an entitled module off, never an unentitled one on
        tenant.ApplyFeatures(request.Features);
        tenant.UpdatedAt = DateTimeOffset.UtcNow;
        await context.SaveChangesAsync();
        // The services that own a module keep their own copy of the switches
        await eventBus.PublishAsync(TenantFeaturesChangedIntegrationEvent.From(tenant.Features));
        // The café's own settings travel on their own; Ordering keeps its copy
        if (guestsChanged) await eventBus.PublishAsync(TenantSettingsChangedIntegrationEvent.From(tenant));

        return TypedResults.Ok(TenantResponse.From(tenant, configuration));
    }

    public static async Task<Results<Ok<TenantResponse>, BadRequest<ProblemDetails>>> SetAssistant(TenantContext context, IConfiguration configuration, AssistantDto request)
    {
        static string? Pick(string? value, string[] allowed, string label, ref string? error)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            var v = value.Trim().ToLowerInvariant();
            if (!allowed.Contains(v)) error ??= $"The {label} must be one of {string.Join(", ", allowed)}.";
            return v;
        }
        string? error = null;
        var settings = new AssistantSettings
        {
            Tone = Pick(request.Tone, AssistantSettings.Tones, "tone", ref error),
            Manner = Pick(request.Manner, AssistantSettings.Manners, "manner", ref error),
            Language = Pick(request.Language, AssistantSettings.Languages, "language", ref error),
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
        };
        if (settings.Notes?.Length > AssistantSettings.MaxNotes) error ??= $"The notes are at most {AssistantSettings.MaxNotes} characters.";
        if (error is not null) return TypedResults.BadRequest<ProblemDetails>(new() { Detail = error });

        var tenant = await context.Tenants.SingleAsync(t => t.Id == Model.Tenant.SingletonId);
        tenant.Assistant = settings;
        tenant.UpdatedAt = DateTimeOffset.UtcNow;
        await context.SaveChangesAsync();
        return TypedResults.Ok(TenantResponse.From(tenant, configuration));
    }

    public static async Task<Ok<TenantResponse>> SetEntitlements(TenantContext context, IConfiguration configuration, IEventBus eventBus, TenantFeatures request)
    {
        var tenant = await context.Tenants.SingleAsync(t => t.Id == Model.Tenant.SingletonId);
        tenant.ApplyEntitlements(request);
        tenant.UpdatedAt = DateTimeOffset.UtcNow;
        await context.SaveChangesAsync();
        await eventBus.PublishAsync(TenantFeaturesChangedIntegrationEvent.From(tenant.Features));
        return TypedResults.Ok(TenantResponse.From(tenant, configuration));
    }

    public static ProblemHttpResult ModuleOff(HttpContext http)
        => TypedResults.Problem(
            title: "Module not in plan",
            detail: "This module is not part of the café's subscription.",
            type: "module-off",
            statusCode: StatusCodes.Status402PaymentRequired,
            extensions: new Dictionary<string, object?> { ["module"] = http.Request.Query["module"].ToString() });

    public static async Task<Results<Ok<TenantResponse>, BadRequest<ProblemDetails>, NotFound>> UploadImage(
        TenantContext context,
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

        var tenant = await context.Tenants.SingleAsync(t => t.Id == Model.Tenant.SingletonId, ct);
        tenant.UpdatedAt = DateTimeOffset.UtcNow;
        // A new dictionary, so the change tracker sees the property change
        tenant.Images = new Dictionary<string, TenantImage>(tenant.Images)
        {
            [slot] = new() { Version = tenant.UpdatedAt.UtcTicks, Width = width, Height = height },
        };
        await context.SaveChangesAsync(ct);

        return TypedResults.Ok(TenantResponse.From(tenant, configuration));
    }

    public static async Task<Results<Ok<TenantResponse>, NotFound>> DeleteImage(TenantContext context, IConfiguration configuration, TenantBrandStore store, string slot)
    {
        if (!TenantImageSlots.IsKnown(slot))
            return TypedResults.NotFound();

        store.Delete(slot);

        var tenant = await context.Tenants.SingleAsync(t => t.Id == Model.Tenant.SingletonId);
        var images = new Dictionary<string, TenantImage>(tenant.Images);
        images.Remove(slot);
        tenant.Images = images;
        tenant.UpdatedAt = DateTimeOffset.UtcNow;
        await context.SaveChangesAsync();

        return TypedResults.Ok(TenantResponse.From(tenant, configuration));
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
        return TypedResults.PhysicalFile(store.PathOfSlot(slot), TenantBrandStore.ContentTypeOf(slot));
    }

    public static async Task<Results<PhysicalFileHttpResult, FileContentHttpResult, NotFound>> GetIcon(
        TenantContext context,
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

        var tenant = await context.Tenants.AsNoTracking().SingleAsync(t => t.Id == Model.Tenant.SingletonId);
        return TypedResults.File(TenantBrandStore.RenderPlaceholder(spec, tenant.PrimaryColor), "image/png");
    }

    public static async Task<Results<JsonHttpResult<WebManifest>, BadRequest<ProblemDetails>>> GetManifest(
        TenantContext context,
        HttpContext http,
        [Description("client, admin, pos or kds")] string app = "client",
        [Description("en or ar")] string lang = "en")
    {
        if (app is not ("client" or "admin" or "pos" or "kds"))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "app must be client, admin, pos or kds." });

        var arabic = string.Equals(lang, "ar", StringComparison.OrdinalIgnoreCase);

        var tenant = await context.Tenants.AsNoTracking().SingleAsync(t => t.Id == Model.Tenant.SingletonId);
        var brand = tenant.Name.GetText(arabic ? "ar" : "en");
        var v = tenant.Version;
        WebManifestIcon[] icons =
        [
            new($"/api/tenant/icons/icon-192.png?v={v}", "192x192", "image/png", "any"),
            new($"/api/tenant/icons/icon-512.png?v={v}", "512x512", "image/png", "any"),
            new($"/api/tenant/icons/maskable-512.png?v={v}", "512x512", "image/png", "maskable"),
        ];

        // Every app is the café's on the home screen: its name and icon, with
        // the staff apps named for their job and kept on the neutral theme
        // (only what customers see wears the café's colour; ninja-plan.md)
        if (app != "client")
        {
            var job = app switch
            {
                "admin" => arabic ? "الإدارة" : "Admin",
                "pos" => arabic ? "الكاشير" : "Till",
                _ => arabic ? "المطبخ" : "Kitchen",
            };
            http.Response.Headers.CacheControl = "no-cache";
            return TypedResults.Json(Manifest($"{brand} · {job}", brand.Length <= 12 ? brand : brand[..12].TrimEnd(), arabic, "#18181b", icons), contentType: "application/manifest+json");
        }

        var manifest = Manifest(brand, brand.Length <= 12 ? brand : brand[..12].TrimEnd(), arabic, tenant.PrimaryColor ?? "#18181b", icons);

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
        theme.Surface = Color(dto.Surface);
        if (dto.Dark is { } dark && (dark.Primary ?? dark.Accent ?? dark.Surface) is not null)
            theme.Dark = new TenantThemeDark { Primary = Color(dark.Primary), Accent = Color(dark.Accent), Surface = Color(dark.Surface) };
        var colors = new[]
        {
            ("accent", theme.Accent), ("surface", theme.Surface),
            ("dark primary", theme.Dark?.Primary), ("dark accent", theme.Dark?.Accent), ("dark surface", theme.Dark?.Surface),
        };
        foreach (var (label, value) in colors)
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

        theme.Mode = string.IsNullOrWhiteSpace(dto.Mode) ? null : dto.Mode.Trim().ToLowerInvariant();
        if (theme.Mode is not null && !TenantTheme.Modes.Contains(theme.Mode))
        {
            error = $"The default theme must be one of {string.Join(", ", TenantTheme.Modes)}, or none to follow the device.";
            return theme;
        }

        theme.HeaderSize = string.IsNullOrWhiteSpace(dto.HeaderSize) ? null : dto.HeaderSize.Trim().ToLowerInvariant();
        if (theme.HeaderSize is not null && !TenantTheme.HeaderSizes.Contains(theme.HeaderSize))
        {
            error = $"The header size must be one of {string.Join(", ", TenantTheme.HeaderSizes)}.";
            return theme;
        }

        theme.FontLatin = Font(dto.FontLatin, TenantTheme.LatinFonts, "Latin", out error);
        if (error is not null) return theme;
        theme.FontArabic = Font(dto.FontArabic, TenantTheme.ArabicFonts, "Arabic", out error);
        if (error is not null) return theme;

        theme.Style = OneOf(dto.Style, TenantTheme.Styles, "style", out error);
        if (error is not null) return theme;
        theme.Layout = NormalizeLayout(dto.Layout, out error);
        return theme;
    }

    /// <summary>Each part checked against its list; a layout that chooses nothing is none.</summary>
    private static TenantLayout? NormalizeLayout(TenantLayoutDto? dto, out string? error)
    {
        error = null;
        if (dto is null) return null;
        var layout = new TenantLayout();
        (string? Value, string[] Allowed, string Label, Action<string?> Set)[] parts =
        [
            (dto.MenuItem, TenantLayout.MenuItems, "menu item layout", v => layout.MenuItem = v),
            (dto.Categories, TenantLayout.CategoryStyles, "categories layout", v => layout.Categories = v),
            (dto.Header, TenantLayout.Headers, "header layout", v => layout.Header = v),
            (dto.Buttons, TenantLayout.ButtonStyles, "button shape", v => layout.Buttons = v),
            (dto.Surface, TenantLayout.Surfaces, "surface", v => layout.Surface = v),
            (dto.Density, TenantLayout.Densities, "density", v => layout.Density = v),
        ];
        foreach (var (value, allowed, label, set) in parts)
        {
            set(OneOf(value, allowed, label, out error));
            if (error is not null) return layout;
        }
        return layout.IsEmpty ? null : layout;
    }

    /// <summary>Trimmed and lower-cased, null for none, an error for anything outside the list.</summary>
    private static string? OneOf(string? value, string[] allowed, string label, out string? error)
    {
        error = null;
        if (string.IsNullOrWhiteSpace(value)) return null;
        var normalized = value.Trim().ToLowerInvariant();
        if (!allowed.Contains(normalized)) error = $"The {label} must be one of {string.Join(", ", allowed)}.";
        return normalized;
    }

    /// <summary>The family as the allowlist spells it, null for none, an error for a family the surfaces cannot load.</summary>
    private static string? Font(string? value, string[] allowed, string script, out string? error)
    {
        error = null;
        if (string.IsNullOrWhiteSpace(value)) return null;
        var match = allowed.FirstOrDefault(f => string.Equals(f, value.Trim(), StringComparison.OrdinalIgnoreCase));
        if (match is null) error = $"The {script} font must be one of {string.Join(", ", allowed)}.";
        return match;
    }

    /// <summary>Upper-cased codes, a zone the runtime knows, ar or en; null leaves the locale as it is.</summary>
    private static TenantLocaleDto? NormalizeLocale(TenantLocaleDto? dto, out string? error)
    {
        error = null;
        if (dto is null) return null;

        var country = dto.Country?.Trim().ToUpperInvariant() ?? "";
        var currency = dto.Currency?.Trim().ToUpperInvariant() ?? "";
        var timeZone = dto.TimeZone?.Trim() ?? "";
        var language = dto.Language?.Trim().ToLowerInvariant() ?? "";
        var arabic = string.IsNullOrWhiteSpace(dto.ArabicStyle) ? null : dto.ArabicStyle.Trim().ToLowerInvariant();

        if (!CountryCode().IsMatch(country)) error = "The country must be an ISO 3166-1 alpha-2 code.";
        else if (!CurrencyCode().IsMatch(currency)) error = "The currency must be an ISO 4217 code.";
        else if (!TimeZoneInfo.TryFindSystemTimeZoneById(timeZone, out _)) error = $"'{timeZone}' is not a known time zone.";
        else if (language is not ("ar" or "en")) error = "The language must be ar or en.";
        else if (arabic is not (null or "standard" or "egyptian")) error = "The Arabic style must be standard or egyptian.";

        return new(country, currency, timeZone, language, arabic);
    }

    private static void SetCache(HttpContext http, string? v)
        => http.Response.Headers.CacheControl = string.IsNullOrEmpty(v) ? "no-cache" : OneYear;

    [GeneratedRegex("^#[0-9a-f]{6}$")]
    private static partial Regex HexColor();

    [GeneratedRegex("^[A-Z]{2}$")]
    private static partial Regex CountryCode();

    [GeneratedRegex("^[A-Z]{3}$")]
    private static partial Regex CurrencyCode();
}

/// <summary>Country (ISO 3166-1), currency (ISO 4217), IANA time zone and the customer app's language ("ar" or "en").</summary>
/// <param name="ArabicStyle">"standard" or "egyptian": which Arabic the café's customers read. Null on a request leaves it as it is.</param>
/// <param name="PhonePattern">The regex a phone number must match here, so the apps ask for what this country writes. Read-only: it follows the country.</param>
/// <param name="PhonePlaceholder">The shape to show in a phone field, e.g. "01xxxxxxxxx". Read-only.</param>
public record TenantLocaleDto(
    string Country,
    string Currency,
    string TimeZone,
    string Language,
    string? ArabicStyle = null,
    string PhonePattern = "",
    string PhonePlaceholder = "")
{
    public static TenantLocaleDto From(Model.Tenant t)
    {
        var phone = PhoneRules.For(t.Country);
        return new(t.Country, t.Currency, t.TimeZone, t.DefaultLanguage, t.EffectiveArabicStyle, phone.Pattern, phone.Placeholder);
    }
}

public record TenantIcons(string Icon192, string Icon512, string Maskable512, string AppleTouch, string Favicon);

/// <param name="Url">Versioned, immutable.</param>
/// <param name="Width">Pixels after trimming, so a surface can reserve the box before the image loads.</param>
public record TenantWordmark(string Url, int Width, int Height)
{
    public static TenantWordmark? From(Model.Tenant t, string slot)
        => t.Image(slot) is { } image ? new(ImageUrl(slot, image), image.Width, image.Height) : null;

    public static string ImageUrl(string slot, TenantImage image) => $"/api/tenant/images/{slot}?v={image.Version}";
}

/// <summary>The wide lockups by language and scheme; a null falls back on the surface: dark to light, Arabic to English, then the mark and the name.</summary>
public record TenantWordmarks(TenantWordmark? En, TenantWordmark? EnDark, TenantWordmark? Ar, TenantWordmark? ArDark)
{
    public static TenantWordmarks From(Model.Tenant t) => new(
        TenantWordmark.From(t, TenantImageSlots.WordmarkEn),
        TenantWordmark.From(t, TenantImageSlots.WordmarkEnDark),
        TenantWordmark.From(t, TenantImageSlots.WordmarkAr),
        TenantWordmark.From(t, TenantImageSlots.WordmarkArDark));
}

/// <param name="Surface">The page's colour, light scheme; its hue tints the neutrals of both schemes.</param>
/// <param name="Dark">The dark scheme's own seeds, when derived ones do not suit the brand.</param>
/// <param name="Mode">"light" or "dark" for someone who has not chosen; null follows the device.</param>
/// <param name="Style">classic, minimal, bold, cozy or night: how the customer apps are dressed; null is classic.</param>
/// <param name="Layout">Parts dressed otherwise than the style does; null keeps the style's choice for every part.</param>
public record TenantThemeDto(
    string? Accent,
    string? Surface,
    string? Radius,
    string? FontLatin,
    string? FontArabic,
    TenantThemeDarkDto? Dark,
    string? HeaderSize = null,
    string? Mode = null,
    string? Style = null,
    TenantLayoutDto? Layout = null)
{
    public static TenantThemeDto From(TenantTheme t)
        => new(
            t.Accent, t.Surface, t.Radius,
            // A family the catalog no longer has reads as the default
            TenantTheme.KnownFont(t.FontLatin, TenantTheme.LatinFonts),
            TenantTheme.KnownFont(t.FontArabic, TenantTheme.ArabicFonts),
            t.Dark is null ? null : new(t.Dark.Primary, t.Dark.Accent, t.Dark.Surface),
            t.HeaderSize, t.Mode, t.Style,
            t.Layout is { IsEmpty: false } l ? new(l.MenuItem, l.Categories, l.Header, l.Buttons, l.Surface, l.Density) : null);
}

/// <param name="MenuItem">row, card, compact or hero.</param>
/// <param name="Categories">chips, tabs or rail.</param>
/// <param name="Header">left, center or banner (over the cover image).</param>
/// <param name="Buttons">pill, rounded or square.</param>
/// <param name="Surface">flat, outlined or shadow.</param>
/// <param name="Density">airy, comfortable or compact.</param>
public record TenantLayoutDto(string? MenuItem, string? Categories, string? Header, string? Buttons, string? Surface, string? Density);

public record TenantThemeDarkDto(string? Primary, string? Accent, string? Surface);

/// <param name="Tone">brief or detailed; null is brief.</param>
/// <param name="Manner">friendly or formal; null is friendly.</param>
/// <param name="Language">match (the owner's own), en, ar-eg or ar; null is match.</param>
public record AssistantDto(string? Tone, string? Manner, string? Language, string? Notes)
{
    public static AssistantDto From(AssistantSettings? s)
        => new(s?.Tone, s?.Manner, s?.Language, s?.Notes);
}

/// <param name="Authority">The OpenID issuer the apps sign in against ("https://auth.example.com/realms/slug"); null when the build's own setting stands.</param>
public record TenantAuth(string Authority);

/// <param name="LogoUrl">The square mark, light scheme; null when none is uploaded (the icons are then a tile in the brand color).</param>
/// <param name="LogoDarkUrl">The mark for dark backgrounds; null falls back to <paramref name="LogoUrl"/>.</param>
/// <param name="ApiUrl">The host the native till and kitchen apps connect to ("https://api.slug.example.com"); null when the stack was not told.</param>
/// <param name="AppsUrl">Where those apps are downloaded from, the platform's page; null when the stack was not told.</param>
public record TenantResponse(
    LocalizedText Name,
    string? PrimaryColor,
    string? CustomerUrl,
    TenantAuth? Auth,
    string? ApiUrl,
    string? AppsUrl,
    string? LogoUrl,
    string? LogoDarkUrl,
    TenantWordmarks Wordmarks,
    TenantThemeDto Theme,
    TenantIcons Icons,
    TenantFeatures Features,
    TenantFeatures Entitlements,
    TenantLocaleDto Locale,
    long Version,
    string? BusinessType = null,
    bool GuestOrdersAnywhere = false,
    TenantWordmark? Cover = null,
    AssistantDto? Assistant = null)
{
    public static TenantResponse From(Model.Tenant t, IConfiguration configuration)
        => From(t, configuration["Tenant:AuthUrl"], configuration["Tenant:ApiUrl"], configuration["Tenant:AppsUrl"]);

    public static TenantResponse From(Model.Tenant t, string? authUrl, string? apiUrl = null, string? appsUrl = null)
    {
        var v = t.Version;
        static string? Url(string? url) => string.IsNullOrWhiteSpace(url) ? null : url.TrimEnd('/');
        return new(
            t.Name,
            t.PrimaryColor,
            t.CustomerUrl,
            Url(authUrl) is { } authority ? new TenantAuth(authority) : null,
            Url(apiUrl),
            Url(appsUrl),
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
            t.Features,
            t.Entitlements,
            TenantLocaleDto.From(t),
            v,
            t.BusinessType,
            t.GuestOrdersAnywhere,
            TenantWordmark.From(t, TenantImageSlots.Cover),
            AssistantDto.From(t.Assistant));
    }
}

/// <param name="BusinessType">What kind of place it is; the control plane says so, null leaves it.</param>
/// <param name="GuestOrdersAnywhere">Whether a guest may order without being at a table; null leaves it.</param>
public record UpdateTenantRequest(LocalizedText Name, string? PrimaryColor, string? CustomerUrl, TenantFeatures Features, TenantThemeDto? Theme = null, TenantLocaleDto? Locale = null, string? BusinessType = null, bool? GuestOrdersAnywhere = null);

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
