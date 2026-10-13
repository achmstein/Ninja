using System.ComponentModel;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Ninja.AI;
using Ninja.AI.Agents;
using Ninja.AI.Http;
using Ninja.Catalog.API.Assist;

namespace Ninja.Catalog.API;

/// <summary>What a promotion is, as the admin edits it and the app shows it</summary>
public sealed record PromotionDto(
    int Id,
    LocalizedText Headline,
    string? PictureUri,
    string Link,
    int? LinkId,
    List<int> BranchIds,
    DateTime? StartsAt,
    DateTime? EndsAt,
    int? Weekdays,
    TimeOnly? ShowFrom,
    TimeOnly? ShowTo,
    bool IsActive,
    bool IsLive,
    DateTime UpdatedAt);

/// <summary>A promotion as the owner sets it; its picture is uploaded on its own</summary>
public sealed record PromotionRequest(
    LocalizedText Headline,
    string? Link,
    int? LinkId,
    List<int>? BranchIds,
    DateTime? StartsAt,
    DateTime? EndsAt,
    int? Weekdays,
    TimeOnly? ShowFrom,
    TimeOnly? ShowTo,
    bool IsActive = true);

/// <summary>A design the image model made, as a data: URL for the admin to show and upload if picked</summary>
public sealed record PromotionDesignsDto(List<string> Designs);

/// <summary>
/// Promotions: the popup the customer app opens with while one runs. The
/// owner makes them (Admin), the image model can design the picture around
/// the owner's real photo (Ninja AI), and the app asks for the one live at
/// its branch (anyone).
/// </summary>
public static class PromotionApi
{
    public static RouteGroupBuilder MapPromotionApi(this RouteGroupBuilder api)
    {
        api.MapGet("/promotions/live", GetLivePromotion)
            .WithName("GetLivePromotion")
            .WithSummary("The promotion running now at a branch")
            .WithDescription("The newest promotion switched on, with a picture, inside its dates, days and hours, at the branch (any branch when none is named). No content when none runs. The app shows it once to each customer, by its id and picture.")
            .WithTags("Promotions");

        api.MapGet("/promotions/{id:int}/pic", GetPromotionPicture)
            .WithName("GetPromotionPicture")
            .WithSummary("A promotion's picture")
            .WithDescription("With w (320, 640 or 1280) a copy that wide; with v, the picture's version as its pictureUri carries it, the answer is immutable")
            .WithTags("Promotions");

        api.MapGet("/promotions", ListPromotions)
            .WithName("ListPromotions")
            .WithSummary("Every promotion, newest first (Admin only)")
            .WithTags("Promotions")
            .RequireAuthorization("Admin");

        api.MapPost("/promotions", CreatePromotion)
            .WithName("CreatePromotion")
            .WithSummary("Create a promotion; upload its picture next (Admin only)")
            .WithTags("Promotions")
            .RequireAuthorization("Admin");

        api.MapPut("/promotions/{id:int}", UpdatePromotion)
            .WithName("UpdatePromotion")
            .WithSummary("Change a promotion (Admin only)")
            .WithTags("Promotions")
            .RequireAuthorization("Admin");

        api.MapDelete("/promotions/{id:int}", DeletePromotion)
            .WithName("DeletePromotion")
            .WithSummary("Delete a promotion and its picture (Admin only)")
            .WithTags("Promotions")
            .RequireAuthorization("Admin");

        api.MapPost("/promotions/{id:int}/pic", UploadPromotionPicture)
            .WithName("UploadPromotionPicture")
            .WithSummary("Set a promotion's picture: the owner's own design, or one the image model made (Admin only)")
            .WithTags("Promotions")
            .RequireAuthorization("Admin")
            .DisableAntiforgery();

        api.MapPost("/assist/promotion-design", DesignPromotion)
            .WithName("DesignPromotion")
            .WithSummary("Design a promotion's picture from a real photo")
            .WithDescription("The image model designs a tall promotional picture around the owner's photo (kept as it is), with the headline drawn in, in the brand's colours: up to three to pick from, as data: URLs. Nothing is saved: keep one by uploading it as the promotion's picture. The words may come out misspelled; ask again with a note (Admin only).")
            .WithTags("Assist")
            .RequireAuthorization("Admin")
            .RequireRateLimiting(NinjaAIRateLimiting.PolicyName)
            .DisableAntiforgery();

        return api;
    }

