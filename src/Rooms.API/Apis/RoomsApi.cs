using System.ComponentModel;
using Chillax.Rooms.API.Application.Commands;
using Chillax.Rooms.API.Application.Queries;
using Chillax.Rooms.Domain.AggregatesModel.ReservationAggregate;
using Chillax.Rooms.Domain.AggregatesModel.RoomAggregate;
using Chillax.Rooms.Domain.Exceptions;
using Chillax.Rooms.Domain.SeedWork;
using Chillax.ServiceDefaults;
using Room = Chillax.Rooms.Domain.AggregatesModel.RoomAggregate.Room;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RoomsContext = Chillax.Rooms.Infrastructure.RoomsContext;

namespace Chillax.Rooms.API.Apis;

public static class RoomsApi
{
    public static IEndpointRouteBuilder MapRoomsApi(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("api/rooms");

        // Room endpoints (queries)
        api.MapGet("/", GetAllRooms)
            .WithName("ListRooms")
            .WithSummary("List all rooms")
            .WithDescription("Get all PlayStation rooms with their current display status")
            .WithTags("Rooms");

        api.MapGet("/{id:int}", GetRoomById)
            .WithName("GetRoom")
            .WithSummary("Get room by ID")
            .WithDescription("Get a specific room by its ID")
            .WithTags("Rooms");

        api.MapGet("/available", GetAvailableRooms)
            .WithName("GetAvailableRooms")
            .WithSummary("Get available rooms")
            .WithDescription("Get only rooms that are currently available for reservation")
            .WithTags("Rooms");

        // Admin room management
        api.MapPost("/", CreateRoom)
            .WithName("CreateRoom")
            .WithSummary("Create a new room")
            .WithDescription("Create a new PlayStation room (Admin only)")
            .WithTags("Rooms")
            .RequireAuthorization("Admin");

        api.MapPut("/{id:int}", UpdateRoom)
            .WithName("UpdateRoom")
            .WithSummary("Update room details")
            .WithDescription("Update room name, description, and rates (Admin only)")
            .WithTags("Rooms")
            .RequireAuthorization("Admin");

        api.MapDelete("/{id:int}", DeleteRoom)
            .WithName("DeleteRoom")
            .WithSummary("Delete a room")
            .WithDescription("Delete a room (Admin only)")
            .WithTags("Rooms")
            .RequireAuthorization("Admin");

        api.MapPut("/{id:int}/status", UpdateRoomStatus)
            .WithName("UpdateRoomStatus")
            .WithSummary("Update room physical status")
            .WithDescription("Update the physical status of a room (Admin only)")
            .WithTags("Rooms")
            .RequireAuthorization("Admin");

        // Reservation endpoints (commands)
        api.MapPost("/{roomId:int}/reserve", CreateReservation)
            .WithName("ReserveRoom")
            .WithSummary("Reserve a room")
            .WithDescription("Create an immediate reservation for a room. Customer has 15 minutes to arrive before auto-cancellation.")
            .WithTags("Reservations")
            .RequireAuthorization();

        // Session endpoints (Admin commands)
        api.MapPost("/sessions/{sessionId:int}/start", StartSession)
            .WithName("StartSession")
            .WithSummary("Start a session")
            .WithDescription("Start the timer for a reserved session (Admin only)")
            .WithTags("Sessions")
            .RequireAuthorization("Admin");

        api.MapPost("/sessions/{sessionId:int}/end", EndSession)
            .WithName("EndSession")
            .WithSummary("End a session")
            .WithDescription("End the session and calculate cost (Admin only)")
            .WithTags("Sessions")
            .RequireAuthorization("Admin");

        api.MapPost("/sessions/{sessionId:int}/cancel", CancelSession)
            .WithName("CancelSession")
            .WithSummary("Cancel a session")
            .WithDescription("Cancel a reservation or active session (Admin only)")
            .WithTags("Sessions")
            .RequireAuthorization("Admin");

        // Walk-in session endpoints (Admin)
        api.MapPost("/sessions/walk-in/{roomId:int}", StartWalkInSession)
            .WithName("StartWalkInSession")
            .WithSummary("Start a walk-in session")
            .WithDescription("Start a walk-in session without an assigned customer (Admin only)")
            .WithTags("Sessions")
            .RequireAuthorization("Admin");

        // Player mode change (Admin)
        api.MapPut("/sessions/{sessionId:int}/player-mode", ChangePlayerMode)
            .WithName("ChangePlayerMode")
            .WithSummary("Change player mode")
            .WithDescription("Change the player mode (Single/Multi) for an active session (Admin only)")
            .WithTags("Sessions")
            .RequireAuthorization("Admin");

        // Session membership endpoints (Customer)
        api.MapPost("/sessions/{sessionId:int}/leave", LeaveSession)
            .WithName("LeaveSession")
            .WithSummary("Leave a session")
            .WithDescription("Leave a session you've joined (cannot leave if you're the owner)")
            .WithTags("Sessions")
            .RequireAuthorization();

        api.MapPost("/sessions/my/{sessionId:int}/cancel", CancelMyReservation)
            .WithName("CancelMyReservation")
            .WithSummary("Cancel my reservation")
            .WithDescription("Cancel your own reservation (only if still in Reserved status)")
            .WithTags("Sessions")
            .RequireAuthorization();

        // Session query endpoints
        api.MapGet("/sessions/my", GetMySessions)
            .WithName("GetMySessions")
            .WithSummary("Get my sessions")
            .WithDescription("Get all sessions for the current authenticated user")
            .WithTags("Sessions")
            .RequireAuthorization();

        api.MapGet("/sessions/active", GetActiveSessions)
            .WithName("GetActiveSessions")
            .WithSummary("Get active sessions")
            .WithDescription("Get all currently active sessions (Admin only)")
            .WithTags("Sessions")
            .RequireAuthorization("Admin");

        api.MapPost("/sessions/{sessionId:int}/assign-customer", AssignCustomerToSession)
            .WithName("AssignCustomerToSession")
            .WithSummary("Assign a customer to a walk-in session")
            .WithDescription("Assign a customer to an active walk-in session that has no owner (Admin only)")
            .WithTags("Sessions")
            .RequireAuthorization("Admin");

        api.MapPost("/sessions/{sessionId:int}/members", AddMemberToSession)
            .WithName("AddMemberToSession")
            .WithSummary("Add a member to a session")
            .WithDescription("Add a customer as a member to an active session (Admin only)")
            .WithTags("Sessions")
            .RequireAuthorization("Admin");

        api.MapDelete("/sessions/{sessionId:int}/members/{customerId}", RemoveMemberFromSession)
            .WithName("RemoveMemberFromSession")
            .WithSummary("Remove a member from a session")
            .WithDescription("Remove a non-owner member from an active session (Admin only)")
            .WithTags("Sessions")
            .RequireAuthorization("Admin");

        api.MapGet("/sessions/{sessionId:int}", GetSessionById)
            .WithName("GetSession")
            .WithSummary("Get session by ID")
            .WithDescription("Get a specific session by its ID")
            .WithTags("Sessions")
            .RequireAuthorization();

        api.MapGet("/{roomId:int}/sessions/history", GetRoomSessionHistory)
            .WithName("GetRoomSessionHistory")
            .WithSummary("Get room session history")
            .WithDescription("Get completed sessions history for a specific room (Admin only)")
            .WithTags("Sessions")
            .RequireAuthorization("Admin");

        api.MapGet("/sessions/history", GetSessionHistory)
            .WithName("GetSessionHistory")
            .WithSummary("Get session history")
            .WithDescription("Get completed/cancelled sessions across all rooms, paginated (Admin only)")
            .WithTags("Sessions")
            .RequireAuthorization("Admin");

        // QR scan endpoints
        api.MapGet("/{roomId:int}/scan", ScanRoom)
            .WithName("ScanRoom")
            .WithSummary("Get room scan info")
            .WithDescription("Get room info and active session status for QR code scan-to-join")
            .WithTags("Rooms")
            .RequireAuthorization();

        api.MapPost("/sessions/join-by-room/{roomId:int}", JoinSessionByRoom)
            .WithName("JoinSessionByRoom")
            .WithSummary("Join session by room")
            .WithDescription("Join the active session of a room (via QR scan)")
            .WithTags("Sessions")
            .RequireAuthorization();

        return app;
    }

