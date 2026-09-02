#nullable enable
using Chillax.Sales.API.Application.Commands;
using Chillax.Sales.API.Application.Queries;
using Chillax.Sales.Domain.AggregatesModel.ShiftAggregate;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Chillax.Sales.API.Apis;

public static class ShiftsApi
{
    public static RouteGroupBuilder MapShiftsApi(this IEndpointRouteBuilder app)
    {
        // "Pos" = Admin, Owner or Cashier — opening and counting the drawer
        // is exactly the cashier's job
        var api = app.NewVersionedApi("Shifts")
            .MapGroup("api/shifts")
            .HasApiVersion(1.0)
            .RequireAuthorization("Pos");

        api.MapPost("/open", OpenShift)
            .WithName("OpenShift")
            .WithSummary("Open the branch's drawer shift with a counted float");

        api.MapGet("/current", GetCurrentShift)
            .WithName("GetCurrentShift")
            .WithSummary("The branch's open shift as a live X report (404 when none)");

        api.MapGet("/{id:int}", GetShift)
            .WithName("GetShift")
            .WithSummary("One shift as an X (open) or Z (closed) report");

        api.MapGet("/", GetClosedShifts)
            .WithName("GetClosedShifts")
            .WithSummary("Closed shifts, newest first — the Z-report history");

        api.MapPost("/{id:int}/movements", AddMovement)
            .WithName("AddCashMovement")
            .WithSummary("Record cash paid into or out of the drawer");

        api.MapPost("/{id:int}/close", CloseShift)
            .WithName("CloseShift")
            .WithSummary("Count the drawer and close the shift")
            .WithDescription("Freezes expected cash and over/short; returns the Z report.");

        return api;
    }

    public static async Task<Results<Ok<OpenShiftResponse>, BadRequest<string>>> OpenShift(
        OpenShiftRequest request,
        HttpContext httpContext,
        [FromServices] IMediator mediator)
    {
        var branchId = httpContext.GetRequiredBranchId();

        try
        {
            var shiftId = await mediator.Send(new OpenShiftCommand(
                branchId, request.OpeningFloat, httpContext.User.GetUserId() ?? "unknown"));

            return TypedResults.Ok(new OpenShiftResponse(shiftId));
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok<ShiftView>, NotFound>> GetCurrentShift(
        HttpContext httpContext,
        [FromServices] IShiftQueries queries)
    {
        var branchId = httpContext.GetRequiredBranchId();
        var shift = await queries.GetCurrentShiftAsync(branchId);
        return shift is null ? TypedResults.NotFound() : TypedResults.Ok(shift);
    }

    public static async Task<Results<Ok<ShiftView>, NotFound>> GetShift(
        int id,
        [FromServices] IShiftQueries queries)
    {
        var shift = await queries.GetShiftAsync(id);
        return shift is null ? TypedResults.NotFound() : TypedResults.Ok(shift);
    }

    public static async Task<Ok<IEnumerable<ShiftView>>> GetClosedShifts(
        HttpContext httpContext,
        [FromServices] IShiftQueries queries,
        int pageIndex = 0,
        int pageSize = 20)
    {
        var branchId = httpContext.GetRequiredBranchId();
        pageSize = Math.Clamp(pageSize, 1, 50);
        return TypedResults.Ok(await queries.GetClosedShiftsAsync(branchId, Math.Max(0, pageIndex), pageSize));
    }

    public static async Task<Results<Ok, BadRequest<string>>> AddMovement(
        int id,
        CashMovementRequest request,
        HttpContext httpContext,
        [FromServices] IMediator mediator)
    {
        try
        {
            await mediator.Send(new AddCashMovementCommand(
                id, request.Type, request.Amount, request.Reason, httpContext.User.GetUserId() ?? "unknown"));

            return TypedResults.Ok();
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok<ShiftView>, BadRequest<string>>> CloseShift(
        int id,
        CloseShiftRequest request,
        HttpContext httpContext,
        [FromServices] IMediator mediator)
    {
        try
        {
            var zReport = await mediator.Send(new CloseShiftCommand(
                id, request.ClosingCount, httpContext.User.GetUserId() ?? "unknown"));

            return TypedResults.Ok(zReport);
        }
        catch (SalesDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }
}

public record OpenShiftRequest(decimal OpeningFloat);

public record OpenShiftResponse(int ShiftId);

public record CashMovementRequest(CashMovementType Type, decimal Amount, string Reason);

public record CloseShiftRequest(decimal ClosingCount);
