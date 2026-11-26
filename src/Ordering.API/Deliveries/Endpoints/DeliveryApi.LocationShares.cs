#nullable enable
using System.Security.Cryptography;
using Microsoft.AspNetCore.Http.HttpResults;
using Ninja.ServiceDefaults;

namespace Ninja.Ordering.API.Deliveries;

/// <summary>
/// The location link: a caller on the phone can't send the till a pin, so the till sends them a link
/// (by WhatsApp) and their phone shares where they are. The till's form reads it as it comes; an order
/// placed with the link takes it when it comes later, unless the rider has already handed it over.
/// </summary>
public static partial class DeliveryApi
{
    /// <summary>How long a link takes a location: the day of the call.</summary>
    public static readonly TimeSpan LocationShareLifetime = TimeSpan.FromHours(24);

    internal static RouteGroupBuilder MapLocationShareRoutes(this RouteGroupBuilder orders)
    {
        var newWork = orders.MapGroup(string.Empty).AddEndpointFilter(DeliveryOnAsync);

        newWork.MapPost("/delivery/location-shares", CreateLocationShareAsync)
            .WithName("CreateLocationShare")
            .WithSummary("Make a link a caller opens to share their location (staff)")
            .WithDescription("For the branch in X-Branch-Id; it takes a location for a day. The till puts the token in the link it sends, and in the order it places.")
            .RequireAuthorization("Pos");

        orders.MapGet("/delivery/location-shares/{token}", GetLocationShareAsync)
            .WithName("GetLocationShare")
            .WithSummary("The caller's location, once they shared it through the link (staff)")
            .WithDescription("Only the branch that made the link reads it; another's is not found.")
            .RequireAuthorization("Pos");

        orders.MapGet("/delivery/location-shares/{token}/state", GetLocationShareStateAsync)
            .WithName("GetLocationShareState")
            .WithSummary("Whether a location link still takes a location (the caller's page)")
            .WithDescription("Nothing else of it: no business, no order, no number. Rate limited.")
            .AllowAnonymous()
            .RequireRateLimiting(DeliveryModule.QuotePolicy);

        orders.MapPut("/delivery/location-shares/{token}", ShareLocationAsync)
            .WithName("ShareLocation")
            .WithSummary("The caller shares where their phone says they are (the caller's page)")
            .WithDescription("Within a day of the link being made; sent again, the later one stands. An order already placed with the link takes it as its pin unless it was handed over, brought back, or pinned by the customer in the app. Rate limited.")
            .AllowAnonymous()
            .RequireRateLimiting(DeliveryModule.QuotePolicy);

        return orders;
    }

    public static async Task<Ok<LocationShareCreated>> CreateLocationShareAsync(HttpContext httpContext, OrderingContext context)
    {
        var now = DateTime.UtcNow;
        var share = new Ninja.Ordering.Infrastructure.Deliveries.LocationShare
        {
            Token = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant(),
            BranchId = httpContext.GetRequiredBranchId(),
            CreatedAt = now,
            ExpiresAt = now + LocationShareLifetime,
        };
        context.LocationShares.Add(share);
        await context.SaveChangesAsync();
        return TypedResults.Ok(new LocationShareCreated(share.Token, share.ExpiresAt));
    }

    public static async Task<Results<Ok<LocationShareView>, NotFound>> GetLocationShareAsync(string token, HttpContext httpContext, OrderingContext context)
    {
        var branchId = httpContext.GetRequiredBranchId();
        var share = await context.LocationShares.AsNoTracking().FirstOrDefaultAsync(s => s.Token == token && s.BranchId == branchId);
        return share is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(new LocationShareView(
                share.Token, share.Latitude, share.Longitude, share.AccuracyMeters, share.SharedAt, share.ExpiresAt <= DateTime.UtcNow));
    }

    public static async Task<Ok<LocationShareState>> GetLocationShareStateAsync(string token, OrderingContext context)
    {
        var share = await context.LocationShares.AsNoTracking().FirstOrDefaultAsync(s => s.Token == token);
        return TypedResults.Ok(new LocationShareState(share is not null && share.ExpiresAt > DateTime.UtcNow, share?.SharedAt is not null));
    }

    public static async Task<Results<NoContent, NotFound, ProblemHttpResult>> ShareLocationAsync(
        string token,
        ShareLocationRequest request,
        OrderingContext context,
        IBranchSettingsQueries branchSettings,
        ILoggerFactory loggers)
    {
        if (request.Latitude is < -90 or > 90 || request.Longitude is < -180 or > 180
            || double.IsNaN(request.Latitude) || double.IsNaN(request.Longitude))
            return OrderingProblems.Of(DeliveryErrors.PinInvalid, "That isn't a point on the map.");

        var now = DateTime.UtcNow;
        var share = await context.LocationShares.FirstOrDefaultAsync(s => s.Token == token);
        if (share is null || share.ExpiresAt <= now)
            return TypedResults.NotFound();

        share.Latitude = request.Latitude;
        share.Longitude = request.Longitude;
        share.AccuracyMeters = request.AccuracyMeters is >= 0 ? request.AccuracyMeters : null;
        share.SharedAt = now;

        // Placed already with this link: the order takes the pin, with how far it is from its branch
        var orders = await context.Orders
            .Where(o => o.Delivery != null && o.Delivery.LocationShareToken == token && o.BranchId == share.BranchId)
            .ToListAsync();
        if (orders.Count > 0)
        {
            var terms = await branchSettings.GetDeliveryTermsAsync(share.BranchId, evenWhilePaused: true);
            int? distance = terms?.DistanceTo(request.Latitude, request.Longitude);
            foreach (var order in orders)
            {
                if (order.ShareDeliveryPin(request.Latitude, request.Longitude, distance))
                    loggers.CreateLogger("Ninja.Ordering.LocationShare").LogInformation("Order {OrderId} took the caller's shared location", order.Id);
            }
        }

        await context.SaveChangesAsync();
        return TypedResults.NoContent();
    }
}