    // Query endpoints
    public static async Task<Ok<IEnumerable<RoomViewModel>>> GetAllRooms(
        [FromServices] IRoomQueries queries,
        HttpContext httpContext)
    {
        var branchId = httpContext.GetRequiredBranchId();
        var rooms = await queries.GetAllRoomsAsync(branchId);
        return TypedResults.Ok(rooms);
    }

    public static async Task<Results<Ok<RoomViewModel>, NotFound>> GetRoomById(
        [FromServices] IRoomQueries queries,
        [Description("The room ID")] int id)
    {
        var room = await queries.GetRoomByIdAsync(id);

        if (room == null)
        {
            return TypedResults.NotFound();
        }

        return TypedResults.Ok(room);
    }

    public static async Task<Ok<IEnumerable<RoomViewModel>>> GetAvailableRooms(
        [FromServices] IRoomQueries queries,
        HttpContext httpContext)
    {
        var branchId = httpContext.GetRequiredBranchId();
        var rooms = await queries.GetAvailableRoomsAsync(branchId);
        return TypedResults.Ok(rooms);
    }

    public static async Task<Created<int>> CreateRoom(
        RoomsContext context,
        HttpContext httpContext,
        CreateRoomRequest request)
    {
        var branchId = httpContext.GetRequiredBranchId();
        var room = new Room(request.Name, request.SingleRate, request.MultiRate, branchId, request.Description);
        context.Rooms.Add(room);
        await context.SaveChangesAsync();
        return TypedResults.Created($"/api/rooms/{room.Id}", room.Id);
    }

