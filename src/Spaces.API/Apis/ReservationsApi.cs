using System.ComponentModel;
using Ninja.Spaces.API.Application.Commands;
using Ninja.Spaces.API.Application.Queries;
using Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Ninja.Spaces.Domain.Exceptions;
using Ninja.ServiceDefaults;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Ninja.Spaces.API.Apis;

/// <summary>
/// Reservations: a party's claim on a place, for now or for later, with or
/// without a clock. Making one and giving up one's own are any signed-in
/// customer; the floor (open list, confirm, seat, cancel) is the "Pos"
/// policy. The stay a seated reservation hands over to lives under
/// <see cref="StaysApi"/>.
/// </summary>
public static class ReservationsApi
{
    public static IEndpointRouteBuilder MapReservationsApi(this IEndpointRouteBuilder app)
    {
        var reservations = app.MapGroup("api/reservations").WithTags("Reservations");

        reservations.MapPost("/", Reserve).WithName("ReservePlace")
            .WithSummary("Reserve a place")
            .WithDescription("For now — the customer has 10 minutes to arrive — or, with a time, for later. On a timed place, startOnConfirm asks that the clock start the moment the till confirms. Staff reserve on a customer's behalf: the typed name is the party, and it never lapses.")
            .RequireAuthorization();
        reservations.MapGet("/my", GetMyReservations).WithName("GetMyReservations")
            .WithSummary("The signed-in customer's reservations, newest first")
            .RequireAuthorization();
        reservations.MapGet("/open", GetOpenReservations).WithName("GetOpenReservations")
            .WithSummary("Open reservations of the branch, soonest first (staff)")
            .RequireAuthorization("Pos");
        reservations.MapGet("/history", GetHistory).WithName("GetReservationHistory")
            .WithSummary("Seated, cancelled and lapsed reservations across the branch, paged (Admin)")
            .RequireAuthorization("Admin");
        reservations.MapGet("/{id:int}", GetReservationById).WithName("GetReservation")
            .WithSummary("Get a reservation")
            .RequireAuthorization();

        reservations.MapPost("/{id:int}/confirm", Confirm).WithName("ConfirmReservation")
            .WithSummary("Acknowledge a reservation (staff)")
            .WithDescription("On a timed place where the customer asked for start-on-confirm, also seats them and starts the clock; otherwise the reservation waits, confirmed, for Seat")
            .RequireAuthorization("Pos");
        reservations.MapPost("/{id:int}/seat", Seat).WithName("SeatReservation")
            .WithSummary("The party arrived and sat down (staff)")
            .WithDescription("On a timed place the clock starts and the stay is returned; on a plain table the reservation simply closes")
            .RequireAuthorization("Pos");
        reservations.MapPost("/{id:int}/assign-customer", AssignCustomer).WithName("AssignReservationCustomer")
            .WithSummary("Name the customer on a reservation the till made for an unnamed party (staff)")
            .RequireAuthorization("Pos");
        reservations.MapPost("/{id:int}/cancel", Cancel).WithName("CancelReservation")
            .WithSummary("Give up a reservation before anyone sat down (staff)")
            .RequireAuthorization("Pos");
        reservations.MapPost("/my/{id:int}/cancel", CancelMine).WithName("CancelMyReservation")
            .WithSummary("Give up your own reservation before you are seated")
            .RequireAuthorization();

        return app;
    }

