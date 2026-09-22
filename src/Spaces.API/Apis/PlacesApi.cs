using System.ComponentModel;
using Ninja.Spaces.Domain.Events;
using Ninja.Spaces.API.Application.Commands;
using Ninja.Spaces.API.Application.Queries;
using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Ninja.Spaces.Domain.AggregatesModel.StayAggregate;
using Ninja.Spaces.Domain.Exceptions;
using Ninja.Spaces.Domain.SeedWork;
using Ninja.ServiceDefaults;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Ninja.Spaces.API.Apis;

/// <summary>
/// Places (rooms, tables, stations). Place set-up is Admin; a walk-in and
/// the stay history are whoever is at the counter — the "Pos" policy;
/// joining is any signed-in customer. Reading a place is anonymous: the QR
/// landing page is reachable before sign-in. Reservations and stays have
/// their own groups (<see cref="ReservationsApi"/>, <see cref="StaysApi"/>).
/// </summary>
public static class PlacesApi
{
    /// <summary>Why a place cannot be given a rate or opened to bookings: the switch is off, by the plan or by the owner.</summary>
    internal const string TimeBillingOff = "Time billing is off for this café: a place cannot be charged by the hour.";
    internal const string ReservationsOff = "Reservations are off for this café: a place cannot take bookings.";

