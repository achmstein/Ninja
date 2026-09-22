using System.ComponentModel;
using Ninja.Spaces.API.Application.Commands;
using Ninja.Spaces.API.Application.Queries;
using Ninja.Spaces.Domain.AggregatesModel.StayAggregate;
using Ninja.Spaces.Domain.Exceptions;
using Ninja.ServiceDefaults;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Ninja.Spaces.API.Apis;

/// <summary>
/// Stays: the clock at a timed place, from a walk-in or a seated
/// reservation until it is ended or cut short. Running the floor (end,
/// cancel, option, members) is the "Pos" policy; leaving and "my stays"
/// are any signed-in customer.
/// </summary>
public static class StaysApi
{
    public static IEndpointRouteBuilder MapStaysApi(this IEndpointRouteBuilder app)
    {
        var stays = app.MapGroup("api/stays").WithTags("Stays");

        stays.MapGet("/my", GetMyStays).WithName("GetMyStays")
            .WithSummary("The signed-in customer's stays, newest first")
            .RequireAuthorization();
        stays.MapGet("/open", GetOpenStays).WithName("GetOpenStays")
            .WithSummary("Running stays of the branch (staff)")
            .RequireAuthorization("Pos");
        stays.MapGet("/history", GetStayHistory).WithName("GetStayHistory")
            .WithSummary("Ended and cancelled stays across the branch, paged (Admin)")
            .RequireAuthorization("Admin");
        stays.MapGet("/stats", GetStayStats).WithName("GetStayStats")
            .WithSummary("Per-day and per-place hours, stays and revenue (Admin)")
            .RequireAuthorization("Admin");
        stays.MapGet("/{id:int}", GetStayById).WithName("GetStay")
            .WithSummary("Get a stay")
            .RequireAuthorization();

        stays.MapPost("/{id:int}/end", EndStay).WithName("EndStay")
            .WithSummary("Stop the clock and settle the cost (staff)")
            .RequireAuthorization("Pos");
        stays.MapPost("/{id:int}/cancel", CancelStay).WithName("CancelStay")
            .WithSummary("Cut a running stay short; nothing is billed (staff)")
            .RequireAuthorization("Pos");
        stays.MapPut("/{id:int}/option", ChangeStayOption).WithName("ChangeStayOption")
            .WithSummary("Switch a running stay to another rate option (staff)")
            .RequireAuthorization("Pos");
        stays.MapPost("/{id:int}/assign-customer", AssignCustomer).WithName("AssignStayCustomer")
            .WithSummary("Give an unclaimed walk-in its owner (staff)")
            .RequireAuthorization("Pos");
        stays.MapPost("/{id:int}/members", AddMember).WithName("AddStayMember")
            .WithSummary("Name someone in the party (staff)")
            .WithDescription("Allowed on a running or ended stay: after the clock stops this still names who was there, so their share can go on their tab at settle")
            .RequireAuthorization("Pos");
        stays.MapDelete("/{id:int}/members/{customerId}", RemoveMember).WithName("RemoveStayMember")
            .WithSummary("Remove a member (not the owner) from a running stay (staff)")
            .RequireAuthorization("Pos");
        stays.MapPost("/{id:int}/leave", LeaveStay).WithName("LeaveStay")
            .WithSummary("Leave a stay you joined (not as its owner)")
            .RequireAuthorization();

        return app;
    }

    public static async Task<Ok<IEnumerable<StayViewModel>>> GetMyStays(
        [FromServices] IPlaceQueries queries,
        HttpContext httpContext,
        int pageIndex = 0,
        int pageSize = 20)
    {
        pageSize = Math.Clamp(pageSize, 1, 50);
        var customerId = httpContext.User.GetUserId() ?? string.Empty;
        return TypedResults.Ok(await queries.GetCustomerStaysAsync(customerId, Math.Max(0, pageIndex), pageSize));
    }

    public static async Task<Ok<IEnumerable<StayViewModel>>> GetOpenStays(
        [FromServices] IPlaceQueries queries,
        HttpContext httpContext)
    {
        var branchId = httpContext.GetRequiredBranchId();
        return TypedResults.Ok(await queries.GetOpenStaysAsync(branchId));
    }

