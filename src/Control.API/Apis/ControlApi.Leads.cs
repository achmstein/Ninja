using System.ComponentModel;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Ninja.AI.Images;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Apis;

/// <summary>
/// Requests for a demo from the site: anyone may leave one (a name, a phone,
/// the kind of place and photos of the menu), a platform admin reads them and
/// turns the good ones into demos. The request stamps nothing by itself.
/// </summary>
public static partial class ControlApi
{
    /// <summary>The pages of a menu one request may carry.</summary>
    public const int LeadMaxPhotos = 4;

    /// <summary>The weight of one page: the site shrinks a photo well below this before sending.</summary>
    public const int LeadMaxPhotoBytes = 6 * 1024 * 1024;

    /// <summary>What a day may bring before the door closes until tomorrow: a flood is not customers.</summary>
    public const int LeadsPerDay = 200;

    private static void MapLeadsApi(RouteGroupBuilder api)
    {
        api.MapPost("/leads", CreateLead)
            .WithName("CreateLead")
            .WithSummary("Ask for a demo: who, how to reach them, the kind of place, and photos of the menu")
            .AllowAnonymous()
            .DisableAntiforgery()
            .RequireRateLimiting(Extensions.Extensions.LeadRateLimit);
        api.MapGet("/leads", ListLeads).WithName("ListLeads").WithSummary("Every request, newest first").RequireAuthorization("Platform");
        api.MapGet("/leads/{id:long}", GetLead).WithName("GetLead").WithSummary("One request").RequireAuthorization("Platform");
        api.MapGet("/leads/{id:long}/photos/{photoId:long}", GetLeadPhoto).WithName("GetLeadPhoto").WithSummary("One page of the menu a request came with").RequireAuthorization("Platform");
        api.MapPut("/leads/{id:long}", UpdateLead).WithName("UpdateLead").WithSummary("Where a request stands, a note on it, the demo made for it").RequireAuthorization("Platform");
        api.MapDelete("/leads/{id:long}", DeleteLead).WithName("DeleteLead").WithSummary("Drop a request and its photos").RequireAuthorization("Platform");
    }

