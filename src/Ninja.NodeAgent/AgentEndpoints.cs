using Microsoft.AspNetCore.Mvc;
using Ninja.Control.NodeRuntime;

namespace Ninja.NodeAgent;

/// <summary>
/// The agent's API: the node runtime's parts, one route each, nothing more.
/// Names are checked before they reach a command line; a compose file is
/// checked before it is written. What docker refuses comes back as 502 with
/// its log; a bad name as 400.
/// </summary>
internal static class AgentEndpoints
{
    public static void MapAgentApi(this WebApplication app)
    {
        var v1 = app.MapGroup(AgentApi.Prefix).AddEndpointFilter<AgentErrors>();

        v1.MapGet("/ping", async (IShell shell, CancellationToken ct) =>
        {
            var docker = await shell.RunAsync("docker", ["version", "--format", "{{.Server.Version}}"], null, ct);
            return new AgentPing(AgentApi.Version, ControlPlaneOnly.Architecture, docker.Ok, docker.Ok ? null : docker.Output);
        });

        // --- the stacks
        v1.MapPut("/stacks/{slug}/files", async (string slug, StackFiles files, IStackRuntime stacks, ComposePolicy policy, CancellationToken ct) =>
        {
            var problems = policy.Check(files.Compose);
            if (problems.Count > 0)
                return Results.Problem(detail: string.Join("; ", problems), statusCode: StatusCodes.Status422UnprocessableEntity, title: "The compose file is not one this node runs.");
            await stacks.WriteStackAsync(Slug(slug), files, ct);
            return Results.NoContent();
        });
        v1.MapGet("/stacks/{slug}/stamped", async (string slug, IStackRuntime stacks, CancellationToken ct) => new AgentStamped(await stacks.IsStampedAsync(Slug(slug), ct)));
        v1.MapPost("/stacks/{slug}/up", async (string slug, bool pull, IStackRuntime stacks, CancellationToken ct) => new AgentOutput(await stacks.UpAsync(Slug(slug), pull, ct)));
        v1.MapPost("/stacks/{slug}/stop", async (string slug, IStackRuntime stacks, CancellationToken ct) => new AgentOutput(await stacks.StopAsync(Slug(slug), ct)));
        v1.MapPost("/stacks/{slug}/services/{service}/stop", async (string slug, string service, IStackRuntime stacks, CancellationToken ct) =>
            new AgentOutput(await stacks.StopServiceAsync(Slug(slug), AgentNames.Check(service, "The service"), ct)));
        v1.MapPost("/stacks/{slug}/down", async (string slug, IStackRuntime stacks, CancellationToken ct) => new AgentOutput(await stacks.DownAsync(Slug(slug), ct)));
        v1.MapGet("/stacks/{slug}/containers", async (string slug, IStackRuntime stacks, CancellationToken ct) => await stacks.PsAsync(Slug(slug), ct));
        v1.MapGet("/stacks/{slug}/logs", async (string slug, string? service, int tail, IStackRuntime stacks, CancellationToken ct) =>
            Results.Text(await stacks.LogsAsync(Slug(slug), service is null ? null : AgentNames.Check(service, "The service"), Math.Clamp(tail, 1, 5000), ct)));
        v1.MapGet("/stacks/{slug}/markers/{name}", async (string slug, string name, IStackRuntime stacks, CancellationToken ct) =>
            new AgentMarker(await stacks.ReadMarkerAsync(Slug(slug), AgentNames.CheckMarker(name), ct)));
        v1.MapPut("/stacks/{slug}/markers/{name}", async (string slug, string name, AgentMarker marker, IStackRuntime stacks, CancellationToken ct) =>
        {
            await stacks.WriteMarkerAsync(Slug(slug), AgentNames.CheckMarker(name), marker.Content ?? "", ct);
            return Results.NoContent();
        });

        // --- the data: dumps and archives stream out from a file on the node, so a failure is a status, not a cut-off body
        v1.MapGet("/databases/{database}/dump", (string database, INodeData data, HttpContext http, CancellationToken ct) =>
            StreamOutAsync(http, (output, token) => data.DumpDatabaseAsync(AgentNames.Check(database, "The database"), output, token), ct));
        v1.MapPut("/databases/{database}/restore", async (string database, string role, INodeData data, HttpRequest request, CancellationToken ct) =>
        {
            var result = await data.RestoreDatabaseAsync(AgentNames.Check(database, "The database"), AgentNames.Check(role, "The role"), request.Body, ct);
            return new AgentOutcome(result.ExitCode, result.Output);
        });
        v1.MapGet("/volumes/{volume}/export", (string volume, INodeData data, HttpContext http, CancellationToken ct) =>
            StreamOutAsync(http, (output, token) => data.ExportVolumeAsync(AgentNames.Check(volume, "The volume"), output, token), ct));
        v1.MapPut("/volumes/{volume}/import", async (string volume, INodeData data, HttpRequest request, CancellationToken ct) =>
        {
            var result = await data.ImportVolumeAsync(AgentNames.Check(volume, "The volume"), request.Body, ct);
            return new AgentOutcome(result.ExitCode, result.Output);
        });

        // --- the node's Postgres
        v1.MapPut("/postgres/roles", async (AgentRole role, IDatabaseAdmin admin, CancellationToken ct) =>
        {
            await admin.EnsureRoleAsync(AgentNames.Check(role.Role, "The role"), role.Password, ct);
            return Results.NoContent();
        });
        v1.MapDelete("/postgres/roles/{role}", async (string role, IDatabaseAdmin admin, CancellationToken ct) =>
        {
            await admin.DropRoleAsync(AgentNames.Check(role, "The role"), ct);
            return Results.NoContent();
        });
        v1.MapPut("/postgres/databases", async (AgentDatabase database, IDatabaseAdmin admin, CancellationToken ct) =>
        {
            await admin.EnsureDatabaseAsync(AgentNames.Check(database.Name, "The database"), AgentNames.Check(database.Owner, "The owner"), ct);
            return Results.NoContent();
        });
        v1.MapDelete("/postgres/databases/{database}", async (string database, IDatabaseAdmin admin, CancellationToken ct) =>
        {
            await admin.DropDatabaseAsync(AgentNames.Check(database, "The database"), ct);
            return Results.NoContent();
        });
        v1.MapPost("/postgres/databases/{database}/lockdown", async (string database, IDatabaseAdmin admin, CancellationToken ct) =>
        {
            await admin.LockDownAsync(AgentNames.Check(database, "The database"), ct);
            return Results.NoContent();
        });

        // --- the node's broker
        v1.MapPut("/broker/users", async (AgentBrokerUser user, IBrokerAdmin broker, CancellationToken ct) =>
        {
            await broker.EnsureUserAsync(AgentNames.Check(user.User, "The user"), user.Password, ct);
            return Results.NoContent();
        });
        v1.MapDelete("/broker/users/{user}", async (string user, IBrokerAdmin broker, CancellationToken ct) =>
        {
            await broker.DeleteUserAsync(AgentNames.Check(user, "The user"), ct);
            return Results.NoContent();
        });
        v1.MapPut("/broker/vhosts", async (AgentVHost vhost, IBrokerAdmin broker, CancellationToken ct) =>
        {
            await broker.EnsureVHostAsync(AgentNames.Check(vhost.VHost, "The vhost"), AgentNames.Check(vhost.User, "The user"), ct);
            return Results.NoContent();
        });
        v1.MapDelete("/broker/vhosts/{vhost}", async (string vhost, IBrokerAdmin broker, CancellationToken ct) =>
        {
            await broker.DeleteVHostAsync(AgentNames.Check(vhost, "The vhost"), ct);
            return Results.NoContent();
        });
        v1.MapDelete("/broker/vhosts/{vhost}/permissions/{user}", async (string vhost, string user, IBrokerAdmin broker, CancellationToken ct) =>
        {
            await broker.ClearPermissionsAsync(AgentNames.Check(vhost, "The vhost"), AgentNames.Check(user, "The user"), ct);
            return Results.NoContent();
        });
        v1.MapDelete("/broker/vhosts/{vhost}/queues/{queue}", async (string vhost, string queue, IBrokerAdmin broker, CancellationToken ct) =>
        {
            await broker.DeleteQueueAsync(AgentNames.Check(vhost, "The vhost"), AgentNames.Check(queue, "The queue"), ct);
            return Results.NoContent();
        });

        v1.MapGet("/broker/vhosts/{vhost}/queues", (string vhost, IBrokerAdmin broker, CancellationToken ct) =>
            broker.QueueDepthsAsync(AgentNames.Check(vhost, "The vhost"), ct));

        // --- what the node has
        v1.MapGet("/capacity", (IHostCapacity capacity, CancellationToken ct) => capacity.ProbeAsync(ct));
        v1.MapGet("/images/running", (IImageInventory images, CancellationToken ct) => images.RunningAsync(ct));
        v1.MapGet("/images/tagged", (IImageInventory images, CancellationToken ct) => images.TaggedAsync(ct));
    }

