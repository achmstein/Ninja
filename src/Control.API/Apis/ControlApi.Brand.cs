using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Apis;

/// <summary>
/// The tenant's brand, read and written through its own stack (the same
/// endpoints the café's admin app uses, signed as the platform's service
/// account), and the images uploaded before the stack exists, which the
/// brand step of provisioning carries in.
/// </summary>
public static partial class ControlApi
{
    private const long MaxImageBytes = 5 * 1024 * 1024;

    private static void MapBrandApi(RouteGroupBuilder api)
    {
        api.MapGet("/tenants/{slug}/brand", GetBrand).WithName("GetTenantBrand").WithSummary("The brand as the running stack serves it; image URLs point at the customer host").RequireAuthorization("Platform");
        api.MapPut("/tenants/{slug}/brand", UpdateBrand).WithName("UpdateTenantBrand").WithSummary("Change the name, colors, theme, customer URL or feature switches on the running stack").RequireAuthorization("Platform");
        api.MapPut("/tenants/{slug}/brand/images/{slot}", UploadBrandImage).WithName("UploadTenantBrandImage").WithSummary("Replace one image on the running stack: logo, logo-dark, wordmark-en, wordmark-en-dark, wordmark-ar or wordmark-ar-dark").RequireAuthorization("Platform").DisableAntiforgery();
        api.MapDelete("/tenants/{slug}/brand/images/{slot}", DeleteBrandImage).WithName("DeleteTenantBrandImage").WithSummary("Remove one image from the running stack").RequireAuthorization("Platform");

        api.MapGet("/tenants/{slug}/seed-images", ListSeedImages).WithName("ListTenantSeedImages").WithSummary("The slots with an image waiting for the next provision").RequireAuthorization("Platform");
        api.MapGet("/tenants/{slug}/seed-images/{slot}", GetSeedImage).WithName("GetTenantSeedImage").WithSummary("One image waiting for the next provision").RequireAuthorization("Platform");
        api.MapPut("/tenants/{slug}/seed-images/{slot}", UploadSeedImage).WithName("UploadTenantSeedImage").WithSummary("An image the brand step uploads into the stack on the next provision").RequireAuthorization("Platform").DisableAntiforgery();
        api.MapDelete("/tenants/{slug}/seed-images/{slot}", DeleteSeedImage).WithName("DeleteTenantSeedImage").RequireAuthorization("Platform");
    }

