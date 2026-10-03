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
            .Select(b => new BranchResponse(b.Id, b.Name, b.Address, b.Phone, b.TaxNumber, b.ReceiptFooter, b.IsActive, b.DisplayOrder, b.DayStartTime.ToString("HH:mm"), b.DayStartTime.ToString("HH:mm"), b.IsOrderingEnabled, b.IsReservationsEnabled, b.RequireSignInForTableOrders, b.Latitude, b.Longitude))
            .ToListAsync();

        return TypedResults.Ok(branches);
    }

    public static async Task<Ok<List<BranchResponse>>> GetAllBranches(TenantContext context)
    {
        var branches = await context.Branches
            .AsNoTracking()
            .OrderBy(b => b.DisplayOrder)
            .Select(b => new BranchResponse(b.Id, b.Name, b.Address, b.Phone, b.TaxNumber, b.ReceiptFooter, b.IsActive, b.DisplayOrder, b.DayStartTime.ToString("HH:mm"), b.DayStartTime.ToString("HH:mm"), b.IsOrderingEnabled, b.IsReservationsEnabled, b.RequireSignInForTableOrders, b.Latitude, b.Longitude))
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

        GeoPoint? point = null;
        if (!string.IsNullOrWhiteSpace(request.Location))
        {
            point = await MapLocation.ResolveAsync(request.Location, http.CreateClient(MapLinkClient), ct);
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
            Longitude = point?.Longitude
        };

        context.Branches.Add(branch);
        await context.SaveChangesAsync();
        // Ordering, Spaces and Notification learn of a branch only through its settings event
        await settings.PublishNewAsync(branch);

        var response = new BranchResponse(branch.Id, branch.Name, branch.Address, branch.Phone, branch.TaxNumber, branch.ReceiptFooter, branch.IsActive, branch.DisplayOrder, branch.DayStartTime.ToString("HH:mm"), branch.DayStartTime.ToString("HH:mm"), branch.IsOrderingEnabled, branch.IsReservationsEnabled, branch.RequireSignInForTableOrders, branch.Latitude, branch.Longitude);
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

        // Null leaves where it is; empty takes it off the map; anything else must name a point
        if (request.Location is { } location)
        {
            if (string.IsNullOrWhiteSpace(location))
            {
                branch.Latitude = null;
                branch.Longitude = null;
            }
            else if (await MapLocation.ResolveAsync(location, http.CreateClient(MapLinkClient), ct) is { } point)
            {
                branch.Latitude = point.Latitude;
                branch.Longitude = point.Longitude;
            }
            else
            {
                return LocationNotRead();
            }
        }

        // The flags ride the same save; the service announces the change
        await settings.ApplyAsync(branch, request.IsOrderingEnabled, request.IsReservationsEnabled, request.RequireSignInForTableOrders);

        var response = new BranchResponse(branch.Id, branch.Name, branch.Address, branch.Phone, branch.TaxNumber, branch.ReceiptFooter, branch.IsActive, branch.DisplayOrder, branch.DayStartTime.ToString("HH:mm"), branch.DayStartTime.ToString("HH:mm"), branch.IsOrderingEnabled, branch.IsReservationsEnabled, branch.RequireSignInForTableOrders, branch.Latitude, branch.Longitude);
        return TypedResults.Ok(response);
    }

    /// <summary>The client that follows a short Maps link to the map it opens.</summary>
    public const string MapLinkClient = "map-links";

    private static BadRequest<ProblemDetails> LocationNotRead() =>
        TypedResults.BadRequest<ProblemDetails>(new()
        {
            Title = "Location not read",
            Detail = "Paste the branch's Google Maps link (Share → Copy link) or its coordinates, like 30.0444, 31.2357.",
        });

    public static async Task<Results<Ok<BranchResponse>, NotFound>> UpdateBranchSettings(
        BranchSettingsService settings,
        [Description("The branch ID")] int branchId,
        UpdateBranchSettingsRequest request)
    {
        var branch = await settings.ApplyAsync(branchId, request.IsOrderingEnabled, request.IsReservationsEnabled, request.RequireSignInForTableOrders);
        if (branch == null)
            return TypedResults.NotFound();

        var response = new BranchResponse(branch.Id, branch.Name, branch.Address, branch.Phone, branch.TaxNumber, branch.ReceiptFooter, branch.IsActive, branch.DisplayOrder, branch.DayStartTime.ToString("HH:mm"), branch.DayStartTime.ToString("HH:mm"), branch.IsOrderingEnabled, branch.IsReservationsEnabled, branch.RequireSignInForTableOrders, branch.Latitude, branch.Longitude);
        return TypedResults.Ok(response);
    }

}

/// <param name="DayStartTime">When the branch's day turns over; a day runs from it to the same time the next day.</param>
/// <param name="Latitude">Where the branch is, with Longitude; null until its location is set.</param>
/// <param name="DayEndTime">Always the same as DayStartTime, a whole day: kept for the apps already installed, which read a day from a start and an end and take an end at its start as a full day round.</param>
public record BranchResponse(int Id, LocalizedText Name, LocalizedText? Address, string? Phone, string? TaxNumber, LocalizedText? ReceiptFooter, bool IsActive, int DisplayOrder, string DayStartTime, string DayEndTime, bool IsOrderingEnabled, bool IsReservationsEnabled, bool RequireSignInForTableOrders = false, double? Latitude = null, double? Longitude = null);

public record CreateBranchRequest(LocalizedText Name, LocalizedText? Address, string? Phone, int DisplayOrder = 0, string? TaxNumber = null, LocalizedText? ReceiptFooter = null, string? DayStartTime = null, bool IsOrderingEnabled = true, bool IsReservationsEnabled = true, string? Location = null);

public record UpdateBranchRequest(LocalizedText Name, LocalizedText? Address, string? Phone, bool IsActive, int DisplayOrder, string? TaxNumber = null, LocalizedText? ReceiptFooter = null, string? DayStartTime = null, bool? IsOrderingEnabled = null, bool? IsReservationsEnabled = null, bool? RequireSignInForTableOrders = null, string? Location = null);

public record UpdateBranchSettingsRequest(bool? IsOrderingEnabled = null, bool? IsReservationsEnabled = null, bool? RequireSignInForTableOrders = null);