    public static async Task<Results<Ok<PromotionDto>, NoContent>> GetLivePromotion(
        CatalogContext context,
        HttpContext http,
        [Description("The branch the customer is at")] int? branchId = null)
    {
        var candidates = await context.Promotions.AsNoTracking()
            .Where(p => p.IsActive && p.PictureFileName != null)
            .OrderByDescending(p => p.UpdatedAt)
            .ToListAsync();
        var live = candidates.FirstOrDefault(p => p.IsLiveAt(branchId, DateTime.UtcNow, TenantClock.Now));
        return live is null ? TypedResults.NoContent() : TypedResults.Ok(live.ToDto(BaseUrl(http), true));
    }

    [ProducesResponseType<byte[]>(StatusCodes.Status200OK, "image/webp")]
    public static async Task<Results<PhysicalFileHttpResult, NotFound>> GetPromotionPicture(
        CatalogContext context,
        IWebHostEnvironment environment,
        HttpContext http,
        [Description("The promotion id")] int id,
        [Description("A narrower copy: 320, 640 or 1280 px wide")] int? w = null,
        [Description("The picture's version, as its pictureUri carries it")] string? v = null)
    {
        var promotion = await context.Promotions.FindAsync(id);
        if (promotion?.PictureFileName is not { } fileName)
            return TypedResults.NotFound();
        var path = CatalogApi.GetFullPath(environment.ContentRootPath, fileName);
        if (!File.Exists(path))
            return TypedResults.NotFound();
        if (w is { } width && ItemPictures.Widths.Contains(width))
            path = ItemPictures.SizedPath(CatalogApi.PicsRoot(environment.ContentRootPath), path, width);

        http.Response.Headers.CacheControl = v == fileName ? "public, max-age=31536000, immutable" : "public, no-cache";
        var etag = new Microsoft.Net.Http.Headers.EntityTagHeaderValue($"\"{Path.GetFileNameWithoutExtension(fileName)}-{w ?? 0}\"");
        return TypedResults.PhysicalFile(path, "image/webp", lastModified: File.GetLastWriteTimeUtc(path), entityTag: etag);
    }

