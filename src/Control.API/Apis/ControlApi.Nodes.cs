using System.ComponentModel;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;
using Ninja.Control.API.Platform.Nodes;

namespace Ninja.Control.API.Apis;

/// <summary>A node as the control app shows it: what it is, what it allows, and how full it is.</summary>
public sealed record NodeDto(
    int Id,
    string Name,
    NodeKind Kind,
    NodeStatus Status,
    string Architecture,
    IReadOnlyList<string> Labels,
    [property: Description("Tenants that live here, destroyed ones left out")] int Tenants,
    [property: Description("Tenants whose stack runs here now")] int Running,
    [property: Description("How many more stacks fit, on its last reading; null before its first")] int? RoomFor,
    [property: Description("Why it takes no more, when it does not")] string? WhyNoRoom,
    [property: Description("When it was last read")] DateTimeOffset? ReadAt,
    long? MemTotalMb,
    long? MemAvailableMb,
    long? DiskFreeMb,
    long? DiskTotalMb,
    [property: Description("Its own settings; null is the platform's")] int? ReserveMb,
    int? StackFootprintMb,
    int? PostgresMaxConnections,
    int? MaxStacks,
    string? AgentUrl,
    string? AgentVersion,
    DateTimeOffset? LastSeenAt,
    string? LastError,
    DateTimeOffset CreatedAt);

/// <summary>What an operator may change on a node now. Left out stays as it is; a limit set to 0 goes back to the platform's.</summary>
public sealed record UpdateNodeRequest(
    [property: Description("Active takes new tenants; Cordoned keeps its own and takes none")] NodeStatus? Status = null,
    [property: Description("What it is for: demo, customer")] IReadOnlyList<string>? Labels = null,
    int? ReserveMb = null,
    int? StackFootprintMb = null,
    int? PostgresMaxConnections = null,
    [property: Description("No more stacks than this; 0 for no cap")] int? MaxStacks = null);

public static partial class ControlApi
{
    private static void MapNodesApi(RouteGroupBuilder api)
    {
        api.MapGet("/platform/nodes", ListNodes).WithName("ListNodes").WithSummary("The boxes tenant stacks run on: each one's status, labels, limits, tenants and room").RequireAuthorization("Platform");
        api.MapPatch("/platform/nodes/{id:int}", UpdateNode).WithName("UpdateNode").WithSummary("Cordon a node or make it active again, label it, or set its own limits").RequireAuthorization("Platform");
    }

    public static async Task<Ok<List<NodeDto>>> ListNodes(ControlContext context, CapacityCache capacity, CancellationToken ct)
    {
        var nodes = await context.Nodes.AsNoTracking().OrderBy(n => n.Id).ToListAsync(ct);
        var counts = await context.Tenants.AsNoTracking()
            .Where(t => t.Status != TenantStatus.Destroyed)
            .GroupBy(t => t.NodeId)
            .Select(g => new { Node = g.Key, Tenants = g.Count(), Running = g.Count(t => t.Status == TenantStatus.Running) })
            .ToListAsync(ct);
        return TypedResults.Ok(nodes.Select(n =>
        {
            var count = counts.FirstOrDefault(c => c.Node == n.Id);
            var snapshot = capacity.For(n.Id);
            var limits = capacity.LimitsFor(n.Id);
            var room = snapshot is null ? (int?)null : limits.RoomFor(snapshot);
            return new NodeDto(n.Id, n.Name, n.Kind, n.Status, n.Architecture, n.Labels,
                count?.Tenants ?? 0, count?.Running ?? 0,
                room, room == 0 && snapshot is not null ? limits.WhyNoRoom(snapshot) : null,
                snapshot?.At, snapshot?.MemTotalMb, snapshot?.MemAvailableMb, snapshot?.TenantsDiskFreeMb, snapshot?.TenantsDiskTotalMb,
                n.ReserveMb, n.StackFootprintMb, n.PostgresMaxConnections, n.MaxStacks,
                n.AgentUrl, n.AgentVersion, n.LastSeenAt, n.LastError, n.CreatedAt);
        }).ToList());
    }

    public static async Task<Results<NoContent, NotFound, BadRequest<ProblemDetails>>> UpdateNode(
        ControlContext context, NodeDirectory directory, IAuditWriter audit, int id, UpdateNodeRequest request, CancellationToken ct)
    {
        var node = await context.Nodes.SingleOrDefaultAsync(n => n.Id == id, ct);
        if (node is null) return TypedResults.NotFound();

        if (request.Status is { } status)
        {
            // Draining, retiring and unreachable are what the platform does to a node, not a switch
            if (status is not (NodeStatus.Active or NodeStatus.Cordoned))
                return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "A node is made active or cordoned here; draining and retiring move its tenants first." });
            if (node.Status is NodeStatus.Draining or NodeStatus.Retired)
                return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"{node.Name} is {node.Status.ToString().ToLowerInvariant()}." });
            node.Status = status;
        }
        if (request.Labels is { } labels)
            node.Labels = labels.Select(l => l.Trim().ToLowerInvariant()).Where(l => l.Length is > 0 and <= 20).Distinct().ToList();
        if (Limit(request.ReserveMb, out var reserve, out var error)) node.ReserveMb = reserve;
        else if (error is not null) return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"Reserve: {error}" });
        if (Limit(request.StackFootprintMb, out var footprint, out error)) node.StackFootprintMb = footprint;
        else if (error is not null) return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"Stack footprint: {error}" });
        if (Limit(request.PostgresMaxConnections, out var connections, out error)) node.PostgresMaxConnections = connections;
        else if (error is not null) return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"Postgres connections: {error}" });
        if (Limit(request.MaxStacks, out var max, out error)) node.MaxStacks = max;
        else if (error is not null) return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"Most stacks: {error}" });

        await context.SaveChangesAsync(ct);
        await directory.RefreshAsync(ct);
        await audit.WriteAsync("node.updated", null, new { node.Id, node.Name, request }, ct);
        return TypedResults.NoContent();

        // Left out: unchanged. 0: back to the platform's. Otherwise a positive number
        static bool Limit(int? asked, out int? value, out string? error)
        {
            value = null;
            error = null;
            if (asked is not int given) return false;
            if (given < 0)
            {
                error = "must be 0 (the platform's) or more.";
                return false;
            }
            value = given == 0 ? null : given;
            return true;
        }
    }
}