    public static async Task<Results<Ok<BrandDto>, NotFound, Conflict<ProblemDetails>, BadRequest<ProblemDetails>, ProblemHttpResult>> GetBrand(
        ControlContext context, IStackProxy stack, IOptions<PlatformOptions> options, string slug, CancellationToken ct)
    {
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (tenant.Status != TenantStatus.Running)
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"The brand lives on the stack, and {slug} is {tenant.Status}." });

        using var response = await stack.SendAsync(tenant, HttpMethod.Get, "/api/tenant", null, StackAuth.Anonymous, ct);
        return await BrandResult(response, tenant, options.Value, ct);
    }

    public static async Task<Results<Ok<BrandDto>, NotFound, Conflict<ProblemDetails>, BadRequest<ProblemDetails>, ProblemHttpResult>> UpdateBrand(
        ControlContext context, IStackProxy stack, IAuditWriter audit, IOptions<PlatformOptions> options, string slug, UpdateBrandRequest request, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (tenant.Status != TenantStatus.Running)
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"The brand lives on the stack, and {slug} is {tenant.Status}." });

        using var response = await stack.SendAsync(tenant, HttpMethod.Put, "/api/tenant", JsonContent.Create(request), StackAuth.Control, ct);
        var result = await BrandResult(response, tenant, options.Value, ct);

        // The control plane's own copy of the name and color follows, so the list and a re-provision agree with the stack
        if (result.Result is Ok<BrandDto> { Value: { } brand })
        {
            tenant.NameEn = brand.Name.En;
            tenant.NameAr = brand.Name.Ar;
            tenant.PrimaryColor = brand.PrimaryColor;
            await context.SaveChangesAsync(ct);
            await audit.WriteAsync("brand.updated", slug, request, ct);
        }
        return result;
    }

    public static async Task<Results<Ok<BrandDto>, NotFound, Conflict<ProblemDetails>, BadRequest<ProblemDetails>, ProblemHttpResult>> UploadBrandImage(
        ControlContext context, IStackProxy stack, IAuditWriter audit, IOptions<PlatformOptions> options, string slug, string slot, IFormFile file, CancellationToken ct)
    {
        if (!BrandImageSlots.IsKnown(slot)) return TypedResults.NotFound();
        if (file.Length == 0 || file.Length > MaxImageBytes)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The image must be between 1 byte and 5 MB." });
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (tenant.Status != TenantStatus.Running)
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"The brand lives on the stack, and {slug} is {tenant.Status}." });

        using var form = new MultipartFormDataContent();
        var content = new StreamContent(file.OpenReadStream());
        content.Headers.ContentType = new MediaTypeHeaderValue(file.ContentType is { Length: > 0 } type ? type : "application/octet-stream");
        form.Add(content, "file", file.FileName is { Length: > 0 } name ? name : $"{slot}.png");
        using var response = await stack.SendAsync(tenant, HttpMethod.Put, $"/api/tenant/images/{slot}", form, StackAuth.Control, ct);
        if (response.IsSuccessStatusCode)
            await audit.WriteAsync("brand.image.uploaded", slug, new { slot, file.Length }, ct);
        return await BrandResult(response, tenant, options.Value, ct);
    }

    public static async Task<Results<Ok<BrandDto>, NotFound, Conflict<ProblemDetails>, BadRequest<ProblemDetails>, ProblemHttpResult>> DeleteBrandImage(
        ControlContext context, IStackProxy stack, IAuditWriter audit, IOptions<PlatformOptions> options, string slug, string slot, CancellationToken ct)
    {
        if (!BrandImageSlots.IsKnown(slot)) return TypedResults.NotFound();
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (tenant.Status != TenantStatus.Running)
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"The brand lives on the stack, and {slug} is {tenant.Status}." });

        using var response = await stack.SendAsync(tenant, HttpMethod.Delete, $"/api/tenant/images/{slot}", null, StackAuth.Control, ct);
        if (response.IsSuccessStatusCode)
            await audit.WriteAsync("brand.image.deleted", slug, new { slot }, ct);
        return await BrandResult(response, tenant, options.Value, ct);
    }

    /// <summary>The stack's answer as the control app reads it, or the stack's refusal passed through with its status.</summary>
    private static async Task<Results<Ok<BrandDto>, NotFound, Conflict<ProblemDetails>, BadRequest<ProblemDetails>, ProblemHttpResult>> BrandResult(
        HttpResponseMessage response, Tenant tenant, PlatformOptions platform, CancellationToken ct)
    {
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            return TypedResults.Problem(detail: $"The stack answered {(int)response.StatusCode}: {body}", statusCode: (int)response.StatusCode);
        }
        var brand = (await response.Content.ReadFromJsonAsync<BrandDto>(ct))!;
        return TypedResults.Ok(brand.OnCustomerHost(TenantHosts.For(tenant, platform).CustomerUrl));
    }

    public static async Task<Results<Ok<List<string>>, NotFound>> ListSeedImages(ControlContext context, Provisioner provisioner, string slug, CancellationToken ct)
    {
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        return TypedResults.Ok(provisioner.SeedImages(tenant).Keys.ToList());
    }

    public static async Task<Results<PhysicalFileHttpResult, NotFound>> GetSeedImage(ControlContext context, Provisioner provisioner, string slug, string slot, CancellationToken ct)
    {
        if (!BrandImageSlots.IsKnown(slot)) return TypedResults.NotFound();
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        var path = provisioner.SeedImagePath(tenant, slot);
        return File.Exists(path) ? TypedResults.PhysicalFile(path, "image/png") : TypedResults.NotFound();
    }

    public static async Task<Results<NoContent, NotFound, BadRequest<ProblemDetails>>> UploadSeedImage(
        ControlContext context, Provisioner provisioner, IAuditWriter audit, string slug, string slot, IFormFile file, CancellationToken ct)
    {
        if (!BrandImageSlots.IsKnown(slot)) return TypedResults.NotFound();
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        if (file.Length == 0 || file.Length > MaxImageBytes)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The image must be between 1 byte and 5 MB." });

        var path = provisioner.SeedImagePath(tenant, slot);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using (var target = File.Create(path))
        {
            await file.CopyToAsync(target, ct);
        }
        await audit.WriteAsync("seed-image.uploaded", slug, new { slot, file.Length }, ct);
        return TypedResults.NoContent();
    }

    public static async Task<Results<NoContent, NotFound>> DeleteSeedImage(ControlContext context, Provisioner provisioner, IAuditWriter audit, string slug, string slot, CancellationToken ct)
    {
        if (!BrandImageSlots.IsKnown(slot)) return TypedResults.NotFound();
        var tenant = await context.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        var path = provisioner.SeedImagePath(tenant, slot);
        if (File.Exists(path)) File.Delete(path);
        await audit.WriteAsync("seed-image.deleted", slug, new { slot }, ct);
        return TypedResults.NoContent();
    }
}

