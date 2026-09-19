using System.ComponentModel;
using Ninja.Branch.API.Model;
using Ninja.Branch.API.Services;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Ninja.Branch.API.Apis;

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

    public static async Task<Ok<List<BranchResponse>>> GetActiveBranches(BranchContext context)
    {
        var branches = await context.Branches
            .AsNoTracking()
            .Where(b => b.IsActive)
            .OrderBy(b => b.DisplayOrder)
            .Select(b => new BranchResponse(b.Id, b.Name, b.Address, b.Phone, b.TaxNumber, b.ReceiptFooter, b.IsActive, b.DisplayOrder, b.DayStartTime.ToString("HH:mm"), b.DayEndTime.ToString("HH:mm"), b.IsOrderingEnabled, b.IsReservationsEnabled, b.RequireSignInForTableOrders))
            .ToListAsync();

        return TypedResults.Ok(branches);
    }

    public static async Task<Ok<List<BranchResponse>>> GetAllBranches(BranchContext context)
    {
        var branches = await context.Branches
            .AsNoTracking()
            .OrderBy(b => b.DisplayOrder)
            .Select(b => new BranchResponse(b.Id, b.Name, b.Address, b.Phone, b.TaxNumber, b.ReceiptFooter, b.IsActive, b.DisplayOrder, b.DayStartTime.ToString("HH:mm"), b.DayEndTime.ToString("HH:mm"), b.IsOrderingEnabled, b.IsReservationsEnabled, b.RequireSignInForTableOrders))
            .ToListAsync();

        return TypedResults.Ok(branches);
    }

    public static async Task<Created<BranchResponse>> CreateBranch(
        BranchContext context,
        CreateBranchRequest request)
    {
        var branch = new Model.Branch
        {
            Name = request.Name,
            Address = request.Address,
            Phone = request.Phone,
            TaxNumber = request.TaxNumber,
            ReceiptFooter = request.ReceiptFooter,
            IsActive = true,
            DisplayOrder = request.DisplayOrder,
            DayStartTime = request.DayStartTime != null ? TimeOnly.Parse(request.DayStartTime) : new TimeOnly(17, 0),
            DayEndTime = request.DayEndTime != null ? TimeOnly.Parse(request.DayEndTime) : new TimeOnly(5, 0),
            IsOrderingEnabled = request.IsOrderingEnabled,
            IsReservationsEnabled = request.IsReservationsEnabled
        };

        context.Branches.Add(branch);
        await context.SaveChangesAsync();

        var response = new BranchResponse(branch.Id, branch.Name, branch.Address, branch.Phone, branch.TaxNumber, branch.ReceiptFooter, branch.IsActive, branch.DisplayOrder, branch.DayStartTime.ToString("HH:mm"), branch.DayEndTime.ToString("HH:mm"), branch.IsOrderingEnabled, branch.IsReservationsEnabled, branch.RequireSignInForTableOrders);
        return TypedResults.Created($"/api/branches/{branch.Id}", response);
    }

    public static async Task<Results<Ok<BranchResponse>, NotFound>> UpdateBranch(
        BranchContext context,
        BranchSettingsService settings,
        [Description("The branch ID")] int id,
        UpdateBranchRequest request)
    {
        var branch = await context.Branches.FindAsync(id);
        if (branch == null)
            return TypedResults.NotFound();

        branch.Name = request.Name;
        branch.Address = request.Address;
        branch.Phone = request.Phone;
        branch.TaxNumber = request.TaxNumber;
        branch.ReceiptFooter = request.ReceiptFooter;
        branch.IsActive = request.IsActive;
        branch.DisplayOrder = request.DisplayOrder;
        if (request.DayStartTime != null) branch.DayStartTime = TimeOnly.Parse(request.DayStartTime);
        if (request.DayEndTime != null) branch.DayEndTime = TimeOnly.Parse(request.DayEndTime);

        // The flags ride the same save; the service announces the change
        await settings.ApplyAsync(branch, request.IsOrderingEnabled, request.IsReservationsEnabled, request.RequireSignInForTableOrders);

        var response = new BranchResponse(branch.Id, branch.Name, branch.Address, branch.Phone, branch.TaxNumber, branch.ReceiptFooter, branch.IsActive, branch.DisplayOrder, branch.DayStartTime.ToString("HH:mm"), branch.DayEndTime.ToString("HH:mm"), branch.IsOrderingEnabled, branch.IsReservationsEnabled, branch.RequireSignInForTableOrders);
        return TypedResults.Ok(response);
    }

    public static async Task<Results<Ok<BranchResponse>, NotFound>> UpdateBranchSettings(
        BranchSettingsService settings,
        [Description("The branch ID")] int branchId,
        UpdateBranchSettingsRequest request)
    {
        var branch = await settings.ApplyAsync(branchId, request.IsOrderingEnabled, request.IsReservationsEnabled, request.RequireSignInForTableOrders);
        if (branch == null)
            return TypedResults.NotFound();

        var response = new BranchResponse(branch.Id, branch.Name, branch.Address, branch.Phone, branch.TaxNumber, branch.ReceiptFooter, branch.IsActive, branch.DisplayOrder, branch.DayStartTime.ToString("HH:mm"), branch.DayEndTime.ToString("HH:mm"), branch.IsOrderingEnabled, branch.IsReservationsEnabled, branch.RequireSignInForTableOrders);
        return TypedResults.Ok(response);
    }

}

public record BranchResponse(int Id, LocalizedText Name, LocalizedText? Address, string? Phone, string? TaxNumber, LocalizedText? ReceiptFooter, bool IsActive, int DisplayOrder, string DayStartTime, string DayEndTime, bool IsOrderingEnabled, bool IsReservationsEnabled, bool RequireSignInForTableOrders = false);

public record CreateBranchRequest(LocalizedText Name, LocalizedText? Address, string? Phone, int DisplayOrder = 0, string? TaxNumber = null, LocalizedText? ReceiptFooter = null, string? DayStartTime = null, string? DayEndTime = null, bool IsOrderingEnabled = true, bool IsReservationsEnabled = true);

public record UpdateBranchRequest(LocalizedText Name, LocalizedText? Address, string? Phone, bool IsActive, int DisplayOrder, string? TaxNumber = null, LocalizedText? ReceiptFooter = null, string? DayStartTime = null, string? DayEndTime = null, bool? IsOrderingEnabled = null, bool? IsReservationsEnabled = null, bool? RequireSignInForTableOrders = null);

public record UpdateBranchSettingsRequest(bool? IsOrderingEnabled = null, bool? IsReservationsEnabled = null, bool? RequireSignInForTableOrders = null);