    public static async Task<Results<Accepted, BadRequest<ProblemDetails>, StatusCodeHttpResult>> CreateLead(
        [FromForm, Description("The person asking")] string? name,
        [FromForm, Description("What their place is called")] string? business,
        [FromForm, Description("A phone number, with or without the country code")] string? phone,
        [FromForm, Description("CoffeeShop, Restaurant, GameStation, CloudKitchen or Other")] string? businessType,
        [FromForm, Description("The page's language: en or ar")] string? language,
        [FromForm] string? source,
        [FromForm] string? medium,
        [FromForm] string? campaign,
        [FromForm(Name = "ref"), Description("The slug of the business that sent them")] string? referredBy,
        [FromForm] string? referrer,
        [FromForm] string? landing,
        [FromForm, Description("Left empty by people; a filled one is a robot")] string? website,
        [Description("Photos of the menu, up to four")] IFormFileCollection? photos,
        ControlContext context, IOptions<PlatformOptions> options, CancellationToken ct)
    {
        // A robot fills every field it finds: it is told all went well and nothing is kept
        if (!string.IsNullOrWhiteSpace(website)) return TypedResults.Accepted((string?)null);

        var person = Clean(name);
        var place = Clean(business);
        var digits = LeadPhone(phone);
        if (person is null || person.Length > 80)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "Tell us your name." });
        if (place is null || place.Length > 80)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "Tell us what your place is called." });
        if (digits is null)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "Give a phone number we can reach you on." });
        if (photos is { Count: > LeadMaxPhotos })
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"At most {LeadMaxPhotos} photos." });

        var since = DateTimeOffset.UtcNow.AddDays(-1);
        if (await context.Leads.CountAsync(l => l.CreatedAt > since, ct) >= LeadsPerDay)
            return TypedResults.StatusCode(StatusCodes.Status429TooManyRequests);

        var lead = new Lead
        {
            Name = person,
            Business = place,
            Phone = digits,
            BusinessType = Enum.TryParse<BusinessType>(businessType, ignoreCase: true, out var type) && Enum.IsDefined(type) ? type : BusinessType.Other,
            Language = language == "ar" ? "ar" : "en",
            Source = Tag(source, 60),
            Medium = Tag(medium, 60),
            Campaign = Tag(campaign, 60),
            Ref = Tag(referredBy, 24)?.ToLowerInvariant(),
            Referrer = Tag(referrer, 120),
            Landing = Tag(landing, 120),
        };
        foreach (var file in photos ?? (IEnumerable<IFormFile>)[])
        {
            var (image, error) = await ImageValidation.ReadAsync(file, LeadMaxPhotoBytes, ct);
            if (image is null)
                return TypedResults.BadRequest<ProblemDetails>(new() { Detail = error ?? "The photo could not be read." });
            lead.Photos.Add(new LeadPhoto { ContentType = image.MediaType, Bytes = image.Data.ToArray() });
        }

        context.Leads.Add(lead);
        // The same save as the request, so one cannot exist without the other
        if (!string.IsNullOrWhiteSpace(options.Value.Mail.OpsTo))
            context.Outbox.Add(OutboxMail.From(MailTemplates.OpsNewLead(lead, options.Value)));
        await context.SaveChangesAsync(ct);
        return TypedResults.Accepted((string?)null);
    }

    public static async Task<Ok<List<LeadDto>>> ListLeads(ControlContext context, CancellationToken ct)
    {
        var leads = await context.Leads.AsNoTracking()
            .OrderByDescending(l => l.Id)
            .Take(500)
            .Select(l => new { Lead = l, Photos = l.Photos.OrderBy(p => p.Id).Select(p => p.Id).ToList() })
            .ToListAsync(ct);
        return TypedResults.Ok(leads.Select(l => LeadDto.From(l.Lead, l.Photos)).ToList());
    }

    public static async Task<Results<Ok<LeadDto>, NotFound>> GetLead(ControlContext context, long id, CancellationToken ct)
    {
        var found = await context.Leads.AsNoTracking()
            .Where(l => l.Id == id)
            .Select(l => new { Lead = l, Photos = l.Photos.OrderBy(p => p.Id).Select(p => p.Id).ToList() })
            .SingleOrDefaultAsync(ct);
        return found is null ? TypedResults.NotFound() : TypedResults.Ok(LeadDto.From(found.Lead, found.Photos));
    }

    public static async Task<Results<FileContentHttpResult, NotFound>> GetLeadPhoto(ControlContext context, long id, long photoId, CancellationToken ct)
    {
        var photo = await context.LeadPhotos.AsNoTracking().SingleOrDefaultAsync(p => p.Id == photoId && p.LeadId == id, ct);
        return photo is null ? TypedResults.NotFound() : TypedResults.File(photo.Bytes, photo.ContentType);
    }

    public static async Task<Results<Ok<LeadDto>, NotFound, BadRequest<ProblemDetails>>> UpdateLead(
        ControlContext context, IAuditWriter audit, long id, UpdateLeadRequest request, CancellationToken ct)
    {
        var lead = await context.Leads.Include(l => l.Photos).SingleOrDefaultAsync(l => l.Id == id, ct);
        if (lead is null) return TypedResults.NotFound();
        var note = Clean(request.Note);
        if (note is { Length: > 500 })
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "A note of up to 500 characters." });
        var slug = Clean(request.TenantSlug);
        if (slug is not null && !await context.Tenants.AnyAsync(t => t.Slug == slug, ct))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"There is no business called {slug}." });

        lead.Status = request.Status;
        lead.Note = note;
        lead.TenantSlug = slug;
        // The menu is in the demo now; the photos have done their work
        if (lead.Status == LeadStatus.DemoCreated) lead.Photos.Clear();
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("lead.updated", slug, new { lead.Id, status = lead.Status.ToString() }, ct);
        return TypedResults.Ok(LeadDto.From(lead, lead.Photos.Select(p => p.Id).ToList()));
    }

    public static async Task<Results<NoContent, NotFound>> DeleteLead(ControlContext context, IAuditWriter audit, long id, CancellationToken ct)
    {
        var lead = await context.Leads.SingleOrDefaultAsync(l => l.Id == id, ct);
        if (lead is null) return TypedResults.NotFound();
        context.Leads.Remove(lead);
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("lead.deleted", null, new { lead.Id, lead.Business }, ct);
        return TypedResults.NoContent();
    }

    /// <summary>A phone as people type it (spaces, dashes, brackets, a plus) down to its digits with the plus kept; null when that is not 7 to 15 digits.</summary>
    internal static string? LeadPhone(string? typed)
    {
        if (string.IsNullOrWhiteSpace(typed)) return null;
        var trimmed = typed.Trim();
        if (!LeadPhoneShape().IsMatch(trimmed)) return null;
        // Arabic-Indic digits are digits too: a phone typed on an Arabic keyboard
        var digits = new string(trimmed.Where(char.IsDigit).Select(c => (char)('0' + (int)char.GetNumericValue(c))).ToArray());
        if (digits.Length is < 7 or > 15) return null;
        return trimmed.StartsWith('+') ? "+" + digits : digits;
    }

    /// <summary>A tag from the address bar: trimmed, no control characters, cut to what the column holds; null when empty.</summary>
    internal static string? Tag(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var clean = new string(value.Where(c => !char.IsControl(c)).ToArray()).Trim();
        if (clean.Length == 0) return null;
        return clean.Length > max ? clean[..max] : clean;
    }

    [GeneratedRegex(@"^\+?[\d\s().\-]+$")]
    private static partial Regex LeadPhoneShape();
}

public sealed record UpdateLeadRequest(LeadStatus Status, string? Note, string? TenantSlug);

public sealed record LeadDto(
    long Id, DateTimeOffset CreatedAt, string Name, string Business, string Phone, BusinessType BusinessType, string Language,
    string? Source, string? Medium, string? Campaign, string? Ref, string? Referrer, string? Landing,
    LeadStatus Status, string? TenantSlug, string? Note, IReadOnlyList<long> Photos)
{
    public static LeadDto From(Lead l, IReadOnlyList<long> photos) => new(
        l.Id, l.CreatedAt, l.Name, l.Business, l.Phone, l.BusinessType, l.Language,
        l.Source, l.Medium, l.Campaign, l.Ref, l.Referrer, l.Landing,
        l.Status, l.TenantSlug, l.Note, photos);
}
