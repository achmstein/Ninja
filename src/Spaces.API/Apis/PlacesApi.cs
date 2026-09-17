using System.ComponentModel;
using Chillax.EventBus.Abstractions;
using Chillax.Spaces.API.Application.Commands;
using Chillax.Spaces.API.Application.DomainEventHandlers;
using Chillax.Spaces.API.Application.Queries;
using Chillax.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Chillax.Spaces.Domain.AggregatesModel.StayAggregate;
using Chillax.Spaces.Domain.Exceptions;
using Chillax.Spaces.Domain.SeedWork;
using Chillax.ServiceDefaults;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Chillax.Spaces.API.Apis;

/// <summary>
/// Places (rooms, tables, stations) and the stays on them. Place set-up is
/// Admin; running the floor (start, end, cancel, walk-in, option, members)
/// is whoever is at the counter — the "Pos" policy; holds, joining, leaving
/// and "my stays" are any signed-in customer. Reading a place is anonymous:
/// the QR landing page is reachable before sign-in.
/// </summary>
public static class PlacesApi
{
    public static IEndpointRouteBuilder MapPlacesApi(this IEndpointRouteBuilder app)
    {
        var places = app.MapGroup("api/places").WithTags("Places");

        places.MapGet("/", GetPlaces).WithName("ListPlaces")
            .WithSummary("List places")
            .WithDescription("Every place of the branch with its status; narrow by kind or to timed places");
        places.MapGet("/available", GetAvailablePlaces).WithName("GetAvailablePlaces")
            .WithSummary("Places a customer can book now");
        places.MapGet("/{id:int}", GetPlaceById).WithName("GetPlace")
            .WithSummary("Get a place")
            .WithDescription("What a scanned place QR resolves to");
        places.MapPost("/", CreatePlace).WithName("CreatePlace")
            .WithSummary("Create a place (Admin)")
            .RequireAuthorization("Admin");
        places.MapPut("/{id:int}", UpdatePlace).WithName("UpdatePlace")
            .WithSummary("Rename a place or change its description (Admin)")
            .RequireAuthorization("Admin");
        places.MapPut("/{id:int}/tariff", SetPlaceTariff).WithName("SetPlaceTariff")
            .WithSummary("Give a place a tariff, change it, or take it away (Admin)")
            .WithDescription("A place with a tariff is timed and can be reserved; without one it only takes orders. Refused while a stay runs there.")
            .RequireAuthorization("Admin");
        places.MapPut("/{id:int}/active", SetPlaceActive).WithName("SetPlaceActive")
            .WithSummary("Activate or deactivate a place (Admin)")
            .WithDescription("Deactivating keeps the place and its printed QR but stops customers ordering to it or holding it")
            .RequireAuthorization("Admin");
        places.MapPut("/{id:int}/status", SetPlaceStatus).WithName("SetPlaceStatus")
            .WithSummary("Set a place's physical status (Admin)")
            .RequireAuthorization("Admin");
        places.MapDelete("/{id:int}", DeletePlace).WithName("DeletePlace")
            .WithSummary("Delete a place (Admin)")
            .WithDescription("Its printed QR stops working — prefer deactivating. Refused while a stay is held or running there.")
            .RequireAuthorization("Admin");

        places.MapGet("/{id:int}/scan", ScanPlace).WithName("ScanPlace")
            .WithSummary("What this customer sees after scanning the place's QR")
            .RequireAuthorization();
        places.MapPost("/{id:int}/hold", HoldPlace).WithName("HoldPlace")
            .WithSummary("Hold a timed place")
            .WithDescription("The customer has 10 minutes to arrive. With startOnConfirm the clock starts the moment the till confirms.")
            .RequireAuthorization();
        places.MapPost("/{id:int}/walk-in", StartWalkIn).WithName("StartWalkIn")
            .WithSummary("Start the clock for a party that walked in (staff)")
            .RequireAuthorization("Pos");
        places.MapPost("/{id:int}/join", JoinStay).WithName("JoinStay")
            .WithSummary("Join the stay running at a place (QR scan)")
            .RequireAuthorization();
        places.MapGet("/{id:int}/stays", GetPlaceStayHistory).WithName("GetPlaceStayHistory")
            .WithSummary("Ended and cancelled stays at a place (Admin)")
            .RequireAuthorization("Admin");

        var stays = app.MapGroup("api/stays").WithTags("Stays");

        stays.MapGet("/my", GetMyStays).WithName("GetMyStays")
            .WithSummary("The signed-in customer's stays, newest first")
            .RequireAuthorization();
        stays.MapGet("/open", GetOpenStays).WithName("GetOpenStays")
            .WithSummary("Held and running stays of the branch (staff)")
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

        stays.MapPost("/{id:int}/confirm", ConfirmStay).WithName("ConfirmStay")
            .WithSummary("The customer arrived (staff)")
            .WithDescription("Starts the clock when the hold asked for start-on-confirm; otherwise the hold waits for Start")
            .RequireAuthorization("Pos");
        stays.MapPost("/{id:int}/start", StartStay).WithName("StartStay")
            .WithSummary("Start the clock on a held stay (staff)")
            .RequireAuthorization("Pos");
        stays.MapPost("/{id:int}/end", EndStay).WithName("EndStay")
            .WithSummary("Stop the clock and settle the cost (staff)")
            .RequireAuthorization("Pos");
        stays.MapPost("/{id:int}/cancel", CancelStay).WithName("CancelStay")
            .WithSummary("Give up a hold or cut a running stay short (staff)")
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
        stays.MapPost("/my/{id:int}/cancel", CancelMyHold).WithName("CancelMyHold")
            .WithSummary("Give up your own hold before it starts")
            .RequireAuthorization();

        return app;
    }

