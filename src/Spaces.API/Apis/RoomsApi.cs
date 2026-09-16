using System.ComponentModel;
using Chillax.Spaces.API.Application.Commands;
using Chillax.Spaces.API.Application.Queries;
using Chillax.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Chillax.Spaces.Domain.Exceptions;
using Chillax.Spaces.Domain.SeedWork;
using Chillax.ServiceDefaults;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Chillax.Spaces.API.Apis;

/// <summary>
/// The routes the tills and the customer apps called before the Places
/// remodel, kept for one release as thin aliases over the same commands and
/// queries as <see cref="PlacesApi"/>. Rooms kept their ids, so a room id
/// here is the place id. "Single"/"Multi" are accepted as option codes
/// (the tariff finds options case-insensitively). Remove once every client
/// is on /api/places and /api/stays.
/// </summary>
public static class RoomsApi
{
    public static IEndpointRouteBuilder MapRoomsApi(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("api/rooms");

        api.MapGet("/", GetAllRooms).WithName("ListRooms").WithTags("Rooms")
            .WithSummary("List all rooms");
        api.MapGet("/{id:int}", GetRoomById).WithName("GetRoom").WithTags("Rooms")
            .WithSummary("Get room by ID");
        api.MapGet("/available", GetAvailableRooms).WithName("GetAvailableRooms").WithTags("Rooms")
            .WithSummary("Get available rooms");
        api.MapPost("/", CreateRoom).WithName("CreateRoom").WithTags("Rooms")
            .WithSummary("Create a new room").RequireAuthorization("Admin");
        api.MapPut("/{id:int}", UpdateRoom).WithName("UpdateRoom").WithTags("Rooms")
            .WithSummary("Update room details").RequireAuthorization("Admin");
        api.MapDelete("/{id:int}", PlacesApi.DeletePlace).WithName("DeleteRoom").WithTags("Rooms")
            .WithSummary("Delete a room").RequireAuthorization("Admin");
        api.MapPut("/{id:int}/status", UpdateRoomStatus).WithName("UpdateRoomStatus").WithTags("Rooms")
            .WithSummary("Update room physical status").RequireAuthorization("Admin");

        api.MapPost("/{roomId:int}/reserve", CreateReservation).WithName("ReserveRoom").WithTags("Reservations")
            .WithSummary("Reserve a room").RequireAuthorization();

        api.MapPost("/sessions/{sessionId:int}/start", StartSession).WithName("StartSession").WithTags("Sessions")
            .WithSummary("Start a session").RequireAuthorization("Pos");
        api.MapPost("/sessions/{sessionId:int}/confirm", ConfirmSession).WithName("ConfirmSession").WithTags("Sessions")
            .WithSummary("Confirm the customer arrived").RequireAuthorization("Pos");
        api.MapPost("/sessions/{sessionId:int}/end", EndSession).WithName("EndSession").WithTags("Sessions")
            .WithSummary("End a session").RequireAuthorization("Pos");
        api.MapPost("/sessions/{sessionId:int}/cancel", CancelSession).WithName("CancelSession").WithTags("Sessions")
            .WithSummary("Cancel a session").RequireAuthorization("Pos");
        api.MapPost("/sessions/walk-in/{roomId:int}", StartWalkInSession).WithName("StartWalkInSession").WithTags("Sessions")
            .WithSummary("Start a walk-in session").RequireAuthorization("Pos");
        api.MapPut("/sessions/{sessionId:int}/player-mode", ChangePlayerMode).WithName("ChangePlayerMode").WithTags("Sessions")
            .WithSummary("Change player mode").RequireAuthorization("Pos");
        api.MapPost("/sessions/{sessionId:int}/leave", LeaveSession).WithName("LeaveSession").WithTags("Sessions")
            .WithSummary("Leave a session").RequireAuthorization();
        api.MapPost("/sessions/my/{sessionId:int}/cancel", CancelMyReservation).WithName("CancelMyReservation").WithTags("Sessions")
            .WithSummary("Cancel my reservation").RequireAuthorization();
        api.MapGet("/sessions/my", GetMySessions).WithName("GetMySessions").WithTags("Sessions")
            .WithSummary("Get my sessions").RequireAuthorization();
        api.MapGet("/sessions/active", GetActiveSessions).WithName("GetActiveSessions").WithTags("Sessions")
            .WithSummary("Get active sessions").RequireAuthorization("Pos");
        api.MapPost("/sessions/{sessionId:int}/assign-customer", AssignCustomerToSession).WithName("AssignCustomerToSession").WithTags("Sessions")
            .WithSummary("Assign a customer to a walk-in session").RequireAuthorization("Pos");
        api.MapPost("/sessions/{sessionId:int}/members", AddMemberToSession).WithName("AddMemberToSession").WithTags("Sessions")
            .WithSummary("Add a member to a session").RequireAuthorization("Pos");
        api.MapDelete("/sessions/{sessionId:int}/members/{customerId}", RemoveMemberFromSession).WithName("RemoveMemberFromSession").WithTags("Sessions")
            .WithSummary("Remove a member from a session").RequireAuthorization("Pos");
        api.MapGet("/sessions/{sessionId:int}", GetSessionById).WithName("GetSession").WithTags("Sessions")
            .WithSummary("Get session by ID").RequireAuthorization();
        api.MapGet("/{roomId:int}/sessions/history", GetRoomSessionHistory).WithName("GetRoomSessionHistory").WithTags("Sessions")
            .WithSummary("Get room session history").RequireAuthorization("Admin");
        api.MapGet("/sessions/history", GetSessionHistory).WithName("GetSessionHistory").WithTags("Sessions")
            .WithSummary("Get session history").RequireAuthorization("Admin");
        api.MapGet("/sessions/stats", GetSessionStats).WithName("GetSessionStats").WithTags("Sessions")
            .WithSummary("Get aggregated session statistics").RequireAuthorization("Admin");
        api.MapGet("/{roomId:int}/scan", ScanRoom).WithName("ScanRoom").WithTags("Rooms")
            .WithSummary("Get room scan info").RequireAuthorization();
        api.MapPost("/sessions/join-by-room/{roomId:int}", JoinSessionByRoom).WithName("JoinSessionByRoom").WithTags("Sessions")
            .WithSummary("Join session by room").RequireAuthorization();

        return app;
    }

