#nullable enable
using Microsoft.AspNetCore.Http.HttpResults;
using Ninja.ServiceDefaults;

namespace Ninja.Ordering.API.Deliveries;

/// <summary>What a delivery would cost: the customer's quote for a pin, and the till's for a phone order.</summary>
public static partial class DeliveryApi
{
    public static async Task<Results<Ok<DeliveryQuote>, ProblemHttpResult>> GetDeliveryQuoteAsync(
        double latitude,
        double longitude,
        HttpContext httpContext,
        IBranchSettingsQueries branchSettings)
    {
        if (latitude is < -90 or > 90 || longitude is < -180 or > 180 || double.IsNaN(latitude) || double.IsNaN(longitude))
        {
            return OrderingProblems.Of(DeliveryErrors.PinInvalid, "That isn't a point on the map.");
        }

        var terms = await branchSettings.GetDeliveryTermsAsync(httpContext.GetRequiredBranchId());
        if (terms is null)
        {
            return TypedResults.Ok(new DeliveryQuote(false, false, null, 0, 0, 0));
        }

        var distance = Geo.DistanceMeters(terms.Latitude, terms.Longitude, latitude, longitude);
        return TypedResults.Ok(new DeliveryQuote(true, distance <= terms.RadiusMeters, distance, terms.Fee, terms.MinimumOrder, terms.RadiusKm, terms.SignInRequired));
    }

    public static async Task<Results<Ok<DeliveryResolution>, ProblemHttpResult>> ResolveDeliveryBranchAsync(
        double latitude,
        double longitude,
        IBranchSettingsQueries branchSettings)
    {
        if (latitude is < -90 or > 90 || longitude is < -180 or > 180 || double.IsNaN(latitude) || double.IsNaN(longitude))
        {
            return OrderingProblems.Of(DeliveryErrors.PinInvalid, "That isn't a point on the map.");
        }

        var delivering = await branchSettings.GetDeliveringBranchesAsync();
        var reaching = delivering
            .Select(b => (b.BranchId, b.Terms, Distance: Geo.DistanceMeters(b.Terms.Latitude, b.Terms.Longitude, latitude, longitude)))
            .Where(b => b.Distance <= b.Terms.RadiusMeters)
            .OrderBy(b => b.Distance)
            .ThenBy(b => b.BranchId)
            .Select(b => new DeliveringBranch(b.BranchId, b.Distance, b.Terms.Fee, b.Terms.MinimumOrder, b.Terms.SignInRequired))
            .ToList();

        return TypedResults.Ok(new DeliveryResolution(delivering.Count > 0, reaching));
    }

    public static async Task<Ok<TillDeliveryQuote>> GetTillDeliveryQuoteAsync(
        HttpContext httpContext,
        IBranchSettingsQueries branchSettings,
        IHttpClientFactory http,
        string? location = null,
        CancellationToken ct = default)
    {
        var terms = await branchSettings.GetDeliveryTermsAsync(httpContext.GetRequiredBranchId(), evenWhilePaused: true);
        if (terms is null)
        {
            return TypedResults.Ok(new TillDeliveryQuote(false, false, null, 0, 0, 0, null, null, false));
        }

        // What the caller shared, as the cashier pasted it: a Google Maps
        // link (a short one is followed) or plain coordinates
        var pin = string.IsNullOrWhiteSpace(location)
            ? null
            : await MapLocation.ResolveAsync(location, http.CreateClient(MapLocation.ClientName), ct);
        int? distance = pin is { } p ? Geo.DistanceMeters(terms.Latitude, terms.Longitude, p.Latitude, p.Longitude) : null;

        return TypedResults.Ok(new TillDeliveryQuote(
            true, distance is null || distance <= terms.RadiusMeters, distance, terms.Fee, terms.MinimumOrder, terms.RadiusKm,
            pin?.Latitude, pin?.Longitude, string.IsNullOrWhiteSpace(location) || pin is not null));
    }
}
