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

/// <summary>A node reached through its agent, as its setup reports it (deploy/cell): where its agent and ingress answer on the private network, the agent's pinned certificate, and the platform's services as it reaches them.</summary>
public sealed record RegisterNodeRequest(
    [property: Description("node-2, node-3: unique")] string? Name,
    [property: Description("https://10.66.0.2:7443")] string? AgentUrl,
    [property: Description("http://10.66.0.2:8088")] string? IngressUrl,
    [property: Description("The agent certificate's SHA-256 thumbprint, as setup-node printed it")] string? CertThumbprint,
    string Architecture = "amd64",
    IReadOnlyList<string>? Labels = null,
    [property: Description("Keycloak as the node's stacks reach it: the control box's internal edge")] string? KeycloakInternalUrl = null,
    string? AiGatewayUrl = null,
    string? TalabatRelayUrl = null);

/// <summary>Where to move a business: a node by its id, or wherever placement finds room when left out; forced onto a full or cordoned node only when asked.</summary>
public sealed record MoveTenantRequest(int? NodeId = null, bool Force = false);

/// <summary>A drain's start: the tenants whose move is queued, and those that cannot move now, each with why.</summary>
public sealed record DrainResult(IReadOnlyList<string> Moving, IReadOnlyList<string> Stuck);

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
        api.MapPost("/platform/nodes", RegisterNode).WithName("RegisterNode").WithSummary("Put a node reached through its agent on the record, cordoned: it takes tenants once it answers and is made active").RequireAuthorization("Platform");
        api.MapPost("/platform/nodes/{id:int}/ping", PingNode).WithName("PingNode").WithSummary("Ask the node whether it answers: its agent's version, its architecture, whether its docker runs; the record keeps when it last did").RequireAuthorization("Platform");
        api.MapPost("/platform/nodes/{id:int}/drain", DrainNode).WithName("DrainNode").WithSummary("Move every tenant off the node, one at a time, each where placement finds room; the node takes no new ones").RequireAuthorization("Platform");
        api.MapPost("/platform/nodes/{id:int}/retire", RetireNode).WithName("RetireNode").WithSummary("Let an empty node go: no tenant on it and no old copy waiting to be cleared there").RequireAuthorization("Platform");
        api.MapPost("/platform/nodes/{id:int}/evacuate", EvacuateNode).WithName("EvacuateNode").WithSummary("Bring every tenant of a node that does not answer up elsewhere from its newest backup; what each took since is lost, and the node's copies are stopped if it ever answers again").RequireAuthorization("Platform");
        api.MapPost("/tenants/{slug}/move", MoveTenant).WithName("MoveTenant").WithSummary("Move the business's stack to another node with its data, realm and passwords: minutes of downtime, undone if anything fails before the switch").RequireAuthorization("Platform");
    }

    public static async Task<Results<Accepted, NotFound, Conflict<ProblemDetails>>> MoveTenant(
        ControlContext context, Placement placement, ProvisioningQueue queue, IAuditWriter audit, string slug, MoveTenantRequest request, CancellationToken ct)
    {
        var tenant = await context.Tenants.SingleOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is null) return TypedResults.NotFound();
        var refused = await MoveRefusalAsync(context, tenant, ct);
        if (refused is not null) return TypedResults.Conflict<ProblemDetails>(new() { Detail = refused });

        var placed = await placement.PlaceAsync(new PlacementRequest(tenant.Kind, request.NodeId, request.Force, ExcludeNodeId: tenant.NodeId), ct);
        if (placed.NodeId is not int target)
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"Nowhere to move it: {placed.Reason}" });
        tenant.MovingToNodeId = target;
        await context.SaveChangesAsync(ct);
        await audit.WriteAsync("tenant.move", slug, new { from = tenant.NodeId, to = target, placed.Reason }, ct);
        await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "move"), ct);
        return TypedResults.Accepted($"/api/control/tenants/{slug}");
    }

    /// <summary>Why the tenant cannot be moved now, or nothing: only a settled stack moves, and one move at a time.</summary>
    private static async Task<string?> MoveRefusalAsync(ControlContext context, Tenant tenant, CancellationToken ct)
    {
        if (tenant.Status is not (TenantStatus.Running or TenantStatus.Stopped))
            return $"Only a running or stopped business moves; {tenant.Slug} is {tenant.Status}.";
        if (tenant.MovingToNodeId is not null)
            return $"{tenant.Slug} is moving already.";
        if (await context.Jobs.AnyAsync(j => j.TenantId == tenant.Id && (j.Status == JobStatus.Queued || j.Status == JobStatus.Running) && j.Action != "move-cleanup", ct))
            return $"{tenant.Slug} has a job waiting or running; move it once that is done.";
        if (!tenant.HasOwnCredentials)
            return $"{tenant.Slug} has no credentials of its own yet; secure it first.";
        return null;
    }

    public static async Task<Results<Ok<DrainResult>, NotFound, Conflict<ProblemDetails>>> DrainNode(
        ControlContext context, NodeDirectory directory, Placement placement, ProvisioningQueue queue, IAuditWriter audit, int id, CancellationToken ct)
    {
        var node = await context.Nodes.SingleOrDefaultAsync(n => n.Id == id, ct);
        if (node is null) return TypedResults.NotFound();
        if (node.Status is NodeStatus.Retired or NodeStatus.Unreachable)
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"{node.Name} is {node.Status.ToString().ToLowerInvariant()}: a drain needs it answering." });
        node.Status = NodeStatus.Draining;
        await context.SaveChangesAsync(ct);
        await directory.RefreshAsync(ct);

        var queued = new List<string>();
        var stuck = new List<string>();
        var tenants = await context.Tenants.Where(t => t.NodeId == id && t.Status != TenantStatus.Destroyed).OrderBy(t => t.Slug).ToListAsync(ct);
        foreach (var tenant in tenants)
        {
            if (tenant.MovingToNodeId is not null) { queued.Add(tenant.Slug); continue; }
            var refused = await MoveRefusalAsync(context, tenant, ct);
            var placed = refused is null ? await placement.PlaceAsync(new PlacementRequest(tenant.Kind, ExcludeNodeId: id), ct) : null;
            if (placed?.NodeId is not int target)
            {
                stuck.Add($"{tenant.Slug}: {refused ?? placed!.Reason}");
                continue;
            }
            tenant.MovingToNodeId = target;
            await context.SaveChangesAsync(ct);
            await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "move"), ct);
            queued.Add(tenant.Slug);
        }
        await audit.WriteAsync("node.drain", null, new { node.Id, node.Name, queued, stuck }, ct);
        return TypedResults.Ok(new DrainResult(queued, stuck));
    }

    public static async Task<Results<Ok<DrainResult>, NotFound, Conflict<ProblemDetails>>> EvacuateNode(
        ControlContext context, Placement placement, ProvisioningQueue queue, IAuditWriter audit, int id, CancellationToken ct)
    {
        var node = await context.Nodes.SingleOrDefaultAsync(n => n.Id == id, ct);
        if (node is null) return TypedResults.NotFound();
        // Only a node that has stopped answering: one that answers is drained, losing nothing
        if (node.Status != NodeStatus.Unreachable)
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"{node.Name} answers: drain it instead, which loses nothing." });

        var queued = new List<string>();
        var stuck = new List<string>();
        foreach (var tenant in await context.Tenants.Where(t => t.NodeId == id && t.Status != TenantStatus.Destroyed).OrderBy(t => t.Slug).ToListAsync(ct))
        {
            if (tenant.MovingToNodeId is not null) { queued.Add(tenant.Slug); continue; }
            if (tenant.Status is not (TenantStatus.Running or TenantStatus.Stopped or TenantStatus.Failed))
            {
                stuck.Add($"{tenant.Slug}: it is {tenant.Status}");
                continue;
            }
            var placed = await placement.PlaceAsync(new PlacementRequest(tenant.Kind, ExcludeNodeId: id), ct);
            if (placed.NodeId is not int target)
            {
                stuck.Add($"{tenant.Slug}: {placed.Reason}");
                continue;
            }
            tenant.MovingToNodeId = target;
            // A failed tenant comes back running: it was failing on a node that is gone
            if (tenant.Status == TenantStatus.Failed) tenant.StatusBeforeMove = TenantStatus.Running;
            await context.SaveChangesAsync(ct);
            await queue.EnqueueAsync(new ProvisioningJob(tenant.Id, "evacuate", NodeId: target), ct);
            queued.Add(tenant.Slug);
        }
        await audit.WriteAsync("node.evacuate", null, new { node.Id, node.Name, queued, stuck }, ct);
        return TypedResults.Ok(new DrainResult(queued, stuck));
    }

    public static async Task<Results<NoContent, NotFound, Conflict<ProblemDetails>>> RetireNode(
        ControlContext context, NodeDirectory directory, IAuditWriter audit, int id, CancellationToken ct)
    {
        var node = await context.Nodes.SingleOrDefaultAsync(n => n.Id == id, ct);
        if (node is null) return TypedResults.NotFound();
        if (node.Id == Node.HomeId)
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = "The box the control plane runs on is not retired." });
        var living = await context.Tenants.CountAsync(t => (t.NodeId == id || t.MovingToNodeId == id) && t.Status != TenantStatus.Destroyed, ct);
        if (living > 0)
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"{living} tenant(s) still live on {node.Name}; drain it first." });
        var waiting = await context.Jobs.CountAsync(j => j.NodeId == id && j.Action == "move-cleanup" && j.Status == JobStatus.Queued, ct);
        if (waiting > 0)
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"{waiting} moved tenant(s) still have their old copy on {node.Name}, kept in case a move is undone; it is cleared when their time is up." });
        node.Status = NodeStatus.Retired;
        await context.SaveChangesAsync(ct);
        await directory.RefreshAsync(ct);
        await audit.WriteAsync("node.retired", null, new { node.Id, node.Name }, ct);
        return TypedResults.NoContent();
    }

    public static async Task<Results<Created<NodeDto>, BadRequest<ProblemDetails>, Conflict<ProblemDetails>>> RegisterNode(
        ControlContext context, NodeDirectory directory, IAuditWriter audit, RegisterNodeRequest request, CancellationToken ct)
    {
        var name = request.Name?.Trim().ToLowerInvariant();
        if (name is null || !AgentNames.IsValid(name) || name.Length > 32)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The name is 1–32 lower-case letters, digits and dashes (node-2)." });
        if (!Absolute(request.AgentUrl, "https") || !Absolute(request.IngressUrl, "http"))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The agent is reached at an https:// address and the ingress at an http:// one, both on the private network." });
        var pin = request.CertThumbprint?.Replace(":", "").Trim().ToUpperInvariant();
        if (pin is null || pin.Length != 64 || !pin.All(Uri.IsHexDigit))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The agent's certificate is pinned by its SHA-256 thumbprint: 64 hex digits." });
        if (request.Architecture is not ("amd64" or "arm64"))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The architecture is amd64 or arm64." });
        foreach (var url in new[] { request.KeycloakInternalUrl, request.AiGatewayUrl, request.TalabatRelayUrl }.Where(u => u is not null))
            if (!Absolute(url, "http") && !Absolute(url, "https"))
                return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"{url} is not an address." });
        if (await context.Nodes.AnyAsync(n => n.Name == name, ct))
            return TypedResults.Conflict<ProblemDetails>(new() { Detail = $"{name} is on the record already." });

        var node = new Node
        {
            Name = name,
            Kind = NodeKind.Agent,
            // Cordoned until it has answered and someone has looked: no tenant lands on a node nobody has seen work
            Status = NodeStatus.Cordoned,
            AgentUrl = request.AgentUrl!.TrimEnd('/'),
            IngressUrl = request.IngressUrl!.TrimEnd('/'),
            CertThumbprint = pin,
            Architecture = request.Architecture,
            Labels = request.Labels?.Select(l => l.Trim().ToLowerInvariant()).Where(l => l.Length is > 0 and <= 20).Distinct().ToList() ?? [],
            KeycloakInternalUrl = request.KeycloakInternalUrl,
            AiGatewayUrl = request.AiGatewayUrl,
            TalabatRelayUrl = request.TalabatRelayUrl,
            // A node of its own keeps its Postgres for its stacks: a handful of connections for anything else
            PlatformConnections = 5,
        };
        context.Nodes.Add(node);
        await context.SaveChangesAsync(ct);
        await directory.RefreshAsync(ct);
        await audit.WriteAsync("node.registered", null, new { node.Id, node.Name, node.AgentUrl, node.IngressUrl }, ct);
        return TypedResults.Created($"/api/control/platform/nodes/{node.Id}", ToDto(node, 0, 0, null, null, null));

        static bool Absolute(string? url, string scheme) => Uri.TryCreate(url, UriKind.Absolute, out var u) && u.Scheme == scheme;
    }

    public static async Task<Results<Ok<AgentPing>, NotFound, ProblemHttpResult>> PingNode(
        ControlContext context, NodeDirectory directory, int id, CancellationToken ct)
    {
        var node = await context.Nodes.SingleOrDefaultAsync(n => n.Id == id, ct);
        if (node is null) return TypedResults.NotFound();
        try
        {
            var ping = await directory.For(id).PingAsync(ct);
            node.LastSeenAt = DateTimeOffset.UtcNow;
            node.AgentVersion = ping.Version;
            node.LastError = ping.Docker ? null : $"docker: {ping.Error}";
            if (node.Status == NodeStatus.Unreachable) node.Status = NodeStatus.Cordoned;
            await context.SaveChangesAsync(ct);
            await directory.RefreshAsync(ct);
            return TypedResults.Ok(ping);
        }
        catch (Exception ex) when (ex is HttpRequestException or InvalidOperationException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            node.LastError = ex.Message;
            await context.SaveChangesAsync(ct);
            return TypedResults.Problem(detail: $"{node.Name} does not answer: {ex.Message}", statusCode: StatusCodes.Status502BadGateway);
        }
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
            return ToDto(n, count?.Tenants ?? 0, count?.Running ?? 0, room, room == 0 && snapshot is not null ? limits.WhyNoRoom(snapshot) : null, snapshot);
        }).ToList());
    }

    private static NodeDto ToDto(Node n, int tenants, int running, int? room, string? whyNoRoom, CapacitySnapshot? snapshot)
        => new(n.Id, n.Name, n.Kind, n.Status, n.Architecture, n.Labels, tenants, running, room, whyNoRoom,
            snapshot?.At, snapshot?.MemTotalMb, snapshot?.MemAvailableMb, snapshot?.TenantsDiskFreeMb, snapshot?.TenantsDiskTotalMb,
            n.ReserveMb, n.StackFootprintMb, n.PostgresMaxConnections, n.MaxStacks,
            n.AgentUrl, n.AgentVersion, n.LastSeenAt, n.LastError, n.CreatedAt);

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
