using System.Net;
using System.Net.Http.Json;
using System.Net.Security;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform.Nodes;

/// <summary>
/// A node reached through its agent: every part of it an HTTPS call on the
/// private network, the control plane's certificate presented and the agent's
/// pinned. What the agent answers is turned back into what the same part
/// answers on the box the control plane runs on (a <see cref="ShellException"/>
/// with docker's log, an <see cref="InvalidOperationException"/>), so nothing
/// above a node can tell the two apart.
/// </summary>
public sealed class AgentNodeClient : INodeClient
{
    private readonly Node _node;
    private readonly PlatformOptions _platform;

    public AgentNodeClient(Node node, HttpClient http, PlatformOptions platform)
    {
        _node = node;
        _platform = platform;
        var agent = new AgentHttp(http);
        Stacks = new AgentStackRuntime(agent);
        Data = new AgentNodeData(agent);
        Databases = new AgentDatabaseAdmin(agent);
        Broker = new AgentBrokerAdmin(agent);
        Capacity = new AgentCapacity(agent);
        Images = new AgentImages(agent);
    }

    public NodeRef Node => new(_node.Id, _node.Name);

    /// <summary>The platform's addresses, but the platform's own services as this node reaches them over the private network.</summary>
    public NodeEndpoints Endpoints => NodeEndpoints.From(_platform) with
    {
        KeycloakInternalUrl = _node.KeycloakInternalUrl ?? _platform.KeycloakInternalUrl,
        AiGatewayUrl = _node.AiGatewayUrl ?? _platform.AiGatewayUrl,
        TalabatRelayUrl = _node.TalabatRelayUrl ?? _platform.Talabat.RelayUrl,
    };

    public IStackRuntime Stacks { get; }

    public INodeData Data { get; }

    public IDatabaseAdmin Databases { get; }

    public IBrokerAdmin Broker { get; }

    public IHostCapacity Capacity { get; }

    public IImageInventory Images { get; }

    /// <summary>The node's ingress, asked for the tenant's API host: it routes by host to the stack's gateway.</summary>
    public StackRoute RouteTo(string slug)
        => new(new Uri(_node.IngressUrl ?? throw new InvalidOperationException($"{_node.Name} has no ingress on its record.")), $"api.{slug}.{_platform.Domain}");
}

/// <summary>One agent, spoken to: JSON in and out, its refusals turned back into the exceptions a node part throws.</summary>
internal sealed class AgentHttp(HttpClient http)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static string Path(params string[] parts) => AgentApi.Prefix + "/" + string.Join('/', parts.Select(Uri.EscapeDataString));

    public async Task<T> GetAsync<T>(string path, CancellationToken ct)
    {
        using var response = await http.GetAsync(path, ct);
        await ThrowIfRefusedAsync(response, ct);
        return (await response.Content.ReadFromJsonAsync<T>(Json, ct))!;
    }

    public async Task<string> GetTextAsync(string path, CancellationToken ct)
    {
        using var response = await http.GetAsync(path, ct);
        await ThrowIfRefusedAsync(response, ct);
        return await response.Content.ReadAsStringAsync(ct);
    }

    public async Task<T> SendAsync<T>(HttpMethod method, string path, object? body, CancellationToken ct)
    {
        using var response = await SendRawAsync(method, path, body, ct);
        return (await response.Content.ReadFromJsonAsync<T>(Json, ct))!;
    }

    public async Task SendAsync(HttpMethod method, string path, object? body, CancellationToken ct)
    {
        using var response = await SendRawAsync(method, path, body, ct);
    }

    private async Task<HttpResponseMessage> SendRawAsync(HttpMethod method, string path, object? body, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(method, path) { Content = body is null ? null : JsonContent.Create(body, options: Json) };
        var response = await http.SendAsync(request, ct);
        try
        {
            await ThrowIfRefusedAsync(response, ct);
            return response;
        }
        catch
        {
            response.Dispose();
            throw;
        }
    }

    /// <summary>A body streamed out of the agent into <paramref name="output"/>; the command's end either way.</summary>
    public async Task<ShellResult> DownloadAsync(string path, Stream output, CancellationToken ct)
    {
        using var response = await http.GetAsync(path, HttpCompletionOption.ResponseHeadersRead, ct);
        if (response.StatusCode == HttpStatusCode.BadGateway && response.Content.Headers.ContentType?.MediaType == "application/json")
        {
            var outcome = await response.Content.ReadFromJsonAsync<AgentOutcome>(Json, ct);
            if (outcome is not null) return outcome.ToShellResult();
        }
        await ThrowIfRefusedAsync(response, ct);
        await using var body = await response.Content.ReadAsStreamAsync(ct);
        await body.CopyToAsync(output, ct);
        return new ShellResult(0, "");
    }

    /// <summary>A body streamed into the agent from <paramref name="input"/>; the command's end.</summary>
    public async Task<ShellResult> UploadAsync(string path, Stream input, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Put, path) { Content = new StreamContent(input) };
        request.Content.Headers.ContentType = new("application/octet-stream");
        using var response = await http.SendAsync(request, ct);
        await ThrowIfRefusedAsync(response, ct);
        return (await response.Content.ReadFromJsonAsync<AgentOutcome>(Json, ct))!.ToShellResult();
    }

    private static async Task ThrowIfRefusedAsync(HttpResponseMessage response, CancellationToken ct)
    {
        if (response.IsSuccessStatusCode) return;
        var text = await response.Content.ReadAsStringAsync(ct);
        string detail = text;
        string? log = null;
        try
        {
            using var doc = JsonDocument.Parse(text);
            var root = doc.RootElement;
            if (root.TryGetProperty("detail", out var d) && d.ValueKind == JsonValueKind.String) detail = d.GetString()!;
            if (root.TryGetProperty("shell", out var s) && s.ValueKind == JsonValueKind.True && root.TryGetProperty("log", out var l)) log = l.GetString();
        }
        catch (JsonException) { }
        if (log is not null) throw new ShellException(log);
        throw new InvalidOperationException($"The node's agent answered {(int)response.StatusCode}: {detail}");
    }
}

