using Ninja.ServiceDefaults;
using System.ComponentModel;
using Ninja.Tenant.API.Model;
using Ninja.Tenant.API.Services;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Ninja.Tenant.API.Apis;

public static class BranchApi
{
    public static IEndpointRouteBuilder MapBranchApi(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("api/branches");

        // Public endpoints
        api.MapGet("/", GetActiveBranches)
            .WithName("GetBranches")
            .WithSummary("List active branches")
            .WithTags("Branches");

        api.MapGet("/all", GetAllBranches)
            .WithName("GetAllBranches")
            .WithSummary("List all branches including inactive")
            .WithTags("Branches")
            .RequireAuthorization("Owner");

        // Admin endpoints
        api.MapPost("/", CreateBranch)
            .WithName("CreateBranch")
            .WithSummary("Create a branch")
            .WithTags("Branches")
            .RequireAuthorization("Owner");

        api.MapPut("/{id:int}", UpdateBranch)
            .WithName("UpdateBranch")
            .WithSummary("Update a branch")
            .WithTags("Branches")
            .RequireAuthorization("Owner");

        api.MapPatch("/{branchId:int}/settings", UpdateBranchSettings)
            .WithName("UpdateBranchSettings")
            .WithSummary("Update branch operational settings (ordering, reservations)")
            .WithTags("Branches")
            // The till pauses and resumes taking orders mid-day, so the cashier
            // needs this as much as the admin: "Pos" = Admin, Owner or Cashier
            .RequireAuthorization("Pos");

        return app;
    }

    public static async Task<Ok<List<BranchResponse>>> GetActiveBranches(TenantContext context)
    {
        var branches = await context.Branches
            .AsNoTracking()
            .Where(b => b.IsActive)
            .OrderBy(b => b.DisplayOrder)
            .Select(b => BranchResponse.From(b))
            .ToListAsync();

        return TypedResults.Ok(branches);
    }

    public static async Task<Ok<List<BranchResponse>>> GetAllBranches(TenantContext context)
    {
        var branches = await context.Branches
            .AsNoTracking()
            .OrderBy(b => b.DisplayOrder)
            .Select(b => BranchResponse.From(b))
            .ToListAsync();

        return TypedResults.Ok(branches);
    }

    public static async Task<Results<Created<BranchResponse>, BadRequest<ProblemDetails>>> CreateBranch(
        TenantContext context,
        BranchSettingsService settings,
        TenantCountry country,
        IHttpClientFactory http,
        CreateBranchRequest request,
        CancellationToken ct)
    {
        if (request.Name is null || request.Name.IsEmpty)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The branch's name is required." });
        if (DeliveryProblem(request.DeliveryRadiusKm, request.DeliveryFee, request.DeliveryMinimumOrder) is { } deliveryProblem)
            return deliveryProblem;

        GeoPoint? point = null;
        if (!string.IsNullOrWhiteSpace(request.Location))
        {
            point = await MapLocation.ResolveAsync(request.Location, http.CreateClient(MapLocation.ClientName), ct);
            if (point is null) return LocationNotRead();
        }

        var branch = new Model.Branch
        {
            Name = request.Name,
            Address = LocalizedText.Optional(request.Address),
            Phone = PhoneRules.Tidy(request.Phone, country.Code),
            TaxNumber = request.TaxNumber,
            ReceiptFooter = LocalizedText.Optional(request.ReceiptFooter),
            IsActive = true,
            DisplayOrder = request.DisplayOrder,
            DayStartTime = request.DayStartTime != null ? TimeOnly.Parse(request.DayStartTime) : new TimeOnly(6, 0),
            IsOrderingEnabled = request.IsOrderingEnabled,
            IsReservationsEnabled = request.IsReservationsEnabled,
            Latitude = point?.Latitude,
            Longitude = point?.Longitude,
            DeliveryRadiusKm = request.DeliveryRadiusKm > 0 ? request.DeliveryRadiusKm : null,
            DeliveryFee = request.DeliveryFee,
            DeliveryMinimumOrder = request.DeliveryMinimumOrder
        };

        context.Branches.Add(branch);
        await context.SaveChangesAsync();
        // Ordering, Spaces and Notification learn of a branch only through its settings event
        await settings.PublishNewAsync(branch);

        var response = BranchResponse.From(branch);
        return TypedResults.Created($"/api/branches/{branch.Id}", response);
    }

