using System.ComponentModel;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;
using Ninja.Tenant.API.Services;

namespace Ninja.Tenant.API.Apis;

/// <summary>
/// Address search for a delivery: the customer types a street, picks one of
/// Google's suggestions, and the map flies there. Anonymous, since guests
/// check out too, and metered per address; Google is called with the
/// platform's server key from here only (<see cref="PlacesClient"/>).
/// Under /api/tenant: /api/places is the tables and stations of Spaces.
/// </summary>
public static class PlacesApi
{
    /// <summary>The policy both endpoints carry: a person typing addresses stays well under it, a script does not.</summary>
    public const string RateLimit = "places";

    public static IEndpointRouteBuilder MapPlacesApi(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("api/tenant/places").WithTags("Places").RequireRateLimiting(RateLimit);

        api.MapGet("/autocomplete", Autocomplete)
            .WithName("AutocompletePlaces")
            .WithSummary("Google's suggestions for an address being typed, in the business's country and near the branch; 404 when the business does not have Google Maps");

        api.MapGet("/{placeId}", GetPlace)
            .WithName("GetPlace")
            .WithSummary("Where a picked suggestion is: its point and address; closes the search's session");

        return app;
    }

    public static async Task<Results<Ok<List<PlaceSuggestion>>, ProblemHttpResult>> Autocomplete(
        PlacesClient places,
        IOptions<MapsOptions> options,
        TenantContext context,
        HttpContext http,
        [Description("What has been typed; fewer than three letters answers nothing")] string? q,
        [Description("The search's session token, a UUID the app makes when the search opens and keeps until a place is picked")] string? session = null,
        [Description("Where to lean the suggestions, \"lat,lng\": the branch; left out, the business's first placed branch")] string? near = null,
        [Description("en or ar; left out, the request's language")] string? lang = null,
        CancellationToken ct = default)
    {
        if (!options.Value.Search) return NotEnabled();
        if (PlacesClient.Normalize(q).Length < PlacesClient.MinLength) return TypedResults.Ok(new List<PlaceSuggestion>());
        var point = MapLocation.Parse(near) ?? await FirstBranchAsync(context, ct);
        var suggestions = await places.AutocompleteAsync(q, session, point, LanguageOf(lang, http), ct);
        return TypedResults.Ok(suggestions.ToList());
    }

    public static async Task<Results<Ok<PlaceLocation>, NotFound, ProblemHttpResult>> GetPlace(
        PlacesClient places,
        IOptions<MapsOptions> options,
        HttpContext http,
        string placeId,
        [Description("The session token the suggestions were asked with")] string? session = null,
        [Description("en or ar; left out, the request's language")] string? lang = null,
        CancellationToken ct = default)
    {
        if (!options.Value.Search) return NotEnabled();
        var place = await places.DetailsAsync(placeId, session, LanguageOf(lang, http), ct);
        return place is null ? TypedResults.NotFound() : TypedResults.Ok(place);
    }

    /// <summary>
    /// The business has no Google Maps: the platform holds no Places key, or the control plane has it off
    /// for this business (its stack is then stamped without the key). The apps read the same from the brand
    /// (maps.search) and show no search field; one that asks anyway hears why.
    /// </summary>
    private static ProblemHttpResult NotEnabled()
        => TypedResults.Problem(title: "Google Maps not enabled", detail: "Address search is not enabled for this business.", statusCode: StatusCodes.Status404NotFound);

    private static async Task<GeoPoint?> FirstBranchAsync(TenantContext context, CancellationToken ct)
    {
        var branch = await context.Branches.AsNoTracking()
            .Where(b => b.IsActive && b.Latitude != null && b.Longitude != null)
            .OrderBy(b => b.DisplayOrder)
            .Select(b => new { b.Latitude, b.Longitude })
            .FirstOrDefaultAsync(ct);
        return branch is null ? null : new GeoPoint(branch.Latitude!.Value, branch.Longitude!.Value);
    }

    private static string LanguageOf(string? lang, HttpContext http)
    {
        if (!string.IsNullOrWhiteSpace(lang)) return lang;
        var header = http.Request.Headers.AcceptLanguage.ToString();
        return header.Length > 0 ? header : "en";
    }
}