internal sealed class AgentStackRuntime(AgentHttp agent) : IStackRuntime
{
    public Task WriteStackAsync(string slug, StackFiles files, CancellationToken ct) => agent.SendAsync(HttpMethod.Put, AgentHttp.Path("stacks", slug, "files"), files, ct);

    public async Task<bool> IsStampedAsync(string slug, CancellationToken ct) => (await agent.GetAsync<AgentStamped>(AgentHttp.Path("stacks", slug, "stamped"), ct)).Stamped;

    public async Task<string> UpAsync(string slug, bool pull, CancellationToken ct)
        => (await agent.SendAsync<AgentOutput>(HttpMethod.Post, $"{AgentHttp.Path("stacks", slug, "up")}?pull={(pull ? "true" : "false")}", null, ct)).Output;

    public async Task<string> StopAsync(string slug, CancellationToken ct) => (await agent.SendAsync<AgentOutput>(HttpMethod.Post, AgentHttp.Path("stacks", slug, "stop"), null, ct)).Output;

    public async Task<string> DownAsync(string slug, CancellationToken ct) => (await agent.SendAsync<AgentOutput>(HttpMethod.Post, AgentHttp.Path("stacks", slug, "down"), null, ct)).Output;

    public async Task<IReadOnlyList<ContainerInfo>> PsAsync(string slug, CancellationToken ct) => await agent.GetAsync<List<ContainerInfo>>(AgentHttp.Path("stacks", slug, "containers"), ct);

    public Task<string> LogsAsync(string slug, string? service, int tail, CancellationToken ct)
        => agent.GetTextAsync($"{AgentHttp.Path("stacks", slug, "logs")}?tail={tail}{(service is null ? "" : $"&service={Uri.EscapeDataString(service)}")}", ct);

    public async Task<string?> ReadMarkerAsync(string slug, string name, CancellationToken ct) => (await agent.GetAsync<AgentMarker>(AgentHttp.Path("stacks", slug, "markers", name), ct)).Content;

    public Task WriteMarkerAsync(string slug, string name, string content, CancellationToken ct) => agent.SendAsync(HttpMethod.Put, AgentHttp.Path("stacks", slug, "markers", name), new AgentMarker(content), ct);
}

internal sealed class AgentNodeData(AgentHttp agent) : INodeData
{
    public Task<ShellResult> DumpDatabaseAsync(string database, Stream output, CancellationToken ct) => agent.DownloadAsync(AgentHttp.Path("databases", database, "dump"), output, ct);

    public Task<ShellResult> RestoreDatabaseAsync(string database, string role, Stream input, CancellationToken ct)
        => agent.UploadAsync($"{AgentHttp.Path("databases", database, "restore")}?role={Uri.EscapeDataString(role)}", input, ct);

    public Task<ShellResult> ExportVolumeAsync(string volume, Stream output, CancellationToken ct) => agent.DownloadAsync(AgentHttp.Path("volumes", volume, "export"), output, ct);

    public Task<ShellResult> ImportVolumeAsync(string volume, Stream input, CancellationToken ct) => agent.UploadAsync(AgentHttp.Path("volumes", volume, "import"), input, ct);
}

internal sealed class AgentDatabaseAdmin(AgentHttp agent) : IDatabaseAdmin
{
    public Task EnsureRoleAsync(string role, string password, CancellationToken ct) => agent.SendAsync(HttpMethod.Put, AgentHttp.Path("postgres", "roles"), new AgentRole(role, password), ct);

    public Task EnsureDatabaseAsync(string name, string owner, CancellationToken ct) => agent.SendAsync(HttpMethod.Put, AgentHttp.Path("postgres", "databases"), new AgentDatabase(name, owner), ct);

    public Task DropDatabaseAsync(string name, CancellationToken ct) => agent.SendAsync(HttpMethod.Delete, AgentHttp.Path("postgres", "databases", name), null, ct);