    public static async Task<Ok<PaginatedResult<StayViewModel>>> GetStayHistory(
        [FromServices] IPlaceQueries queries,
        HttpContext httpContext,
        int pageIndex = 0,
        int pageSize = 20,
        [Description("Filter by place")] int? placeId = null,
        DateTime? fromDate = null,
        DateTime? toDate = null)
    {
        var branchId = httpContext.GetRequiredBranchId();
        return TypedResults.Ok(await queries.GetStayHistoryAsync(branchId, pageIndex, pageSize, placeId, fromDate, toDate));
    }

    public static async Task<Ok<StayStats>> GetStayStats(
        [FromServices] IPlaceQueries queries,
        HttpContext httpContext,
        DateTime fromDate,
        DateTime toDate,
        [Description("JS getTimezoneOffset() of the caller, for local-day bucketing")] int tzOffsetMinutes = 0)
    {
        var branchId = httpContext.GetRequiredBranchId();
        return TypedResults.Ok(await queries.GetStayStatsAsync(branchId, fromDate, toDate, tzOffsetMinutes));
    }

    public static async Task<Results<Ok<StayViewModel>, NotFound>> GetStayById(
        [FromServices] IPlaceQueries queries,
        [Description("The stay ID")] int id)
    {
        var stay = await queries.GetStayByIdAsync(id);
        return stay is null ? TypedResults.NotFound() : TypedResults.Ok(stay);
    }

    public static Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> EndStay(
        [FromServices] IMediator mediator,
        [Description("The stay ID")] int id)
        => PlacesApi.Run(mediator, new EndStayCommand(id));

    public static Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> CancelStay(
        [FromServices] IMediator mediator,
        [Description("The stay ID")] int id)
        => PlacesApi.Run(mediator, new CancelStayCommand(id));

    public static Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> ChangeStayOption(
        [FromServices] IMediator mediator,
        [Description("The stay ID")] int id,
        ChangeStayOptionRequest request)
        => PlacesApi.Run(mediator, new ChangeStayOptionCommand(id, request.OptionCode));

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> LeaveStay(
        [FromServices] IMediator mediator,
        HttpContext httpContext,
        [Description("The stay ID")] int id)
    {
        var customerId = httpContext.User.GetUserId();
        if (string.IsNullOrEmpty(customerId))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "User ID not found in token" });
        return await PlacesApi.Run(mediator, new LeaveStayCommand(id, customerId));
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> AssignCustomer(
        [FromServices] IStayRepository stays,
        [Description("The stay ID")] int id,
        AssignCustomerRequest request)
    {
        var stay = await stays.GetWithMembersAsync(id);
        if (stay is null) return TypedResults.NotFound();
        try
        {
            stay.AssignCustomer(request.CustomerId, request.CustomerName);
            stays.Update(stay);
            await stays.UnitOfWork.SaveEntitiesAsync();
            return TypedResults.Ok();
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> AddMember(
        [FromServices] IStayRepository stays,
        [Description("The stay ID")] int id,
        AddMemberRequest request)
    {
        var stay = await stays.GetWithMembersAsync(id);
        if (stay is null) return TypedResults.NotFound();
        try
        {
            stay.AddMember(request.CustomerId, request.CustomerName);
            stays.Update(stay);
            await stays.UnitOfWork.SaveEntitiesAsync();
            return TypedResults.Ok();
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> RemoveMember(
        [FromServices] IStayRepository stays,
        [Description("The stay ID")] int id,
        [Description("The customer ID to remove")] string customerId)
    {
        var stay = await stays.GetWithMembersAsync(id);
        if (stay is null) return TypedResults.NotFound();
        try
        {
            stay.RemoveMember(customerId);
            stays.Update(stay);
            await stays.UnitOfWork.SaveEntitiesAsync();
            return TypedResults.Ok();
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }
}

public record ChangeStayOptionRequest(string OptionCode);

public record AssignCustomerRequest(string CustomerId, string? CustomerName);

public record AddMemberRequest(string CustomerId, string? CustomerName);
