using System.Globalization;
using Microsoft.Extensions.Options;

namespace Ninja.Control.API.Platform.Nodes;

/// <summary>
/// The box the control plane runs on: its docker through the shell, its
/// tenants' folders under <see cref="PlatformOptions.TenantsRoot"/>. A node
/// agent on another box will run this same class against its own docker.
/// </summary>
public sealed class LocalNodeClient(IShell shell, IOptions<PlatformOptions> options, IDatabaseAdmin databases, IBrokerAdmin broker, IHostCapacity capacity) : INodeClient
{
    public NodeRef Node { get; } = new(1, "node-1");

    public NodeEndpoints Endpoints => NodeEndpoints.From(options.Value);

    public IStackRuntime Stacks { get; } = new LocalStackRuntime(shell, options);

    public INodeData Data { get; } = new LocalNodeData(shell, options);

    public IDatabaseAdmin Databases => databases;

    public IBrokerAdmin Broker => broker;

    public IHostCapacity Capacity => capacity;

    public IImageInventory Images { get; } = new LocalImageInventory(shell);

    /// <summary>The gateway by its container name, on the docker network the control plane shares with the stacks.</summary>
    public StackRoute RouteTo(string slug) => new(new Uri($"http://{TenantNaming.Gateway(slug)}:5000"));
}