    public static async Task<Results<Created<int>, BadRequest<ProblemDetails>>> Reserve(
        [FromServices] IMediator mediator,
        HttpContext httpContext,
        ReservePlaceRequest request)
    {
        var customerId = httpContext.User.GetUserId();
        if (string.IsNullOrEmpty(customerId))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "User ID not found in token" });

        var isStaff = httpContext.IsStaff();
        try
        {
            // A staff reservation is for a party at the counter or on the
            // phone: the typed name is the customer, and it is not tied to
            // the cashier's own account. A customer reserving for themselves
            // keeps their id and name.
            var id = await mediator.Send(new ReservePlaceCommand(
                request.PlaceId,
                isStaff ? null : customerId,
                isStaff ? request.CustomerName : httpContext.User.GetUserName() ?? request.CustomerName,
                request.For,
                request.PartySize,
                request.Notes,
                request.StartOnConfirm,
                request.OptionCode,
                isStaff));
            return TypedResults.Created($"/api/reservations/{id}", id);
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Ok<IEnumerable<ReservationViewModel>>> GetMyReservations(
        [FromServices] IReservationQueries queries,
        HttpContext httpContext,
        int pageIndex = 0,
        int pageSize = 20)
    {
        pageSize = Math.Clamp(pageSize, 1, 50);
        var customerId = httpContext.User.GetUserId() ?? string.Empty;
        return TypedResults.Ok(await queries.GetCustomerReservationsAsync(customerId, Math.Max(0, pageIndex), pageSize));
    }

    public static async Task<Ok<IEnumerable<ReservationViewModel>>> GetOpenReservations(
        [FromServices] IReservationQueries queries,
        HttpContext httpContext)
    {
        var branchId = httpContext.GetRequiredBranchId();
        return TypedResults.Ok(await queries.GetOpenAsync(branchId));
    }

    public static async Task<Ok<PaginatedResult<ReservationViewModel>>> GetHistory(
        [FromServices] IReservationQueries queries,
        HttpContext httpContext,
        int pageIndex = 0,
        int pageSize = 20,
        [Description("Filter by place")] int? placeId = null,
        DateTime? fromDate = null,
        DateTime? toDate = null)
    {
        var branchId = httpContext.GetRequiredBranchId();
        pageSize = Math.Clamp(pageSize, 1, 100);
        return TypedResults.Ok(await queries.GetHistoryAsync(branchId, Math.Max(0, pageIndex), pageSize, placeId, fromDate, toDate));
    }

    public static async Task<Results<Ok<ReservationViewModel>, NotFound>> GetReservationById(
        [FromServices] IReservationQueries queries,
        [Description("The reservation ID")] int id)
    {
        var reservation = await queries.GetByIdAsync(id);
        return reservation is null ? TypedResults.NotFound() : TypedResults.Ok(reservation);
    }

    public static Task<Results<Ok<SeatResult>, BadRequest<ProblemDetails>>> Confirm(
        [FromServices] IMediator mediator,
        [Description("The reservation ID")] int id,
        SeatReservationRequest? request = null)
        => RunSeat(mediator, new ConfirmReservationCommand(id, request?.OptionCode));

    public static Task<Results<Ok<SeatResult>, BadRequest<ProblemDetails>>> Seat(
        [FromServices] IMediator mediator,
        [Description("The reservation ID")] int id,
        SeatReservationRequest? request = null)
        => RunSeat(mediator, new SeatReservationCommand(id, request?.OptionCode));

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> AssignCustomer(
        [FromServices] IReservationRepository reservations,
        [Description("The reservation ID")] int id,
        AssignCustomerRequest request)
    {
        var reservation = await reservations.GetAsync(id);
        if (reservation is null) return TypedResults.NotFound();
        try
        {
            reservation.AssignCustomer(request.CustomerId, request.CustomerName);
            reservations.Update(reservation);
            await reservations.UnitOfWork.SaveEntitiesAsync();
            return TypedResults.Ok();
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> Cancel(
        [FromServices] IMediator mediator,
        [Description("The reservation ID")] int id)
        => PlacesApi.Run(mediator, new CancelReservationCommand(id));

    public static async Task<Results<Ok, NotFound, ForbidHttpResult, BadRequest<ProblemDetails>>> CancelMine(
        [FromServices] IMediator mediator,
        HttpContext httpContext,
        [Description("The reservation ID")] int id)
    {
        var customerId = httpContext.User.GetUserId();
        if (string.IsNullOrEmpty(customerId))
            return TypedResults.Forbid();
        try
        {
            var ok = await mediator.Send(new CancelReservationCommand(id, OnlyIfCustomerId: customerId));
            return ok ? TypedResults.Ok() : TypedResults.NotFound();
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    private static async Task<Results<Ok<SeatResult>, BadRequest<ProblemDetails>>> RunSeat(IMediator mediator, IRequest<SeatResult> command)
    {
        try
        {
            return TypedResults.Ok(await mediator.Send(command));
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }
}

/// <param name="For">When the party is expected; leave it out to reserve for now.</param>
/// <param name="OptionCode">On a timed place: the rate to start at when the clock starts on Confirm; one of the place's tariff options.</param>
public record ReservePlaceRequest(
    int PlaceId,
    DateTime? For = null,
    int? PartySize = null,
    string? CustomerName = null,
    string? Notes = null,
    bool StartOnConfirm = false,
    string? OptionCode = null);

/// <param name="OptionCode">On a timed place: the rate the clock starts at; null takes the one the customer asked for, else the tariff's default.</param>
public record SeatReservationRequest(string? OptionCode = null);