    public Task DropRoleAsync(string role, CancellationToken ct) => agent.SendAsync(HttpMethod.Delete, AgentHttp.Path("postgres", "roles", role), null, ct);

    public Task LockDownAsync(string name, CancellationToken ct) => agent.SendAsync(HttpMethod.Post, AgentHttp.Path("postgres", "databases", name, "lockdown"), null, ct);
}

internal sealed class AgentBrokerAdmin(AgentHttp agent) : IBrokerAdmin
{
    public Task EnsureUserAsync(string user, string password, CancellationToken ct) => agent.SendAsync(HttpMethod.Put, AgentHttp.Path("broker", "users"), new AgentBrokerUser(user, password), ct);

    public Task EnsureVHostAsync(string vhost, string user, CancellationToken ct) => agent.SendAsync(HttpMethod.Put, AgentHttp.Path("broker", "vhosts"), new AgentVHost(vhost, user), ct);

    public Task ClearPermissionsAsync(string vhost, string user, CancellationToken ct) => agent.SendAsync(HttpMethod.Delete, AgentHttp.Path("broker", "vhosts", vhost, "permissions", user), null, ct);

    public Task DeleteVHostAsync(string vhost, CancellationToken ct) => agent.SendAsync(HttpMethod.Delete, AgentHttp.Path("broker", "vhosts", vhost), null, ct);

    public Task DeleteUserAsync(string user, CancellationToken ct) => agent.SendAsync(HttpMethod.Delete, AgentHttp.Path("broker", "users", user), null, ct);

    public Task DeleteQueueAsync(string vhost, string queue, CancellationToken ct) => agent.SendAsync(HttpMethod.Delete, AgentHttp.Path("broker", "vhosts", vhost, "queues", queue), null, ct);
}

internal sealed class AgentCapacity(AgentHttp agent) : IHostCapacity
{
    public Task<CapacitySnapshot> ProbeAsync(CancellationToken ct) => agent.GetAsync<CapacitySnapshot>(AgentHttp.Path("capacity"), ct);
}

internal sealed class AgentImages(AgentHttp agent) : IImageInventory
{
    public async Task<IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>>> RunningAsync(CancellationToken ct)
    {
        var running = await agent.GetAsync<Dictionary<string, Dictionary<string, string>>>(AgentHttp.Path("images", "running"), ct);
        return running.ToDictionary(p => p.Key, p => (IReadOnlyDictionary<string, string>)p.Value, StringComparer.Ordinal);
    }

    public async Task<IReadOnlyDictionary<string, string>> TaggedAsync(CancellationToken ct)
        => await agent.GetAsync<Dictionary<string, string>>(AgentHttp.Path("images", "tagged"), ct);
}

/// <summary>
/// One HTTPS client per agent: the control plane's certificate presented, the
/// agent's certificate accepted only when its SHA-256 thumbprint is the one
/// pinned on the node's record. No CA is trusted, so no other certificate,
/// however valid, gets a connection.
/// </summary>
public sealed class AgentConnections(IOptions<PlatformOptions> options) : IDisposable
{
    private readonly Dictionary<(int Id, string Url, string Pin), HttpClient> _clients = [];
    private readonly Lock _gate = new();

    public INodeClient For(Node node)
    {
        if (string.IsNullOrWhiteSpace(node.AgentUrl) || string.IsNullOrWhiteSpace(node.CertThumbprint))
            throw new InvalidOperationException($"{node.Name} has no agent on its record yet.");
        var key = (node.Id, node.AgentUrl, node.CertThumbprint);
        HttpClient http;
        lock (_gate)
        {
            if (!_clients.TryGetValue(key, out http!))
                _clients[key] = http = Create(node.AgentUrl, node.CertThumbprint);
        }
        return new AgentNodeClient(node, http, options.Value);
    }

    private HttpClient Create(string url, string pin)
    {
        var agents = options.Value.Agents;
        if (!agents.Configured) throw new InvalidOperationException("The control plane has no client certificate for the agents (Platform:Agents:ClientCertificatePath).");
        var certificate = X509CertificateLoader.LoadPkcs12FromFile(agents.ClientCertificatePath!, agents.ClientCertificatePassword);
        var handler = new SocketsHttpHandler
        {
            PooledConnectionLifetime = TimeSpan.FromMinutes(10),
            SslOptions = new SslClientAuthenticationOptions
            {
                ClientCertificates = [certificate],
                RemoteCertificateValidationCallback = (_, presented, _, _) =>
                    presented is not null && string.Equals(presented.GetCertHashString(HashAlgorithmName.SHA256), pin, StringComparison.OrdinalIgnoreCase),
            },
        };
        return new HttpClient(handler) { BaseAddress = new Uri(url), Timeout = TimeSpan.FromSeconds(agents.TimeoutSeconds) };
    }

    public void Dispose()
    {
        lock (_gate)
        {
            foreach (var client in _clients.Values) client.Dispose();
            _clients.Clear();
        }
    }
}