    // ---- places

    public static async Task<Ok<IEnumerable<PlaceViewModel>>> GetPlaces(
        [FromServices] IPlaceQueries queries,
        HttpContext httpContext,
        [Description("Only places of this kind")] PlaceKind? kind = null,
        [Description("Only timed (true) or order-only (false) places")] bool? timed = null)
    {
        var branchId = httpContext.GetRequiredBranchId();
        return TypedResults.Ok(await queries.GetPlacesAsync(branchId, kind, timed));
    }

    public static async Task<Ok<IEnumerable<PlaceViewModel>>> GetAvailablePlaces(
        [FromServices] IPlaceQueries queries,
        HttpContext httpContext)
    {
        var branchId = httpContext.GetRequiredBranchId();
        return TypedResults.Ok(await queries.GetAvailablePlacesAsync(branchId));
    }

    public static async Task<Results<Ok<PlaceViewModel>, NotFound>> GetPlaceById(
        [FromServices] IPlaceQueries queries,
        [Description("The place ID")] int id)
    {
        var place = await queries.GetPlaceByIdAsync(id);
        return place is null ? TypedResults.NotFound() : TypedResults.Ok(place);
    }

    public static async Task<Results<Created<int>, BadRequest<ProblemDetails>>> CreatePlace(
        [FromServices] IPlaceRepository places,
        HttpContext httpContext,
        CreatePlaceRequest request)
    {
        var branchId = httpContext.GetRequiredBranchId();
        try
        {
            var place = new Place(request.Kind, request.Name, branchId, request.Tariff?.ToTariff(), request.Description);
            places.Add(place);
            await places.UnitOfWork.SaveEntitiesAsync();
            return TypedResults.Created($"/api/places/{place.Id}", place.Id);
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> UpdatePlace(
        [FromServices] IPlaceRepository places,
        [Description("The place ID")] int id,
        UpdatePlaceRequest request)
    {
        var place = await places.GetAsync(id);
        if (place is null) return TypedResults.NotFound();
        try
        {
            place.UpdateDetails(request.Name, request.Description);
            places.Update(place);
            await places.UnitOfWork.SaveEntitiesAsync();
            return TypedResults.Ok();
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> SetPlaceTariff(
        [FromServices] IPlaceRepository places,
        [FromServices] IStayRepository stays,
        [Description("The place ID")] int id,
        SetPlaceTariffRequest request)
    {
        var place = await places.GetAsync(id);
        if (place is null) return TypedResults.NotFound();
        try
        {
            if (request.Tariff is null && await stays.HasOpenStayAsync(id))
                throw new SpacesDomainException("End or cancel the stay at this place before removing its tariff");
            place.SetTariff(request.Tariff?.ToTariff());
            places.Update(place);
            await places.UnitOfWork.SaveEntitiesAsync();
            return TypedResults.Ok();
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok, NotFound>> SetPlaceActive(
        [FromServices] IPlaceRepository places,
        [Description("The place ID")] int id,
        SetPlaceActiveRequest request)
    {
        var place = await places.GetAsync(id);
        if (place is null) return TypedResults.NotFound();
        place.SetActive(request.IsActive);
        places.Update(place);
        await places.UnitOfWork.SaveEntitiesAsync();
        return TypedResults.Ok();
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> SetPlaceStatus(
        [FromServices] IPlaceRepository places,
        [Description("The place ID")] int id,
        [Description("The new physical status")] PlaceStatus status)
    {
        var place = await places.GetAsync(id);
        if (place is null) return TypedResults.NotFound();
        try
        {
            switch (status)
            {
                case PlaceStatus.Available: place.SetAvailable(); break;
                case PlaceStatus.Occupied: place.SetOccupied(); break;
                case PlaceStatus.OutOfService: place.SetOutOfService(); break;
            }
            places.Update(place);
            await places.UnitOfWork.SaveEntitiesAsync();
            return TypedResults.Ok();
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> DeletePlace(
        [FromServices] IPlaceRepository places,
        [FromServices] IStayRepository stays,
        [FromServices] IEventBus eventBus,
        [Description("The place ID")] int id)
    {
        var place = await places.GetAsync(id);
        if (place is null) return TypedResults.NotFound();

        if (await stays.HasOpenStayAsync(id))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "Cannot delete a place with a held or running stay" });

        var gone = place.ToUpdatedEvent(deleted: true);
        places.Delete(place);
        await places.UnitOfWork.SaveEntitiesAsync();
        await eventBus.PublishAsync(gone);
        return TypedResults.Ok();
    }

    public static async Task<Results<Ok<PlaceScanViewModel>, NotFound>> ScanPlace(
        [FromServices] IPlaceQueries queries,
        HttpContext httpContext,
        [Description("The place ID")] int id)
    {
        var customerId = httpContext.User.GetUserId() ?? string.Empty;
        var scan = await queries.GetScanInfoAsync(id, customerId);
        return scan is null ? TypedResults.NotFound() : TypedResults.Ok(scan);
    }

    public static async Task<Results<Created<int>, BadRequest<ProblemDetails>>> HoldPlace(
        [FromServices] IMediator mediator,
        HttpContext httpContext,
        [Description("The place ID")] int id,
        HoldPlaceRequest? request = null)
    {
        var customerId = httpContext.User.GetUserId();
        if (string.IsNullOrEmpty(customerId))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "User ID not found in token" });

        var roles = httpContext.User.GetRoles().ToList();
        var isStaff = roles.Contains("Admin", StringComparer.OrdinalIgnoreCase)
            || roles.Contains("Owner", StringComparer.OrdinalIgnoreCase)
            || roles.Contains("Cashier", StringComparer.OrdinalIgnoreCase);

        try
        {
            // A staff hold is for a walk-in: the typed name is the customer,
            // and it is not tied to the cashier's own account. A customer
            // holding for themselves keeps their id and name.
            var stayId = await mediator.Send(new HoldPlaceCommand(
                id,
                isStaff ? null : customerId,
                isStaff ? request?.CustomerName : httpContext.User.GetUserName() ?? request?.CustomerName,
                request?.Notes,
                request?.StartOnConfirm ?? false,
                isStaff,
                request?.OptionCode));
            return TypedResults.Created($"/api/stays/{stayId}", stayId);
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Created<StartWalkInStayResult>, BadRequest<ProblemDetails>>> StartWalkIn(
        [FromServices] IMediator mediator,
        [Description("The place ID")] int id,
        WalkInStayRequest? request = null)
    {
        try
        {
            var result = await mediator.Send(new StartWalkInStayCommand(
                id, request?.Notes, request?.OptionCode, request?.CustomerId, request?.CustomerName));
            return TypedResults.Created($"/api/stays/{result.StayId}", result);
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok<JoinStayResult>, BadRequest<ProblemDetails>>> JoinStay(
        [FromServices] IMediator mediator,
        HttpContext httpContext,
        [Description("The place ID")] int id)
    {
        var customerId = httpContext.User.GetUserId();
        if (string.IsNullOrEmpty(customerId))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "User ID not found in token" });
        try
        {
            var result = await mediator.Send(new JoinStayByPlaceCommand(id, customerId, httpContext.User.GetUserName()));
            return TypedResults.Ok(result);
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Ok<IEnumerable<StayViewModel>>> GetPlaceStayHistory(
        [FromServices] IPlaceQueries queries,
        [Description("The place ID")] int id,
        [Description("Maximum number of stays to return")] int limit = 20)
        => TypedResults.Ok(await queries.GetPlaceStayHistoryAsync(id, limit));

    // ---- stays

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

    public static Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> ConfirmStay(
        [FromServices] IMediator mediator,
        [Description("The stay ID")] int id,
        ConfirmStayRequest? request = null)
        => Run(mediator, new ConfirmStayCommand(id, request?.OptionCode));

    public static Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> StartStay(
        [FromServices] IMediator mediator,
        [Description("The stay ID")] int id,
        StartStayRequest? request = null)
        => Run(mediator, new StartStayCommand(id, request?.OptionCode));

    public static Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> EndStay(
        [FromServices] IMediator mediator,
        [Description("The stay ID")] int id)
        => Run(mediator, new EndStayCommand(id));

    public static Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> CancelStay(
        [FromServices] IMediator mediator,
        [Description("The stay ID")] int id)
        => Run(mediator, new CancelStayCommand(id));

    public static Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> ChangeStayOption(
        [FromServices] IMediator mediator,
        [Description("The stay ID")] int id,
        ChangeStayOptionRequest request)
        => Run(mediator, new ChangeStayOptionCommand(id, request.OptionCode));

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> LeaveStay(
        [FromServices] IMediator mediator,
        HttpContext httpContext,
        [Description("The stay ID")] int id)
    {
        var customerId = httpContext.User.GetUserId();
        if (string.IsNullOrEmpty(customerId))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "User ID not found in token" });
        return await Run(mediator, new LeaveStayCommand(id, customerId));
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> AssignCustomer(
        [FromServices] IStayRepository stays,
        [Description("The stay ID")] int id,
        AssignCustomerRequest request)
    {
        var stay = await stays.GetWithPlaceAsync(id);
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

    public static async Task<Results<Ok, NotFound, ForbidHttpResult, BadRequest<ProblemDetails>>> CancelMyHold(
        [FromServices] IStayRepository stays,
        HttpContext httpContext,
        [Description("The stay ID")] int id)
    {
        var customerId = httpContext.User.GetUserId();
        if (string.IsNullOrEmpty(customerId))
            return TypedResults.Forbid();

        var stay = await stays.GetWithPlaceAsync(id);
        if (stay is null) return TypedResults.NotFound();
        if (stay.CustomerId != customerId) return TypedResults.Forbid();
        if (stay.Status != StayStatus.Held)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "Only a hold that has not started can be given up. Ask the staff to end a running stay." });

        try
        {
            stay.Cancel();
            stays.Update(stay);
            await stays.UnitOfWork.SaveEntitiesAsync();
            return TypedResults.Ok();
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    /// <summary>Runs a stay command and turns its outcome into the usual three results.</summary>
    internal static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> Run(IMediator mediator, IRequest<bool> command)
    {
        try
        {
            var ok = await mediator.Send(command);
            return ok ? TypedResults.Ok() : TypedResults.NotFound();
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }
}

public record RateOptionRequest(string Code, LocalizedText Name, decimal HourlyRate);

public record TariffRequest(List<RateOptionRequest> Options, int RoundingMinutes = 15)
{
    public Tariff ToTariff() => new(Options.Select(o => new RateOption(o.Code, o.Name, o.HourlyRate)), RoundingMinutes);
}

public record CreatePlaceRequest(PlaceKind Kind, LocalizedText Name, LocalizedText? Description = null, TariffRequest? Tariff = null);

public record UpdatePlaceRequest(LocalizedText Name, LocalizedText? Description = null);

/// <summary>Null tariff: the place stops being timed and only takes orders.</summary>
public record SetPlaceTariffRequest(TariffRequest? Tariff);

public record SetPlaceActiveRequest(bool IsActive);

public record HoldPlaceRequest(
    string? CustomerName = null,
    string? Notes = null,
    bool StartOnConfirm = false,
    [property: Description("The rate to start at when the clock starts on Confirm; one of the place's tariff options")] string? OptionCode = null);

public record WalkInStayRequest(string? Notes = null, string? OptionCode = null, string? CustomerId = null, string? CustomerName = null);

public record StartStayRequest(string? OptionCode = null);

public record ConfirmStayRequest(string? OptionCode = null);

public record ChangeStayOptionRequest(string OptionCode);

public record AssignCustomerRequest(string CustomerId, string? CustomerName);

public record AddMemberRequest(string CustomerId, string? CustomerName);