    public static IEndpointRouteBuilder MapPlacesApi(this IEndpointRouteBuilder app)
    {
        var places = app.MapGroup("api/places").WithTags("Places");

        places.MapGet("/", GetPlaces).WithName("ListPlaces")
            .WithSummary("List places")
            .WithDescription("Every place of the branch with its status; narrow by kind or to timed places");
        places.MapGet("/available", GetAvailablePlaces).WithName("GetAvailablePlaces")
            .WithSummary("Places a customer can reserve for now");
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
            .WithDescription("A place with a tariff is timed and becomes reservable; without one it only takes orders. Refused while a stay runs there.")
            .RequireAuthorization("Admin");
        places.MapPut("/{id:int}/reservable", SetPlaceReservable).WithName("SetPlaceReservable")
            .WithSummary("Let customers reserve a place, or stop that (Admin)")
            .WithDescription("A plain table can take reservations without a clock; a timed place can stop taking them. Refused while a reservation is open there.")
            .RequireAuthorization("Admin");
        places.MapPut("/{id:int}/active", SetPlaceActive).WithName("SetPlaceActive")
            .WithSummary("Activate or deactivate a place (Admin)")
            .WithDescription("Deactivating keeps the place and its printed QR but stops customers ordering to it or reserving it")
            .RequireAuthorization("Admin");
        places.MapPut("/{id:int}/status", SetPlaceStatus).WithName("SetPlaceStatus")
            .WithSummary("Set a place's physical status (Admin)")
            .RequireAuthorization("Admin");
        places.MapDelete("/{id:int}", DeletePlace).WithName("DeletePlace")
            .WithSummary("Delete a place (Admin)")
            .WithDescription("Its printed QR stops working — prefer deactivating. Refused while a reservation is open or a stay is running there.")
            .RequireAuthorization("Admin");

        places.MapGet("/{id:int}/scan", ScanPlace).WithName("ScanPlace")
            .WithSummary("What this customer sees after scanning the place's QR")
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
        places.MapGet("/{id:int}/reservations", GetPlaceReservationHistory).WithName("GetPlaceReservationHistory")
            .WithSummary("Seated, cancelled and lapsed reservations at a place (Admin)")
            .RequireAuthorization("Admin");

        return app;
    }

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
        [FromServices] ITenantFeaturesQueries features,
        HttpContext httpContext,
        CreatePlaceRequest request)
    {
        var branchId = httpContext.GetRequiredBranchId();
        try
        {
            // The gateway blocks the clock and the bookings themselves when they are not in the plan; what a
            // place is created with is decided here, so a switch the form hides is not one a request can use
            var on = await features.GetAsync();
            if (request.Tariff is not null && !on.TimeBilling) throw new SpacesDomainException(TimeBillingOff);
            if (request.Reservable == true && !on.Reservations) throw new SpacesDomainException(ReservationsOff);
            var reservable = request.Reservable ?? (on.Reservations ? null : false);
            var place = new Place(request.Kind, request.Name, branchId, request.Tariff?.ToTariff(), request.Description, reservable);
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
        [FromServices] ITenantFeaturesQueries features,
        [Description("The place ID")] int id,
        SetPlaceTariffRequest request)
    {
        var place = await places.GetAsync(id);
        if (place is null) return TypedResults.NotFound();
        try
        {
            // Taking a rate off is always allowed; putting one on needs the clock
            if (request.Tariff is not null && !(await features.GetAsync()).TimeBilling)
                throw new SpacesDomainException(TimeBillingOff);
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

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> SetPlaceReservable(
        [FromServices] IPlaceRepository places,
        [FromServices] IReservationRepository reservations,
        [FromServices] ITenantFeaturesQueries features,
        [Description("The place ID")] int id,
        SetPlaceReservableRequest request)
    {
        var place = await places.GetAsync(id);
        if (place is null) return TypedResults.NotFound();
        try
        {
            // Closing a place to bookings is always allowed; opening one needs bookings on
            if (request.Reservable && !(await features.GetAsync()).Reservations)
                throw new SpacesDomainException(ReservationsOff);
            if (!request.Reservable && await reservations.HasOpenAsync(id))
                throw new SpacesDomainException("Seat or cancel the reservations at this place before closing it to reservations");
            place.SetReservable(request.Reservable);
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
        [FromServices] IReservationRepository reservations,
        [Description("The place ID")] int id)
    {
        var place = await places.GetAsync(id);
        if (place is null) return TypedResults.NotFound();

        if (await stays.HasOpenStayAsync(id))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "Cannot delete a place with a running stay" });
        if (await reservations.HasOpenAsync(id))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "Cannot delete a place with an open reservation" });

        // The event rides the same unit of work as the delete (the outbox),
        // so a failed delete announces nothing and a crash after it loses nothing
        place.AddDomainEvent(new PlaceDeletedDomainEvent(place));
        places.Delete(place);
        await places.UnitOfWork.SaveEntitiesAsync();
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

    public static async Task<Ok<IEnumerable<ReservationViewModel>>> GetPlaceReservationHistory(
        [FromServices] IReservationQueries queries,
        [Description("The place ID")] int id,
        [Description("Maximum number of reservations to return")] int limit = 20)
        => TypedResults.Ok(await queries.GetPlaceHistoryAsync(id, Math.Clamp(limit, 1, 100)));

    /// <summary>Runs a command and turns its outcome into the usual three results.</summary>
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

    /// <summary>Admin, Owner or Cashier: the till, acting for a customer rather than as one.</summary>
    internal static bool IsStaff(this HttpContext httpContext)
    {
        var roles = httpContext.User.GetRoles().ToList();
        return roles.Contains("Admin", StringComparer.OrdinalIgnoreCase)
            || roles.Contains("Owner", StringComparer.OrdinalIgnoreCase)
            || roles.Contains("Cashier", StringComparer.OrdinalIgnoreCase);
    }
}

public record RateOptionRequest(string Code, LocalizedText Name, decimal HourlyRate);

public record TariffRequest(List<RateOptionRequest> Options, int RoundingMinutes = 15)
{
    public Tariff ToTariff() => new(Options.Select(o => new RateOption(o.Code, o.Name, o.HourlyRate)), RoundingMinutes);
}

/// <summary>Reservable null: on when the place has a tariff, off otherwise.</summary>
public record CreatePlaceRequest(PlaceKind Kind, LocalizedText Name, LocalizedText? Description = null, TariffRequest? Tariff = null, bool? Reservable = null);

public record UpdatePlaceRequest(LocalizedText Name, LocalizedText? Description = null);

/// <summary>Null tariff: the place stops being timed and only takes orders.</summary>
public record SetPlaceTariffRequest(TariffRequest? Tariff);

public record SetPlaceReservableRequest(bool Reservable);

public record SetPlaceActiveRequest(bool IsActive);

public record WalkInStayRequest(string? Notes = null, string? OptionCode = null, string? CustomerId = null, string? CustomerName = null);
