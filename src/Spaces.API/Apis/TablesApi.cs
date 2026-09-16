using System.ComponentModel;
using Chillax.EventBus.Abstractions;
using Chillax.Spaces.API.Application.Queries;
using Chillax.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Chillax.Spaces.Domain.AggregatesModel.StayAggregate;
using Chillax.Spaces.Domain.Exceptions;
using Chillax.Spaces.Domain.SeedWork;
using Chillax.ServiceDefaults;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Chillax.Spaces.API.Apis;

/// <summary>
/// The /api/tables routes, kept for one release as aliases over places of
/// kind Table. Tables got new place ids in the remodel, so an id here is
/// first tried as the id a printed table sticker carries (LegacyTableId),
/// then as a place id — which is what a table created through this alias
/// has. Remove once every client is on /api/places.
/// </summary>
public static class TablesApi
{
    public static IEndpointRouteBuilder MapTablesApi(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("api/tables").WithTags("Tables");

        api.MapGet("/", GetAllTables).WithName("ListTables").WithSummary("List all tables");
        api.MapGet("/{id:int}", GetTableById).WithName("GetTable").WithSummary("Get table by ID");
        api.MapPost("/", CreateTable).WithName("CreateTable").WithSummary("Create a new table").RequireAuthorization("Admin");
        api.MapPut("/{id:int}", UpdateTable).WithName("UpdateTable").WithSummary("Rename a table").RequireAuthorization("Admin");
        api.MapPut("/{id:int}/active", SetTableActive).WithName("SetTableActive").WithSummary("Activate or deactivate a table").RequireAuthorization("Admin");
        api.MapDelete("/{id:int}", DeleteTable).WithName("DeleteTable").WithSummary("Delete a table").RequireAuthorization("Admin");

        return app;
    }

    private static async Task<Place?> Resolve(IPlaceRepository places, int id)
        => await places.GetByLegacyTableIdAsync(id) ?? await places.GetAsync(id);

    public static async Task<Ok<IEnumerable<TableViewModel>>> GetAllTables([FromServices] IPlaceQueries queries, HttpContext httpContext)
    {
        var places = await queries.GetPlacesAsync(httpContext.GetRequiredBranchId(), PlaceKind.Table);
        return TypedResults.Ok(places.Select(p => p.ToTable()));
    }

    public static async Task<Results<Ok<TableViewModel>, NotFound>> GetTableById(
        [FromServices] IPlaceQueries queries, [Description("The table ID")] int id)
    {
        var place = await queries.GetPlaceByLegacyTableIdAsync(id) ?? await queries.GetPlaceByIdAsync(id);
        return place is null || place.Kind != PlaceKind.Table ? TypedResults.NotFound() : TypedResults.Ok(place.ToTable());
    }

    public static async Task<Results<Created<int>, BadRequest<ProblemDetails>>> CreateTable(
        [FromServices] IPlaceRepository places, HttpContext httpContext, CreateTableRequest request)
    {
        try
        {
            var place = Place.Table(request.Name, httpContext.GetRequiredBranchId());
            places.Add(place);
            await places.UnitOfWork.SaveEntitiesAsync();
            return TypedResults.Created($"/api/tables/{place.Id}", place.Id);
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> UpdateTable(
        [FromServices] IPlaceRepository places, [Description("The table ID")] int id, UpdateTableRequest request)
    {
        var place = await Resolve(places, id);
        if (place is null) return TypedResults.NotFound();
        try
        {
            place.UpdateDetails(request.Name, place.Description);
            places.Update(place);
            await places.UnitOfWork.SaveEntitiesAsync();
            return TypedResults.Ok();
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok, NotFound>> SetTableActive(
        [FromServices] IPlaceRepository places, [Description("The table ID")] int id, SetTableActiveRequest request)
    {
        var place = await Resolve(places, id);
        if (place is null) return TypedResults.NotFound();
        place.SetActive(request.IsActive);
        places.Update(place);
        await places.UnitOfWork.SaveEntitiesAsync();
        return TypedResults.Ok();
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> DeleteTable(
        [FromServices] IPlaceRepository places, [FromServices] IStayRepository stays, [FromServices] IEventBus eventBus,
        [Description("The table ID")] int id)
    {
        var place = await Resolve(places, id);
        if (place is null) return TypedResults.NotFound();
        return await PlacesApi.DeletePlace(places, stays, eventBus, place.Id);
    }
}

public record CreateTableRequest(LocalizedText Name);

public record UpdateTableRequest(LocalizedText Name);

public record SetTableActiveRequest(bool IsActive);