    private static string Slug(string slug) => AgentNames.Check(slug, "The slug");

    /// <summary>The command's output into a scratch file, then that file as the body; its end in the exit-code header, or a 502 with its log.</summary>
    private static async Task<IResult> StreamOutAsync(HttpContext http, Func<Stream, CancellationToken, Task<ShellResult>> run, CancellationToken ct)
    {
        var scratch = Path.Combine(Path.GetTempPath(), $"ninja-agent-{Guid.NewGuid():N}");
        var file = new FileStream(scratch, FileMode.Create, FileAccess.ReadWrite, FileShare.None, 1 << 16, FileOptions.DeleteOnClose);
        try
        {
            var result = await run(file, ct);
            if (!result.Ok)
            {
                await file.DisposeAsync();
                return Results.Json(new AgentOutcome(result.ExitCode, result.Output), statusCode: StatusCodes.Status502BadGateway);
            }
            file.Position = 0;
            http.Response.Headers[AgentApi.ExitCodeHeader] = "0";
            // The stream result disposes the file, which deletes it
            return Results.Stream(file, "application/octet-stream");
        }
        catch
        {
            await file.DisposeAsync();
            throw;
        }
    }
}

/// <summary>What went wrong, in the words the control plane's client turns back into the same exceptions.</summary>
internal sealed class AgentErrors : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        try
        {
            return await next(context);
        }
        catch (ArgumentException ex)
        {
            return Results.Problem(detail: ex.Message, statusCode: StatusCodes.Status400BadRequest);
        }
        catch (ShellException ex)
        {
            return Results.Problem(detail: ex.Message, statusCode: StatusCodes.Status502BadGateway, extensions: new Dictionary<string, object?> { ["log"] = ex.Log, ["shell"] = true });
        }
        catch (InvalidOperationException ex)
        {
            return Results.Problem(detail: ex.Message, statusCode: StatusCodes.Status502BadGateway);
        }
    }
}
