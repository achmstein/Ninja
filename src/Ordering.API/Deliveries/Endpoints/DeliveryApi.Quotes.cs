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

        var distance = terms.DistanceTo(latitude, longitude);
        return TypedResults.Ok(new DeliveryQuote(true, terms.Covers(latitude, longitude), distance, terms.Fee, terms.MinimumOrder, terms.RadiusKm, terms.SignInRequired, terms.HasArea));
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
            .Where(b => b.Terms.Covers(latitude, longitude))
            .Select(b => (b.BranchId, b.Terms, Distance: b.Terms.DistanceTo(latitude, longitude)))
            // Overlapping areas: the nearer branch first
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
        var branchId = httpContext.GetRequiredBranchId();
        var terms = await branchSettings.GetDeliveryTermsAsync(branchId, evenWhilePaused: true);
        if (terms is null)
        {
            return TypedResults.Ok(new TillDeliveryQuote(false, false, null, 0, 0, 0, null, null, false, []));
        }

        // What the caller shared, as the cashier pasted it: a Google Maps
        // link (a short one is followed) or plain coordinates
        var pin = string.IsNullOrWhiteSpace(location)
            ? null
            : await MapLocation.ResolveAsync(location, http.CreateClient(MapLocation.ClientName), ct);
        int? distance = pin is { } p ? terms.DistanceTo(p.Latitude, p.Longitude) : null;

        // The business's other branches that would take it, paused ones too: the
        // till can send an order to a branch that stopped its customers' orders.
        // None while a call centre takes the business's calls: they come through
        // the hotline, and a branch till keeps what it is rung for
        var alternatives = pin is { } at && !await branchSettings.IsCallCentreOnAsync()
            ? DeliveryAlternatives.For(branchId, terms, at.Latitude, at.Longitude, await branchSettings.GetDeliveringBranchesAsync(evenWhilePaused: true))
            : [];

        return TypedResults.Ok(new TillDeliveryQuote(
            true, pin is not { } door || terms.Covers(door.Latitude, door.Longitude), distance, terms.Fee, terms.MinimumOrder, terms.RadiusKm,
            pin?.Latitude, pin?.Longitude, string.IsNullOrWhiteSpace(location) || pin is not null, alternatives, terms.HasArea));
    }

    /// <summary>
    /// The call centre's question: which branches would deliver to the caller.
    /// No branch is asked (no X-Branch-Id needed); paused branches come back
    /// flagged, since a phone order may still go to one.
    /// </summary>
    public static async Task<Results<Ok<StaffDeliveryResolution>, ProblemHttpResult>> ResolveDeliveryBranchForStaffAsync(
        IBranchSettingsQueries branchSettings,
        IHttpClientFactory http,
        string? location = null,
        double? latitude = null,
        double? longitude = null,
        CancellationToken ct = default)
    {
        (double Latitude, double Longitude)? pin = null;
        if (latitude is { } lat && longitude is { } lng)
        {
            if (lat is < -90 or > 90 || lng is < -180 or > 180 || double.IsNaN(lat) || double.IsNaN(lng))
            {
                return OrderingProblems.Of(DeliveryErrors.PinInvalid, "That isn't a point on the map.");
            }
            pin = (lat, lng);
        }
        else if (!string.IsNullOrWhiteSpace(location))
        {
            // A Google Maps link (a short one is followed) or plain coordinates
            if (await MapLocation.ResolveAsync(location, http.CreateClient(MapLocation.ClientName), ct) is { } read)
            {
                pin = (read.Latitude, read.Longitude);
            }
        }

        var delivering = await branchSettings.GetDeliveringBranchesAsync(evenWhilePaused: true);
        var branches = pin is { } at ? DeliveryAlternatives.Reaching(at.Latitude, at.Longitude, delivering) : [];
        var asked = !string.IsNullOrWhiteSpace(location) || latitude is not null || longitude is not null;

        return TypedResults.Ok(new StaffDeliveryResolution(
            delivering.Count > 0, pin?.Latitude, pin?.Longitude, !asked || pin is not null, branches));
    }
}