    public static async Task<Results<Ok<BranchResponse>, NotFound, BadRequest<ProblemDetails>>> UpdateBranch(
        TenantContext context,
        BranchSettingsService settings,
        [Description("The branch ID")] int id,
        TenantCountry country,
        IHttpClientFactory http,
        UpdateBranchRequest request,
        CancellationToken ct)
    {
        if (request.Name is null || request.Name.IsEmpty)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The branch's name is required." });

        if (DeliveryProblem(request.DeliveryRadiusKm, request.DeliveryFee, request.DeliveryMinimumOrder) is { } deliveryProblem)
            return deliveryProblem;

        var branch = await context.Branches.FindAsync(id);
        if (branch == null)
            return TypedResults.NotFound();

        branch.Name = request.Name;
        branch.Address = LocalizedText.Optional(request.Address);
        branch.Phone = PhoneRules.Tidy(request.Phone, country.Code);
        branch.TaxNumber = request.TaxNumber;
        branch.ReceiptFooter = LocalizedText.Optional(request.ReceiptFooter);
        branch.IsActive = request.IsActive;
        branch.DisplayOrder = request.DisplayOrder;
        if (request.DayStartTime != null) branch.DayStartTime = TimeOnly.Parse(request.DayStartTime);
        // Null leaves each delivery value as it is, like the flags; a radius of 0 takes it away
        if (request.DeliveryRadiusKm != null) branch.DeliveryRadiusKm = request.DeliveryRadiusKm > 0 ? request.DeliveryRadiusKm : null;
        if (request.DeliveryFee != null) branch.DeliveryFee = request.DeliveryFee.Value;
        if (request.DeliveryMinimumOrder != null) branch.DeliveryMinimumOrder = request.DeliveryMinimumOrder.Value;

        // Null leaves where it is; empty takes it off the map; anything else must name a point
        if (request.Location is { } location)
        {
            if (string.IsNullOrWhiteSpace(location))
            {
                branch.Latitude = null;
                branch.Longitude = null;
            }
            else if (await MapLocation.ResolveAsync(location, http.CreateClient(MapLocation.ClientName), ct) is { } point)
            {
                branch.Latitude = point.Latitude;
                branch.Longitude = point.Longitude;
            }
            else
            {
                return LocationNotRead();
            }
        }

        // A delivering branch keeps somewhere to measure from and somewhere to stop: taking either
        // away is refused, as switching delivery on without them is (UpdateBranchSettings)
        if ((request.IsDeliveryEnabled ?? branch.IsDeliveryEnabled) && !branch.CanDeliver)
            return TypedResults.BadRequest<ProblemDetails>(new()
            {
                Title = "Delivery not set",
                Detail = "A branch that delivers needs its location and how far it delivers. Turn delivery off first.",
            });

        // The flags ride the same save; the service announces the change
        await settings.ApplyAsync(branch, request.IsOrderingEnabled, request.IsReservationsEnabled, request.RequireSignInForTableOrders, request.IsDeliveryEnabled, request.RequireSignInForDelivery);

        var response = BranchResponse.From(branch);
        return TypedResults.Ok(response);
    }

    private static BadRequest<ProblemDetails> LocationNotRead() =>
        TypedResults.BadRequest<ProblemDetails>(new()
        {
            Title = "Location not read",
            Detail = "Paste the branch's Google Maps link (Share → Copy link) or its coordinates, like 30.0444, 31.2357.",
        });

    private static BadRequest<ProblemDetails>? DeliveryProblem(decimal? radiusKm, decimal? fee, decimal? minimum) =>
        radiusKm < 0 || radiusKm > 100 || fee < 0 || minimum < 0
            ? TypedResults.BadRequest<ProblemDetails>(new()
            {
                Title = "Delivery not set",
                Detail = "The delivery radius is up to 100 km, and the fee and the minimum order can't be below zero.",
            })
            : null;