    public static async Task<Ok<List<PromotionDto>>> ListPromotions(CatalogContext context, HttpContext http)
    {
        var promotions = await context.Promotions.AsNoTracking().OrderByDescending(p => p.Id).ToListAsync();
        var baseUrl = BaseUrl(http);
        var (utc, local) = (DateTime.UtcNow, TenantClock.Now);
        // Live as the app would see it at some branch: the newest one live there wins, so one may be outrun
        return TypedResults.Ok(promotions.Select(p => p.ToDto(baseUrl, p.IsLiveAt(null, utc, local))).ToList());
    }

    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    public static async Task<Results<Created<PromotionDto>, BadRequest<ProblemDetails>>> CreatePromotion(
        CatalogContext context,
        HttpContext http,
        PromotionRequest request)
    {
        if (await ValidateAsync(context, request) is { } error)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = error });

        var now = DateTime.UtcNow;
        var promotion = new Promotion { CreatedAt = now };
        Apply(request, promotion, now);
        context.Promotions.Add(promotion);
        await context.SaveChangesAsync();
        return TypedResults.Created($"/api/catalog/promotions/{promotion.Id}", promotion.ToDto(BaseUrl(http), false));
    }

    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    public static async Task<Results<Ok<PromotionDto>, NotFound, BadRequest<ProblemDetails>>> UpdatePromotion(
        CatalogContext context,
        HttpContext http,
        [Description("The promotion id")] int id,
        PromotionRequest request)
    {
        var promotion = await context.Promotions.FindAsync(id);
        if (promotion is null)
            return TypedResults.NotFound();
        if (await ValidateAsync(context, request) is { } error)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = error });

        Apply(request, promotion, DateTime.UtcNow);
        await context.SaveChangesAsync();
        return TypedResults.Ok(promotion.ToDto(BaseUrl(http), promotion.IsLiveAt(null, DateTime.UtcNow, TenantClock.Now)));
    }

    public static async Task<Results<NoContent, NotFound>> DeletePromotion(
        CatalogContext context,
        IWebHostEnvironment environment,
        [Description("The promotion id")] int id)
    {
        var promotion = await context.Promotions.FindAsync(id);
        if (promotion is null)
            return TypedResults.NotFound();
        DeletePicture(environment.ContentRootPath, promotion.PictureFileName);
        context.Promotions.Remove(promotion);
        await context.SaveChangesAsync();
        return TypedResults.NoContent();
    }

    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    public static async Task<Results<Ok<PromotionDto>, NotFound, BadRequest<ProblemDetails>>> UploadPromotionPicture(
        CatalogContext context,
        IWebHostEnvironment environment,
        HttpContext http,
        [Description("The promotion id")] int id,
        IFormFile file)
    {
        var promotion = await context.Promotions.FindAsync(id);
        if (promotion is null)
            return TypedResults.NotFound();
        if (file.Length == 0 || file.Length > ItemPictures.MaxUploadBytes)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"The picture must be a jpeg, png or webp image of at most {ItemPictures.MaxUploadBytes / (1024 * 1024)} MB." });

        var (webp, error) = ItemPictures.Normalize(await ReadAsync(file));
        if (webp is null)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = error });

        DeletePicture(environment.ContentRootPath, promotion.PictureFileName);
        // A new name each time, so the app shows a new picture as a new promotion seen afresh
        var fileName = $"promo_{id}_{DateTimeOffset.UtcNow.Ticks}.webp";
        var saved = CatalogApi.GetFullPath(environment.ContentRootPath, fileName);
        await File.WriteAllBytesAsync(saved, webp);
        foreach (var width in ItemPictures.Precut)
            ItemPictures.SizedPath(CatalogApi.PicsRoot(environment.ContentRootPath), saved, width);

        promotion.PictureFileName = fileName;
        promotion.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();
        return TypedResults.Ok(promotion.ToDto(BaseUrl(http), promotion.IsLiveAt(null, DateTime.UtcNow, TenantClock.Now)));
    }

    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    public static async Task<Results<Ok<PromotionDesignsDto>, BadRequest<ProblemDetails>, ProblemHttpResult>> DesignPromotion(
        [FromServices] PromotionDesigner designer,
        HttpContext http,
        [Description("The owner's real photo: the dish, the room, the place")] IFormFile photo,
        [FromForm, Description("The words drawn into the picture, exactly as typed")] string headline,
        [FromForm, Description("The business's name, small on the design")] string? business,
        [FromForm, Description("The brand's colours, hex, comma separated")] string? colors,
        [FromForm, Description("Anything to add or change")] string? note,
        [FromForm, Description("How many designs, 1 to 3")] int? count,
        [Description("The business's logo, put on each design as it is (png, webp or jpeg)")] IFormFile? logo,
        CancellationToken ct)
    {
        if (!designer.IsEnabled)
            return AIProblems.NotConfigured();
        if (string.IsNullOrWhiteSpace(headline) || headline.Trim().Length > Promotion.HeadlineMaxLength)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"Write the headline, at most {Promotion.HeadlineMaxLength} characters." });
        if (note is { Length: > PromotionDesigner.MaxNoteLength })
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"Keep the note under {PromotionDesigner.MaxNoteLength} characters." });
        if (photo.Length == 0 || photo.Length > ItemPictures.MaxUploadBytes)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"The photo must be a jpeg, png or webp image of at most {ItemPictures.MaxUploadBytes / (1024 * 1024)} MB." });

        var request = new DesignPromotionRequest(
            headline.Trim(),
            business,
            colors?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
            note,
            count ?? PromotionDesigner.MaxDesigns,
            // A logo too big to be one is left out rather than refused: the designs still come, with the name
            logo is { Length: > 0 and <= ItemPictures.MaxUploadBytes } ? await ReadAsync(logo) : null);
        try
        {
            var designs = await designer.DesignAsync(await ReadAsync(photo), request, ct);
            return TypedResults.Ok(new PromotionDesignsDto(designs.Select(d => "data:image/webp;base64," + Convert.ToBase64String(d)).ToList()));
        }
        catch (NoImageModelException)
        {
            return TypedResults.Problem(title: "No image model", detail: "Promotion designs are not set up: the platform has no image model yet.", statusCode: StatusCodes.Status503ServiceUnavailable);
        }
        catch (AIException ex)
        {
            return AIProblems.From(ex, http);
        }
    }

    private static async Task<string?> ValidateAsync(CatalogContext context, PromotionRequest request)
    {
        var en = request.Headline.En?.Trim();
        var ar = request.Headline.Ar?.Trim();
        if (string.IsNullOrEmpty(en) && string.IsNullOrEmpty(ar))
            return "Write the headline.";
        if ((en?.Length ?? 0) > Promotion.HeadlineMaxLength || (ar?.Length ?? 0) > Promotion.HeadlineMaxLength)
            return $"Keep the headline under {Promotion.HeadlineMaxLength} characters.";
        if (request.StartsAt is { } from && request.EndsAt is { } to && to <= from)
            return "It must end after it starts.";
        if (request.Weekdays is < 0 or > 127)
            return "Those are not days of the week.";
        var link = ParseLink(request.Link);
        if (link is null)
            return "That is not somewhere the button can go.";
        if (link == PromotionLink.Item && (request.LinkId is not { } item || !await context.CatalogItems.AnyAsync(i => i.Id == item)))
            return "Pick the item the button opens.";
        if (link == PromotionLink.Category && (request.LinkId is not { } category || !await context.CatalogTypes.AnyAsync(c => c.Id == category)))
            return "Pick the category the button opens.";
        return null;
    }

    private static PromotionLink? ParseLink(string? link)
        => string.IsNullOrWhiteSpace(link) ? PromotionLink.None : Enum.TryParse<PromotionLink>(link, true, out var parsed) ? parsed : null;

    private static void Apply(PromotionRequest request, Promotion promotion, DateTime now)
    {
        promotion.Headline = new LocalizedText
        {
            En = string.IsNullOrWhiteSpace(request.Headline.En) ? null : request.Headline.En.Trim(),
            Ar = string.IsNullOrWhiteSpace(request.Headline.Ar) ? null : request.Headline.Ar.Trim(),
        };
        promotion.Link = ParseLink(request.Link) ?? PromotionLink.None;
        promotion.LinkId = promotion.Link is PromotionLink.Item or PromotionLink.Category ? request.LinkId : null;
        promotion.BranchIds = request.BranchIds?.Distinct().ToList() ?? [];
        promotion.StartsAt = request.StartsAt;
        promotion.EndsAt = request.EndsAt;
        promotion.Weekdays = request.Weekdays is 0 ? null : request.Weekdays;
        promotion.ShowFrom = request.ShowFrom;
        promotion.ShowTo = request.ShowTo;
        promotion.IsActive = request.IsActive;
        promotion.UpdatedAt = now;
    }

    private static PromotionDto ToDto(this Promotion p, string baseUrl, bool live) => new(
        p.Id,
        p.Headline,
        string.IsNullOrEmpty(p.PictureFileName) ? null : $"{baseUrl}/api/catalog/promotions/{p.Id}/pic?v={Uri.EscapeDataString(p.PictureFileName)}",
        p.Link.ToString(),
        p.LinkId,
        p.BranchIds,
        p.StartsAt,
        p.EndsAt,
        p.Weekdays,
        p.ShowFrom,
        p.ShowTo,
        p.IsActive,
        live,
        p.UpdatedAt);

    private static string BaseUrl(HttpContext http) => CatalogApi.PublicBaseUrl(http);

    private static async Task<byte[]> ReadAsync(IFormFile file)
    {
        using var buffer = new MemoryStream((int)file.Length);
        await file.CopyToAsync(buffer);
        return buffer.ToArray();
    }

    private static void DeletePicture(string contentRootPath, string? fileName)
    {
        if (string.IsNullOrEmpty(fileName)) return;
        var path = CatalogApi.GetFullPath(contentRootPath, fileName);
        if (File.Exists(path)) File.Delete(path);
        ItemPictures.DeleteSizes(CatalogApi.PicsRoot(contentRootPath), fileName);
    }
}