    public static async Task<Results<Ok, NotFound>> UpdateRoom(
        RoomsContext context,
        [Description("The room ID")] int id,
        UpdateRoomRequest request)
    {
        var room = await context.Rooms.FindAsync(id);
        if (room == null)
        {
            return TypedResults.NotFound();
        }

        room.UpdateDetails(request.Name, request.Description, request.SingleRate, request.MultiRate);
        await context.SaveChangesAsync();
        return TypedResults.Ok();
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> DeleteRoom(
        RoomsContext context,
        [Description("The room ID")] int id)
    {
        var room = await context.Rooms.FindAsync(id);
        if (room == null)
        {
            return TypedResults.NotFound();
        }

        // Check if room has active sessions
        var hasActiveSessions = await context.Reservations
            .AnyAsync(r => r.RoomId == id && (r.Status == ReservationStatus.Active || r.Status == ReservationStatus.Reserved));

        if (hasActiveSessions)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "Cannot delete room with active sessions" });
        }

        context.Rooms.Remove(room);
        await context.SaveChangesAsync();
        return TypedResults.Ok();
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> UpdateRoomStatus(
        RoomsContext context,
        [Description("The room ID")] int id,
        [Description("The new physical status")] RoomPhysicalStatus status)
    {
        var room = await context.Rooms.FindAsync(id);

        if (room == null)
        {
            return TypedResults.NotFound();
        }

        try
        {
            switch (status)
            {
                case RoomPhysicalStatus.Available:
                    room.SetAvailable();
                    break;
                case RoomPhysicalStatus.Occupied:
                    room.SetOccupied();
                    break;
                case RoomPhysicalStatus.Maintenance:
                    room.SetMaintenance();
                    break;
            }
            await context.SaveChangesAsync();
            return TypedResults.Ok();
        }
        catch (RoomsDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    // Command endpoints
    public static async Task<Results<Created<int>, BadRequest<ProblemDetails>>> CreateReservation(
        [FromServices] IMediator mediator,
        [FromServices] ILoggerFactory loggerFactory,
        HttpContext httpContext,
        [Description("The room ID to reserve")] int roomId,
        ReserveRoomRequest? request = null)
    {
        var logger = loggerFactory.CreateLogger("RoomsApi");

        var customerId = httpContext.User.GetUserId();
        if (string.IsNullOrEmpty(customerId))
        {
            return TypedResults.BadRequest<ProblemDetails>(new()
            {
                Detail = "User ID not found in token"
            });
        }

        var customerName = httpContext.User.GetUserName() ?? request?.CustomerName;
        var roles = httpContext.User.GetRoles().ToList();
        var isAdmin = roles.Contains("Admin", StringComparer.OrdinalIgnoreCase);

        logger.LogInformation("CreateReservation API: CustomerId={CustomerId}, Roles=[{Roles}], IsAdmin={IsAdmin}",
            customerId, string.Join(", ", roles), isAdmin);

        try
        {
            var command = new CreateReservationCommand(
                roomId,
                isAdmin ? null : customerId,
                isAdmin ? null : customerName,
                request?.Notes,
                isAdmin);

            var reservationId = await mediator.Send(command);
            return TypedResults.Created($"/api/rooms/sessions/{reservationId}", reservationId);
        }
        catch (RoomsDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> StartSession(
        [FromServices] IMediator mediator,
        [Description("The session ID")] int sessionId,
        StartSessionRequest? request = null)
    {
        try
        {
            var initialMode = PlayerMode.Single;
            if (request?.PlayerMode != null && Enum.TryParse<PlayerMode>(request.PlayerMode, ignoreCase: true, out var parsed))
                initialMode = parsed;

            var command = new StartSessionCommand(sessionId, initialMode);
            var result = await mediator.Send(command);
            return result ? TypedResults.Ok() : TypedResults.NotFound();
        }
        catch (RoomsDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> EndSession(
        [FromServices] IMediator mediator,
        [Description("The session ID")] int sessionId)
    {
        try
        {
            var command = new EndSessionCommand(sessionId);
            var result = await mediator.Send(command);
            return result ? TypedResults.Ok() : TypedResults.NotFound();
        }
        catch (RoomsDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> CancelSession(
        [FromServices] IMediator mediator,
        [Description("The session ID")] int sessionId)
    {
        try
        {
            var command = new CancelReservationCommand(sessionId);
            var result = await mediator.Send(command);
            return result ? TypedResults.Ok() : TypedResults.NotFound();
        }
        catch (RoomsDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok, NotFound, ForbidHttpResult, BadRequest<ProblemDetails>>> CancelMyReservation(
        [FromServices] IReservationRepository reservationRepository,
        [FromServices] IRoomRepository roomRepository,
        HttpContext httpContext,
        [Description("The session ID")] int sessionId)
    {
        var customerId = httpContext.User.GetUserId();
        if (string.IsNullOrEmpty(customerId))
            return TypedResults.Forbid();

        try
        {
            var reservation = await reservationRepository.GetWithRoomAsync(sessionId);
            if (reservation == null)
                return TypedResults.NotFound();

            // Verify the customer owns this reservation
            if (reservation.CustomerId != customerId)
                return TypedResults.Forbid();

            // Only allow cancelling reservations that are still in Reserved status
            if (reservation.Status != ReservationStatus.Reserved)
                return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "Can only cancel reservations that are still pending. Active sessions cannot be cancelled by customers." });

            reservation.Cancel();
            reservationRepository.Update(reservation);
            await reservationRepository.UnitOfWork.SaveEntitiesAsync();

            return TypedResults.Ok();
        }
        catch (RoomsDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Ok<IEnumerable<ReservationViewModel>>> GetMySessions(
        [FromServices] IRoomQueries queries,
        HttpContext httpContext)
    {
        var customerId = httpContext.User.GetUserId();
        var sessions = await queries.GetCustomerReservationsAsync(customerId ?? string.Empty);
        return TypedResults.Ok(sessions);
    }

    public static async Task<Ok<IEnumerable<ReservationViewModel>>> GetActiveSessions(
        [FromServices] IRoomQueries queries,
        HttpContext httpContext)
    {
        var branchId = httpContext.GetRequiredBranchId();
        var sessions = await queries.GetActiveSessionsAsync(branchId);
        return TypedResults.Ok(sessions);
    }

    public static async Task<Results<Ok<ReservationViewModel>, NotFound>> GetSessionById(
        [FromServices] IRoomQueries queries,
        [Description("The session ID")] int sessionId)
    {
        var session = await queries.GetReservationByIdAsync(sessionId);

        if (session == null)
        {
            return TypedResults.NotFound();
        }

        return TypedResults.Ok(session);
    }

    public static async Task<Results<Created<StartWalkInSessionResult>, BadRequest<ProblemDetails>>> StartWalkInSession(
        [FromServices] IMediator mediator,
        [Description("The room ID")] int roomId,
        WalkInSessionRequest? request = null)
    {
        try
        {
            var initialMode = PlayerMode.Single;
            if (request?.PlayerMode != null && Enum.TryParse<PlayerMode>(request.PlayerMode, ignoreCase: true, out var parsed))
                initialMode = parsed;
            var command = new StartWalkInSessionCommand(roomId, request?.Notes, initialMode);
            var result = await mediator.Send(command);
            return TypedResults.Created($"/api/rooms/sessions/{result.ReservationId}", result);
        }
        catch (RoomsDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> ChangePlayerMode(
        [FromServices] IMediator mediator,
        [Description("The session ID")] int sessionId,
        ChangePlayerModeRequest request)
    {
        try
        {
            if (!Enum.TryParse<PlayerMode>(request.PlayerMode, ignoreCase: true, out var playerMode))
                return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "Invalid player mode. Use 'Single' or 'Multi'." });

            var command = new ChangePlayerModeCommand(sessionId, playerMode);
            var result = await mediator.Send(command);
            return result ? TypedResults.Ok() : TypedResults.NotFound();
        }
        catch (RoomsDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> LeaveSession(
        [FromServices] IMediator mediator,
        HttpContext httpContext,
        [Description("The session ID")] int sessionId)
    {
        var customerId = httpContext.User.GetUserId();
        if (string.IsNullOrEmpty(customerId))
        {
            return TypedResults.BadRequest<ProblemDetails>(new()
            {
                Detail = "User ID not found in token"
            });
        }

        try
        {
            var command = new LeaveSessionCommand(sessionId, customerId);
            var result = await mediator.Send(command);
            return result ? TypedResults.Ok() : TypedResults.NotFound();
        }
        catch (RoomsDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> AssignCustomerToSession(
        [FromServices] IReservationRepository reservationRepository,
        [Description("The session ID")] int sessionId,
        AssignCustomerRequest request)
    {
        try
        {
            var reservation = await reservationRepository.GetAsync(sessionId);
            if (reservation == null)
                return TypedResults.NotFound();

            reservation.AssignCustomer(request.CustomerId, request.CustomerName);
            reservationRepository.Update(reservation);
            await reservationRepository.UnitOfWork.SaveEntitiesAsync();

            return TypedResults.Ok();
        }
        catch (RoomsDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> AddMemberToSession(
        [FromServices] IReservationRepository reservationRepository,
        [Description("The session ID")] int sessionId,
        AddMemberRequest request)
    {
        try
        {
            var reservation = await reservationRepository.GetWithMembersAsync(sessionId);
            if (reservation == null)
                return TypedResults.NotFound();

            reservation.AddMember(request.CustomerId, request.CustomerName);
            reservationRepository.Update(reservation);
            await reservationRepository.UnitOfWork.SaveEntitiesAsync();

            return TypedResults.Ok();
        }
        catch (RoomsDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> RemoveMemberFromSession(
        [FromServices] IReservationRepository reservationRepository,
        [Description("The session ID")] int sessionId,
        [Description("The customer ID to remove")] string customerId)
    {
        try
        {
            var reservation = await reservationRepository.GetWithMembersAsync(sessionId);
            if (reservation == null)
                return TypedResults.NotFound();

            reservation.RemoveMember(customerId);
            reservationRepository.Update(reservation);
            await reservationRepository.UnitOfWork.SaveEntitiesAsync();

            return TypedResults.Ok();
        }
        catch (RoomsDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok<RoomScanViewModel>, NotFound>> ScanRoom(
        [FromServices] IRoomQueries queries,
        HttpContext httpContext,
        [Description("The room ID")] int roomId)
    {
        var customerId = httpContext.User.GetUserId() ?? string.Empty;
        var result = await queries.GetRoomScanInfoAsync(roomId, customerId);

        if (result == null)
        {
            return TypedResults.NotFound();
        }

        return TypedResults.Ok(result);
    }

    public static async Task<Results<Ok<JoinSessionResult>, BadRequest<ProblemDetails>>> JoinSessionByRoom(
        [FromServices] IMediator mediator,
        HttpContext httpContext,
        [Description("The room ID")] int roomId)
    {
        var customerId = httpContext.User.GetUserId();
        if (string.IsNullOrEmpty(customerId))
        {
            return TypedResults.BadRequest<ProblemDetails>(new()
            {
                Detail = "User ID not found in token"
            });
        }

        var customerName = httpContext.User.GetUserName();

        try
        {
            var command = new JoinSessionByRoomCommand(roomId, customerId, customerName);
            var result = await mediator.Send(command);
            return TypedResults.Ok(result);
        }
        catch (RoomsDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Ok<IEnumerable<ReservationViewModel>>> GetRoomSessionHistory(
        [FromServices] IRoomQueries queries,
        [Description("The room ID")] int roomId,
        [Description("Maximum number of sessions to return")] int limit = 20)
    {
        var sessions = await queries.GetRoomSessionHistoryAsync(roomId, limit);
        return TypedResults.Ok(sessions);
    }

    public static async Task<Ok<PaginatedResult<ReservationViewModel>>> GetSessionHistory(
        [FromServices] IRoomQueries queries,
        HttpContext httpContext,
        int pageIndex = 0,
        int pageSize = 20,
        [Description("Filter by room")] int? roomId = null,
        DateTime? fromDate = null,
        DateTime? toDate = null)
    {
        var branchId = httpContext.GetRequiredBranchId();
        var sessions = await queries.GetSessionHistoryAsync(
            branchId, pageIndex, pageSize, roomId, fromDate, toDate);
        return TypedResults.Ok(sessions);
    }
}

public record ReserveRoomRequest(
    string? CustomerName = null,
    string? Notes = null
);

public record WalkInSessionRequest(
    string? Notes = null,
    string? PlayerMode = null);

public record AssignCustomerRequest(string CustomerId, string? CustomerName);

public record AddMemberRequest(string CustomerId, string? CustomerName);

public record StartSessionRequest(string? PlayerMode = null);

public record ChangePlayerModeRequest(string PlayerMode);

public record CreateRoomRequest(
    LocalizedText Name,
    LocalizedText? Description,
    decimal SingleRate,
    decimal MultiRate);

public record UpdateRoomRequest(
    LocalizedText Name,
    LocalizedText? Description,
    decimal SingleRate,
    decimal MultiRate);
