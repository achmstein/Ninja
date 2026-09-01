using System.ComponentModel;
using Chillax.Spaces.API.Application.Queries;
using Chillax.Spaces.Domain.Exceptions;
using Chillax.Spaces.Domain.SeedWork;
using Chillax.ServiceDefaults;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Table = Chillax.Spaces.Domain.AggregatesModel.TableAggregate.Table;
using SpacesContext = Chillax.Spaces.Infrastructure.SpacesContext;

namespace Chillax.Spaces.API.Apis;

public static class TablesApi
{
    public static IEndpointRouteBuilder MapTablesApi(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("api/tables");

        // Queries - anonymous: the QR landing page is reachable before sign-in
        api.MapGet("/", GetAllTables)
            .WithName("ListTables")
            .WithSummary("List all tables")
            .WithDescription("Get all café tables for the branch, including inactive ones")
            .WithTags("Tables");

        api.MapGet("/{id:int}", GetTableById)
            .WithName("GetTable")
            .WithSummary("Get table by ID")
            .WithDescription("Get a table by its ID. This is what a scanned table QR code resolves to.")
            .WithTags("Tables");

        // Admin table management
        api.MapPost("/", CreateTable)
            .WithName("CreateTable")
            .WithSummary("Create a new table")
            .WithDescription("Create a new café table (Admin only)")
            .WithTags("Tables")
            .RequireAuthorization("Admin");

        api.MapPut("/{id:int}", UpdateTable)
            .WithName("UpdateTable")
            .WithSummary("Rename a table")
            .WithDescription("Update a table's name (Admin only)")
            .WithTags("Tables")
            .RequireAuthorization("Admin");

        api.MapPut("/{id:int}/active", SetTableActive)
            .WithName("SetTableActive")
            .WithSummary("Activate or deactivate a table")
            .WithDescription("Deactivating keeps the table and its printed QR code, but stops customers ordering to it (Admin only)")
            .WithTags("Tables")
            .RequireAuthorization("Admin");

        api.MapDelete("/{id:int}", DeleteTable)
            .WithName("DeleteTable")
            .WithSummary("Delete a table")
            .WithDescription("Permanently delete a table. Its printed QR code stops working - prefer deactivating (Admin only)")
            .WithTags("Tables")
            .RequireAuthorization("Admin");

        return app;
    }

    public static async Task<Ok<IEnumerable<TableViewModel>>> GetAllTables(
        SpacesContext context,
        HttpContext httpContext)
    {
        var branchId = httpContext.GetRequiredBranchId();

        var tables = await context.Tables
            .Where(t => t.BranchId == branchId)
            .OrderBy(t => t.Name.En)
            .ToListAsync();

        return TypedResults.Ok<IEnumerable<TableViewModel>>(tables.Select(ToViewModel).ToList());
    }

    public static async Task<Results<Ok<TableViewModel>, NotFound>> GetTableById(
        SpacesContext context,
        [Description("The table ID")] int id)
    {
        var table = await context.Tables.FindAsync(id);
        if (table == null)
        {
            return TypedResults.NotFound();
        }

        return TypedResults.Ok(ToViewModel(table));
    }

    private static TableViewModel ToViewModel(Table table) => new()
    {
        Id = table.Id,
        Name = table.Name,
        BranchId = table.BranchId,
        IsActive = table.IsActive
    };

    public static async Task<Results<Created<int>, BadRequest<ProblemDetails>>> CreateTable(
        SpacesContext context,
        HttpContext httpContext,
        CreateTableRequest request)
    {
        var branchId = httpContext.GetRequiredBranchId();

        try
        {
            var table = new Table(request.Name, branchId);
            context.Tables.Add(table);
            await context.SaveChangesAsync();
            return TypedResults.Created($"/api/tables/{table.Id}", table.Id);
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok, NotFound, BadRequest<ProblemDetails>>> UpdateTable(
        SpacesContext context,
        [Description("The table ID")] int id,
        UpdateTableRequest request)
    {
        var table = await context.Tables.FindAsync(id);
        if (table == null)
        {
            return TypedResults.NotFound();
        }

        try
        {
            table.Rename(request.Name);
            await context.SaveChangesAsync();
            return TypedResults.Ok();
        }
        catch (SpacesDomainException ex)
        {
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = ex.Message });
        }
    }

    public static async Task<Results<Ok, NotFound>> SetTableActive(
        SpacesContext context,
        [Description("The table ID")] int id,
        SetTableActiveRequest request)
    {
        var table = await context.Tables.FindAsync(id);
        if (table == null)
        {
            return TypedResults.NotFound();
        }

        table.SetActive(request.IsActive);
        await context.SaveChangesAsync();
        return TypedResults.Ok();
    }

    public static async Task<Results<Ok, NotFound>> DeleteTable(
        SpacesContext context,
        [Description("The table ID")] int id)
    {
        var table = await context.Tables.FindAsync(id);
        if (table == null)
        {
            return TypedResults.NotFound();
        }

        context.Tables.Remove(table);
        await context.SaveChangesAsync();
        return TypedResults.Ok();
    }
}

/// <summary>
/// Request model for creating a café table
/// </summary>
public record CreateTableRequest(LocalizedText Name);

/// <summary>
/// Request model for renaming a café table
/// </summary>
public record UpdateTableRequest(LocalizedText Name);

/// <summary>
/// Request model for activating or deactivating a café table
/// </summary>
public record SetTableActiveRequest(bool IsActive);