/// <summary>This box's images, as docker ps, inspect and images print them.</summary>
public sealed class LocalImageInventory(IShell shell) : IImageInventory
{
    public async Task<IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>>> RunningAsync(CancellationToken ct)
    {
        var byProject = new Dictionary<string, IReadOnlyDictionary<string, string>>(StringComparer.Ordinal);
        var ps = await shell.RunAsync("docker", ["ps", "-a", "--filter", "label=com.docker.compose.project", "--format", "{{.ID}}"], null, ct);
        var ids = ps.Stdout.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (!ps.Ok || ids.Length == 0) return byProject;

        var inspect = await shell.RunAsync("docker", ["inspect", "--format", "{{index .Config.Labels \"com.docker.compose.project\"}}\t{{index .Config.Labels \"com.docker.compose.service\"}}\t{{.Image}}", .. ids], null, ct);
        foreach (var line in inspect.Stdout.Split('\n', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = line.Split('\t');
            if (parts.Length != 3 || !parts[0].StartsWith("ninja-", StringComparison.Ordinal)) continue;
            var slug = parts[0]["ninja-".Length..];
            // {slug}-{service}-api is the compose service; the gateway and anything else is not a versioned image of ours
            var prefix = $"{slug}-"; const string suffix = "-api";
            if (!parts[1].StartsWith(prefix, StringComparison.Ordinal) || !parts[1].EndsWith(suffix, StringComparison.Ordinal)) continue;
            var service = parts[1][prefix.Length..^suffix.Length];
            if (!byProject.TryGetValue(parts[0], out var services)) byProject[parts[0]] = services = new Dictionary<string, string>(StringComparer.Ordinal);
            ((Dictionary<string, string>)services)[service] = parts[2].Trim();
        }
        return byProject;
    }

    public async Task<IReadOnlyDictionary<string, string>> TaggedAsync(CancellationToken ct)
    {
        var map = new Dictionary<string, string>(StringComparer.Ordinal);
        var images = await shell.RunAsync("docker", ["images", "--no-trunc", "--format", "{{.Repository}}:{{.Tag}}\t{{.ID}}"], null, ct);
        if (!images.Ok) return map;
        foreach (var line in images.Stdout.Split('\n', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = line.Split('\t');
            if (parts.Length == 2) map[parts[0]] = parts[1].Trim();
        }
        return map;
    }
}

/// <summary>This box's Postgres through docker exec into its container, its volumes through a throwaway alpine.</summary>
public sealed class LocalNodeData(IShell shell, IOptions<PlatformOptions> options) : INodeData
{
    private PlatformOptions Platform => options.Value;

    public Task<ShellResult> DumpDatabaseAsync(string database, Stream output, CancellationToken ct)
        => shell.RunAsync("docker",
            ["exec", "-e", $"PGPASSWORD={Platform.PostgresPassword}", Platform.PostgresContainer, "pg_dump", "-U", Platform.PostgresUser, "-Fc", database],
            null, null, output, ct);

    public Task<ShellResult> RestoreDatabaseAsync(string database, string role, Stream input, CancellationToken ct)
        => shell.RunAsync("docker",
            ["exec", "-i", "-e", $"PGPASSWORD={Platform.PostgresPassword}", Platform.PostgresContainer, "pg_restore", "-U", Platform.PostgresUser, "--no-owner", "--role", role, "--clean", "--if-exists", "-d", database],
            null, input, Stream.Null, ct);

    public Task<ShellResult> ExportVolumeAsync(string volume, Stream output, CancellationToken ct)
        => shell.RunAsync("docker", ["run", "--rm", "-v", $"{volume}:/from:ro", "alpine", "tar", "czf", "-", "-C", "/from", "."], null, null, output, ct);

    public Task<ShellResult> ImportVolumeAsync(string volume, Stream input, CancellationToken ct)
        => shell.RunAsync("docker", ["run", "-i", "--rm", "-v", $"{volume}:/to", "alpine", "tar", "xzf", "-", "-C", "/to"], null, input, Stream.Null, ct);
}

/// <summary>docker compose on this box, one project per tenant, its files in {TenantsRoot}/{slug}.</summary>
public sealed class LocalStackRuntime(IShell shell, IOptions<PlatformOptions> options) : IStackRuntime
{
    private string Dir(string slug) => Path.Combine(options.Value.TenantsRoot, slug);

    /// <summary>Where compose runs: the stack's folder, or nowhere in particular when it has none (stopping a stack whose files are gone)</summary>
    private string? WorkingDir(string slug) => Directory.Exists(Dir(slug)) ? Dir(slug) : null;

    public async Task WriteStackAsync(string slug, StackFiles files, CancellationToken ct)
    {
        var dir = Dir(slug);
        Directory.CreateDirectory(dir);
        await File.WriteAllTextAsync(Path.Combine(dir, "docker-compose.yaml"), files.Compose, ct);
        var env = Path.Combine(dir, ".env");
        await File.WriteAllTextAsync(env, files.Env, ct);
        // The stack's secrets: the control plane (root) and docker read it, nobody else on the box
        OwnerOnly(env);
    }

    public Task<bool> IsStampedAsync(string slug, CancellationToken ct) => Task.FromResult(Directory.Exists(Dir(slug)));

    public Task<string> UpAsync(string slug, bool pull, CancellationToken ct)
        => ComposeAsync(slug, pull
            ? ["compose", "-p", TenantNaming.Project(slug), "up", "-d", "--pull", "always", "--remove-orphans"]
            : ["compose", "-p", TenantNaming.Project(slug), "up", "-d", "--remove-orphans"], ct);

    public Task<string> StopAsync(string slug, CancellationToken ct)
        => ComposeAsync(slug, ["compose", "-p", TenantNaming.Project(slug), "stop"], ct);

    public async Task<string> DownAsync(string slug, CancellationToken ct)
    {
        var output = await ComposeAsync(slug, ["compose", "-p", TenantNaming.Project(slug), "down", "-v", "--remove-orphans"], ct);
        Directory.Delete(Dir(slug), recursive: true);
        return output;
    }

    public async Task<IReadOnlyList<ContainerInfo>> PsAsync(string slug, CancellationToken ct)
    {
        var result = await shell.RunAsync("docker", ["compose", "-p", TenantNaming.Project(slug), "ps", "-a", "--format", "json"], null, ct);
        if (!result.Ok) throw new InvalidOperationException(result.Output);
        return ComposePs.Parse(result.Stdout);
    }

    public async Task<string> LogsAsync(string slug, string? service, int tail, CancellationToken ct)
    {
        var args = new List<string> { "compose", "-p", TenantNaming.Project(slug), "logs", "--no-color", "--timestamps", "--tail", tail.ToString(CultureInfo.InvariantCulture) };
        if (service is not null)
            args.Add(service == "gateway" ? TenantNaming.Gateway(slug) : TenantNaming.Service(slug, service));
        var result = await shell.RunAsync("docker", args, null, ct);
        if (!result.Ok) throw new InvalidOperationException(result.Output);
        return result.Output;
    }

    public async Task<string?> ReadMarkerAsync(string slug, string name, CancellationToken ct)
    {
        var marker = Path.Combine(Dir(slug), name);
        return File.Exists(marker) ? await File.ReadAllTextAsync(marker, ct) : null;
    }

    public async Task WriteMarkerAsync(string slug, string name, string content, CancellationToken ct)
    {
        Directory.CreateDirectory(Dir(slug));
        await File.WriteAllTextAsync(Path.Combine(Dir(slug), name), content, ct);
    }

    private async Task<string> ComposeAsync(string slug, IReadOnlyList<string> args, CancellationToken ct)
    {
        var result = await shell.RunAsync("docker", args, WorkingDir(slug), ct);
        if (!result.Ok) throw new ShellException(result.Output);
        return result.Output;
    }

    /// <summary>0600 for a file, 0700 for a folder; nothing on Windows, where the dry run lives.</summary>
    internal static void OwnerOnly(string path)
    {
        if (OperatingSystem.IsWindows()) return;
        File.SetUnixFileMode(path, Directory.Exists(path)
            ? UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute
            : UnixFileMode.UserRead | UnixFileMode.UserWrite);
    }
}