    public static async Task<Ok<IEnumerable<RoomViewModel>>> GetAllRooms([FromServices] IPlaceQueries queries, HttpContext httpContext)
    {
        var places = await queries.GetPlacesAsync(httpContext.GetRequiredBranchId(), PlaceKind.Room);
        return TypedResults.Ok(places.Select(p => p.ToRoom()));
    }

    public static async Task<Results<Ok<RoomViewModel>, NotFound>> GetRoomById([FromServices] IPlaceQueries queries, [Description("The room ID")] int id)
    {
        var place = await queries.GetPlaceByIdAsync(id);
        return place is null ? TypedResults.NotFound() : TypedResults.Ok(place.ToRoom());
    }

    public static async Task<Ok<IEnumerable<RoomViewModel>>> GetAvailableRooms([FromServices] IPlaceQueries queries, HttpContext httpContext)
    {
        var places = await queries.GetAvailablePlacesAsync(httpContext.GetRequiredBranchId());
        return TypedResults.Ok(places.Where(p => p.Kind == PlaceKind.Room).Select(p => p.ToRoom()));
    }

    public static async Task<Results<Created<int>, BadRequest<ProblemDetails>>> CreateRoom(
        [FromServices] IPlaceRepository places, HttpContext httpContext, CreateRoomRequest request)
    {
        try
        {
            var place = Place.Room(request.Name, request.SingleRate, request.MultiRate, httpContext.GetRequiredBranchId(), request.Description);
            places.Add(place);
            await places.UnitOfWork.SaveEntitiesAsync();
            return TypedResults.Created($"/api/rooms/{place.Id}", place.Id);
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> UpdateRoom(
        [FromServices] IPlaceRepository places, [Description("The room ID")] int id, UpdateRoomRequest request)
    {
        var place = await places.GetAsync(id);
        if (place is null) return TypedResults.NotFound();
        try
        {
            place.UpdateDetails(request.Name, request.Description);
            place.SetTariff(Tariff.Room(request.SingleRate, request.MultiRate));
            places.Update(place);
            await places.UnitOfWork.SaveEntitiesAsync();
            return TypedResults.Ok();
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> UpdateRoomStatus(
        [FromServices] IPlaceRepository places,
        [Description("The room ID")] int id,
        [Description("The new physical status")] RoomPhysicalStatus status)
        => PlacesApi.SetPlaceStatus(places, id, (PlaceStatus)(int)status);

    public static Task<Results<Created<int>, BadRequest<ProblemDetails>>> CreateReservation(
        [FromServices] IMediator mediator,
        HttpContext httpContext,
        [Description("The room ID to reserve")] int roomId,
        ReserveRoomRequest? request = null)
        => PlacesApi.HoldPlace(mediator, httpContext, roomId,
            request is null ? null : new HoldPlaceRequest(request.CustomerName, request.Notes, request.StartOnConfirm));

    public static Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> StartSession(
        [FromServices] IMediator mediator, [Description("The session ID")] int sessionId, StartSessionRequest? request = null)
        => PlacesApi.Run(mediator, new StartStayCommand(sessionId, request?.PlayerMode));

    public static Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> ConfirmSession(
        [FromServices] IMediator mediator, [Description("The session ID")] int sessionId, StartSessionRequest? request = null)
        => PlacesApi.Run(mediator, new ConfirmStayCommand(sessionId, request?.PlayerMode));

    public static Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> EndSession(
        [FromServices] IMediator mediator, [Description("The session ID")] int sessionId)
        => PlacesApi.Run(mediator, new EndStayCommand(sessionId));

    public static Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> CancelSession(
        [FromServices] IMediator mediator, [Description("The session ID")] int sessionId)
        => PlacesApi.Run(mediator, new CancelStayCommand(sessionId));

    public static async Task<Results<Created<StartWalkInSessionResult>, BadRequest<ProblemDetails>>> StartWalkInSession(
        [FromServices] IMediator mediator, [Description("The room ID")] int roomId, WalkInSessionRequest? request = null)
    {
        try
        {
            var result = await mediator.Send(new StartWalkInStayCommand(roomId, request?.Notes, request?.PlayerMode));
            return TypedResults.Created($"/api/rooms/sessions/{result.StayId}", new StartWalkInSessionResult(result.StayId));
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> ChangePlayerMode(
        [FromServices] IMediator mediator, [Description("The session ID")] int sessionId, ChangePlayerModeRequest request)
        => PlacesApi.Run(mediator, new ChangeStayOptionCommand(sessionId, request.PlayerMode));

    public static Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> LeaveSession(
        [FromServices] IMediator mediator, HttpContext httpContext, [Description("The session ID")] int sessionId)
        => PlacesApi.LeaveStay(mediator, httpContext, sessionId);

    public static Task<Results<Ok, NotFound, ForbidHttpResult, BadRequest<ProblemDetails>>> CancelMyReservation(
        [FromServices] Domain.AggregatesModel.StayAggregate.IStayRepository stays, HttpContext httpContext, [Description("The session ID")] int sessionId)
        => PlacesApi.CancelMyHold(stays, httpContext, sessionId);

    public static async Task<Ok<IEnumerable<ReservationViewModel>>> GetMySessions(
        [FromServices] IPlaceQueries queries, HttpContext httpContext, int pageIndex = 0, int pageSize = 20)
    {
        var result = await PlacesApi.GetMyStays(queries, httpContext, pageIndex, pageSize);
        return TypedResults.Ok(result.Value!.Select(s => s.ToReservation()));
    }

    public static async Task<Ok<IEnumerable<ReservationViewModel>>> GetActiveSessions([FromServices] IPlaceQueries queries, HttpContext httpContext)
    {
        var stays = await queries.GetOpenStaysAsync(httpContext.GetRequiredBranchId());
        return TypedResults.Ok(stays.Select(s => s.ToReservation()));
    }

    public static async Task<Results<Ok<ReservationViewModel>, NotFound>> GetSessionById([FromServices] IPlaceQueries queries, [Description("The session ID")] int sessionId)
    {
        var stay = await queries.GetStayByIdAsync(sessionId);
        return stay is null ? TypedResults.NotFound() : TypedResults.Ok(stay.ToReservation());
    }

    public static Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> AssignCustomerToSession(
        [FromServices] Domain.AggregatesModel.StayAggregate.IStayRepository stays, [Description("The session ID")] int sessionId, AssignCustomerRequest request)
        => PlacesApi.AssignCustomer(stays, sessionId, request);

    public static Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> AddMemberToSession(
        [FromServices] Domain.AggregatesModel.StayAggregate.IStayRepository stays, [Description("The session ID")] int sessionId, AddMemberRequest request)
        => PlacesApi.AddMember(stays, sessionId, request);

    public static Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> RemoveMemberFromSession(
        [FromServices] Domain.AggregatesModel.StayAggregate.IStayRepository stays, [Description("The session ID")] int sessionId, [Description("The customer ID to remove")] string customerId)
        => PlacesApi.RemoveMember(stays, sessionId, customerId);

    public static async Task<Results<Ok<RoomScanViewModel>, NotFound>> ScanRoom(
        [FromServices] IPlaceQueries queries, HttpContext httpContext, [Description("The room ID")] int roomId)
    {
        var scan = await queries.GetScanInfoAsync(roomId, httpContext.User.GetUserId() ?? string.Empty);
        return scan is null ? TypedResults.NotFound() : TypedResults.Ok(scan.ToRoomScan());
    }

    public static async Task<Results<Ok<JoinSessionResult>, BadRequest<ProblemDetails>>> JoinSessionByRoom(
        [FromServices] IMediator mediator, HttpContext httpContext, [Description("The room ID")] int roomId)
    {
        var result = await PlacesApi.JoinStay(mediator, httpContext, roomId);
        return result.Result switch
        {
            Ok<JoinStayResult> ok => TypedResults.Ok(new JoinSessionResult(ok.Value!.StayId, ok.Value.PlaceId, ok.Value.PlaceName, ok.Value.IsOwner, ok.Value.StartTime)),
            BadRequest<ProblemDetails> bad => bad,
            _ => TypedResults.BadRequest<ProblemDetails>(new() { Detail = "Could not join" }),
        };
    }

    public static async Task<Ok<IEnumerable<ReservationViewModel>>> GetRoomSessionHistory(
        [FromServices] IPlaceQueries queries, [Description("The room ID")] int roomId, [Description("Maximum number of sessions to return")] int limit = 20)
    {
        var stays = await queries.GetPlaceStayHistoryAsync(roomId, limit);
        return TypedResults.Ok(stays.Select(s => s.ToReservation()));
    }

    public static async Task<Ok<PaginatedResult<ReservationViewModel>>> GetSessionHistory(
        [FromServices] IPlaceQueries queries, HttpContext httpContext,
        int pageIndex = 0, int pageSize = 20, [Description("Filter by room")] int? roomId = null, DateTime? fromDate = null, DateTime? toDate = null)
    {
        var page = await queries.GetStayHistoryAsync(httpContext.GetRequiredBranchId(), pageIndex, pageSize, roomId, fromDate, toDate);
        return TypedResults.Ok(new PaginatedResult<ReservationViewModel>
        {
            Items = page.Items.Select(s => s.ToReservation()).ToList(),
            PageIndex = page.PageIndex,
            PageSize = page.PageSize,
            TotalCount = page.TotalCount,
        });
    }

    public static async Task<Ok<SessionStats>> GetSessionStats(
        [FromServices] IPlaceQueries queries, HttpContext httpContext, DateTime fromDate, DateTime toDate,
        [Description("JS getTimezoneOffset() of the caller, for local-day bucketing")] int tzOffsetMinutes = 0)
    {
        var stats = await queries.GetStayStatsAsync(httpContext.GetRequiredBranchId(), fromDate, toDate, tzOffsetMinutes);
        return TypedResults.Ok(stats.ToLegacy());
    }
}

/// <summary>The old status words; same numbers as <see cref="PlaceStatus"/>.</summary>
public enum RoomPhysicalStatus
{
    Available = 1,
    Occupied = 2,
    Maintenance = 3,
}

public record ReserveRoomRequest(string? CustomerName = null, string? Notes = null, bool StartOnConfirm = false);

public record WalkInSessionRequest(string? Notes = null, string? PlayerMode = null);

public record StartWalkInSessionResult(int ReservationId);

public record StartSessionRequest(string? PlayerMode = null);

public record ChangePlayerModeRequest(string PlayerMode);

public record JoinSessionResult(int ReservationId, int RoomId, LocalizedText RoomName, bool IsOwner, DateTime StartTime);

public record CreateRoomRequest(LocalizedText Name, LocalizedText? Description, decimal SingleRate, decimal MultiRate);

public record UpdateRoomRequest(LocalizedText Name, LocalizedText? Description, decimal SingleRate, decimal MultiRate);