public record BrandText(string En, string? Ar);

public record BrandWordmark(string Url, int Width, int Height)
{
    public BrandWordmark OnHost(string origin) => this with { Url = Absolute(origin, Url) };

    internal static string Absolute(string origin, string url) => url.StartsWith('/') ? origin.TrimEnd('/') + url : url;
}

public record BrandWordmarks(BrandWordmark? En, BrandWordmark? EnDark, BrandWordmark? Ar, BrandWordmark? ArDark);

public record BrandTheme(string? Accent, string? Surface, string? Radius, string? FontLatin, string? FontArabic, BrandThemeDark? Dark);

public record BrandThemeDark(string? Primary, string? Accent, string? Surface);

public record BrandIcons(string Icon192, string Icon512, string Maskable512, string AppleTouch, string Favicon);

public record BrandFeatures(bool Spaces, bool Loyalty, bool Tabs, bool Inventory, bool Finance, bool Payroll, bool Kds);

public record BrandLocale(string Country, string Currency, string TimeZone, string Language);

/// <summary>The stack's brand (Branch.API's tenant response) as the control app reads it, with every image URL made absolute on the customer host.</summary>
public record BrandDto(
    BrandText Name,
    string? PrimaryColor,
    string? CustomerUrl,
    string? LogoUrl,
    string? LogoDarkUrl,
    BrandWordmarks Wordmarks,
    BrandTheme Theme,
    BrandIcons Icons,
    BrandFeatures Features,
    BrandLocale Locale,
    long Version,
    // Null from a stack older than plans: everything is entitled there
    BrandFeatures? Entitlements = null)
{
    public BrandDto OnCustomerHost(string origin) => this with
    {
        LogoUrl = LogoUrl is null ? null : BrandWordmark.Absolute(origin, LogoUrl),
        LogoDarkUrl = LogoDarkUrl is null ? null : BrandWordmark.Absolute(origin, LogoDarkUrl),
        Wordmarks = new(Wordmarks.En?.OnHost(origin), Wordmarks.EnDark?.OnHost(origin), Wordmarks.Ar?.OnHost(origin), Wordmarks.ArDark?.OnHost(origin)),
        Icons = new(
            BrandWordmark.Absolute(origin, Icons.Icon192),
            BrandWordmark.Absolute(origin, Icons.Icon512),
            BrandWordmark.Absolute(origin, Icons.Maskable512),
            BrandWordmark.Absolute(origin, Icons.AppleTouch),
            BrandWordmark.Absolute(origin, Icons.Favicon)),
    };
}

/// <summary>What the stack accepts on PUT /api/tenant; forwarded as is.</summary>
public record UpdateBrandRequest(
    BrandText Name,
    string? PrimaryColor,
    string? CustomerUrl,
    BrandFeatures Features,
    BrandTheme? Theme = null,
    BrandLocale? Locale = null);