    public static async Task<Results<Ok<BranchResponse>, NotFound, BadRequest<ProblemDetails>>> UpdateBranchSettings(
        TenantContext context,
        BranchSettingsService settings,
        [Description("The branch ID")] int branchId,
        UpdateBranchSettingsRequest request)
    {
        // Switching delivery on needs somewhere to measure from and somewhere to stop
        if (request.IsDeliveryEnabled == true
            && await context.Branches.FindAsync(branchId) is { CanDeliver: false })
        {
            return TypedResults.BadRequest<ProblemDetails>(new()
            {
                Title = "Delivery not set",
                Detail = "Set the branch's location and how far it delivers first.",
            });
        }

        var branch = await settings.ApplyAsync(branchId, request.IsOrderingEnabled, request.IsReservationsEnabled, request.RequireSignInForTableOrders, request.IsDeliveryEnabled, request.RequireSignInForDelivery);
        if (branch == null)
            return TypedResults.NotFound();

        var response = BranchResponse.From(branch);
        return TypedResults.Ok(response);
    }

}

/// <param name="DayStartTime">When the branch's day turns over; a day runs from it to the same time the next day.</param>
/// <param name="Latitude">Where the branch is, with Longitude; null until its location is set.</param>
/// <param name="IsDeliveryEnabled">The branch delivers with its own riders, within DeliveryRadiusKm of where it is.</param>
/// <param name="DayEndTime">Always the same as DayStartTime, a whole day: kept for the apps already installed, which read a day from a start and an end and take an end at its start as a full day round.</param>
/// <param name="RequireSignInForDelivery">Customers must be signed in to order delivery here; the till's phone orders are not held to it.</param>
public record BranchResponse(int Id, LocalizedText Name, LocalizedText? Address, string? Phone, string? TaxNumber, LocalizedText? ReceiptFooter, bool IsActive, int DisplayOrder, string DayStartTime, string DayEndTime, bool IsOrderingEnabled, bool IsReservationsEnabled, bool RequireSignInForTableOrders = false, double? Latitude = null, double? Longitude = null, bool IsDeliveryEnabled = false, decimal? DeliveryRadiusKm = null, decimal DeliveryFee = 0, decimal DeliveryMinimumOrder = 0, bool RequireSignInForDelivery = false)
{
    public static BranchResponse From(Model.Branch b) => new(
        b.Id, b.Name, b.Address, b.Phone, b.TaxNumber, b.ReceiptFooter, b.IsActive, b.DisplayOrder,
        b.DayStartTime.ToString("HH:mm"), b.DayStartTime.ToString("HH:mm"),
        b.IsOrderingEnabled, b.IsReservationsEnabled, b.RequireSignInForTableOrders, b.Latitude, b.Longitude,
        b.IsDeliveryEnabled, b.DeliveryRadiusKm, b.DeliveryFee, b.DeliveryMinimumOrder, b.RequireSignInForDelivery);
}

public record CreateBranchRequest(LocalizedText Name, LocalizedText? Address, string? Phone, int DisplayOrder = 0, string? TaxNumber = null, LocalizedText? ReceiptFooter = null, string? DayStartTime = null, bool IsOrderingEnabled = true, bool IsReservationsEnabled = true, string? Location = null, decimal? DeliveryRadiusKm = null, decimal DeliveryFee = 0, decimal DeliveryMinimumOrder = 0);

public record UpdateBranchRequest(LocalizedText Name, LocalizedText? Address, string? Phone, bool IsActive, int DisplayOrder, string? TaxNumber = null, LocalizedText? ReceiptFooter = null, string? DayStartTime = null, bool? IsOrderingEnabled = null, bool? IsReservationsEnabled = null, bool? RequireSignInForTableOrders = null, string? Location = null, bool? IsDeliveryEnabled = null, decimal? DeliveryRadiusKm = null, decimal? DeliveryFee = null, decimal? DeliveryMinimumOrder = null, bool? RequireSignInForDelivery = null);

public record UpdateBranchSettingsRequest(bool? IsOrderingEnabled = null, bool? IsReservationsEnabled = null, bool? RequireSignInForTableOrders = null, bool? IsDeliveryEnabled = null, bool? RequireSignInForDelivery = null);

