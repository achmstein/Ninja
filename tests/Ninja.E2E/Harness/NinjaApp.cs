using Ninja.E2E.Manifest;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Ninja.E2E.Harness;

/// <summary>
/// The whole system, booted once per test assembly: src/Ninja.AppHost in
/// test mode (fresh Postgres, RabbitMQ and Keycloak containers, all twelve
/// APIs, the YARP BFF), plus the recorders the scenarios assert against.
/// </summary>
public sealed class NinjaApp : IAsyncLifetime
{
    public static readonly TimeSpan BootTimeout = TimeSpan.FromMinutes(
        int.TryParse(Environment.GetEnvironmentVariable("CHILLAX_E2E_BOOT_TIMEOUT_MINUTES"), out var m) ? m : 6);

    private IDistributedApplicationTestingBuilder? _builder;
    private DistributedApplication? _app;
    private readonly Dictionary<string, string> _connectionStrings = [];
    private readonly Dictionary<(Persona, int?), ApiClient> _clients = [];

    public DistributedApplication App => _app ?? throw NotBooted();
    public Uri BffBaseAddress { get; private set; } = null!;
    public Uri KeycloakBaseAddress { get; private set; } = null!;
    public string EventBusConnectionString { get; private set; } = "";
    public IReadOnlyDictionary<string, string> ConnectionStrings => _connectionStrings;

    public TokenProvider Tokens { get; private set; } = null!;
    public EventRecorder Events { get; private set; } = null!;
    public HubRecorder Hub { get; private set; } = null!;
    public LogRecorder Logs { get; private set; } = null!;
    public OutboxInspector Outbox { get; private set; } = null!;

    public ApiClient Cashier => CreateClient(Persona.Cashier);
    public ApiClient Admin => CreateClient(Persona.Admin);
    public ApiClient Tester => CreateClient(Persona.Tester);

    public ApiClient CreateClient(Persona persona, int? branchId = 1)
    {
        lock (_clients)
        {
            if (!_clients.TryGetValue((persona, branchId), out var client))
                _clients[(persona, branchId)] = client = new ApiClient(BffBaseAddress, ct => Tokens.GetAsync(persona, ct), branchId);
            return client;
        }
    }

    public Checkpoint Checkpoint() => new(Events.Mark(), Hub.Mark(), Logs.Mark(), DateTime.UtcNow);

    /// <summary>Everything the recorders saw since a checkpoint; attached to failed scenarios.</summary>
    public string Dump(Checkpoint since)
    {
        var events = Events.Since(since.Events).Select(e => $"  {e.ReceivedAt:HH:mm:ss.fff} {e.Name} {Truncate(e.RawJson, 400)}");
        var hub = Hub.Since(since.Hub).Select(h => $"  {h.ReceivedAt:HH:mm:ss.fff} {h.Method} {h.Payload}");
        var failures = Logs.Failures(since.Logs).Select(f => "  " + f.ToString().Replace("\n", "\n  "));
        return $"--- bus events since checkpoint ---\n{string.Join("\n", events)}\n" +
               $"--- hub pushes since checkpoint ---\n{string.Join("\n", hub)}\n" +
               $"--- log failures since checkpoint ---\n{string.Join("\n", failures)}";
    }

    public async ValueTask InitializeAsync()
    {
        using var cts = new CancellationTokenSource(BootTimeout);
        var ct = cts.Token;
        try
        {
            await BootAsync(ct);
        }
        catch (Exception ex)
        {
            var tail = Logs?.DumpAll(40) ?? "(no logs captured)";
            var dumpFile = Path.Combine(Path.GetTempPath(), "chillax-e2e-boot.log");
            try { File.WriteAllText(dumpFile, Logs?.DumpAll(3000) ?? ""); } catch (IOException) { /* best effort */ }
            await DisposeAsync();
            var hint = ex.ToString().Contains("docker", StringComparison.OrdinalIgnoreCase) || ex.ToString().Contains("container runtime", StringComparison.OrdinalIgnoreCase)
                ? " Is Docker Desktop running?"
                : "";
            throw new InvalidOperationException(
                $"Chillax AppHost failed to boot within {BootTimeout}.{hint}\n{ex.Message}\n\nFull resource logs: {dumpFile}\n--- resource logs (tail) ---\n{tail}", ex);
        }
    }

    private async Task BootAsync(CancellationToken ct)
    {
        _builder = await DistributedApplicationTestingBuilder.CreateAsync<Projects.Ninja_AppHost>([], (options, settings) =>
        {
            settings.Configuration ??= new ConfigurationManager();
            settings.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Ninja:TestMode"] = "true",
                // Otherwise every service line is mirrored into the test console.
                ["Logging:LogLevel:Ninja.AppHost.Resources"] = "None",
            });
        }, ct);

        // Four containers and twelve processes take longer than the 30 s default to stop.
        _builder.Services.Configure<HostOptions>(o => o.ShutdownTimeout = TimeSpan.FromSeconds(90));

        _app = await _builder.BuildAsync(ct);
        await _app.StartAsync(ct);

        Logs = new LogRecorder(_app);
        Logs.Start(KnownResources.Apis.Concat([KnownResources.Bff, KnownResources.Keycloak, KnownResources.EventBus, KnownResources.Postgres]));

        // Keycloak: container healthy, then the realm import has finished.
        await _app.ResourceNotifications.WaitForResourceHealthyAsync(KnownResources.Keycloak, ct);
        KeycloakBaseAddress = _app.GetEndpoint(KnownResources.Keycloak, "http");
        using (var http = new HttpClient { BaseAddress = KeycloakBaseAddress })
        {
            await Eventually.Async(async () =>
            {
                using var r = await http.GetAsync($"realms/{TokenProvider.Realm}/.well-known/openid-configuration", ct);
                return r.IsSuccessStatusCode;
            }, "Keycloak realm import", ct, TimeSpan.FromMinutes(3), TimeSpan.FromSeconds(1));
        }

        // Every API healthy = migrated + seeded + Postgres/RabbitMQ reachable.
        await Task.WhenAll(KnownResources.Apis.Select(n => _app.ResourceNotifications.WaitForResourceHealthyAsync(n, ct)));

        // The BFF routes to all of them.
        await _app.ResourceNotifications.WaitForResourceAsync(KnownResources.Bff, KnownResourceStates.Running, ct);
        BffBaseAddress = _app.GetEndpoint(KnownResources.Bff, "http");
        using (var http = new HttpClient { BaseAddress = BffBaseAddress, Timeout = TimeSpan.FromSeconds(10) })
        {
            http.DefaultRequestHeaders.Add("X-Branch-Id", "1");
            var last = "";
            try
            {
                await Eventually.Async(async () =>
                {
                    try
                    {
                        using var items = await http.GetAsync("api/catalog/items?api-version=1.0", ct);
                        using var branches = await http.GetAsync("api/branches?api-version=1.0", ct);
                        last = $"items={(int)items.StatusCode} branches={(int)branches.StatusCode} {Truncate(await items.Content.ReadAsStringAsync(ct), 200)}";
                        return items.IsSuccessStatusCode && branches.IsSuccessStatusCode;
                    }
                    catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
                    {
                        last = ex.Message;
                        return false;
                    }
                }, $"BFF routing at {BffBaseAddress} to catalog-api and branch-api", ct, TimeSpan.FromMinutes(2), TimeSpan.FromSeconds(1));
            }
            catch (TimeoutException ex)
            {
                throw new TimeoutException($"{ex.Message} (last probe: {last})", ex);
            }
        }

        // Bus recorder, and every service consumer bound before anything is published.
        EventBusConnectionString = await _app.GetConnectionStringAsync(KnownResources.EventBus, ct)
            ?? throw new InvalidOperationException("No connection string for eventbus");
        Events = await EventRecorder.StartAsync(EventBusConnectionString, KnownEvents.All, ct);
        await Events.WaitForServiceQueuesAsync(KnownResources.Queues, TimeSpan.FromSeconds(90), ct);

        foreach (var db in KnownResources.Databases)
        {
            _connectionStrings[db] = await _app.GetConnectionStringAsync(db, ct)
                ?? throw new InvalidOperationException($"No connection string for {db}");
        }
        Outbox = new OutboxInspector(_connectionStrings);

        Tokens = new TokenProvider(KeycloakBaseAddress);
        await Tokens.GetAsync(Persona.Admin, ct);
        Hub = await HubRecorder.ConnectAsync(BffBaseAddress, c => Tokens.GetAsync(Persona.Admin, c), ct);
    }

    public async ValueTask DisposeAsync()
    {
        lock (_clients)
        {
            foreach (var c in _clients.Values)
                c.Dispose();
            _clients.Clear();
        }
        if (Hub is not null)
            await Hub.DisposeAsync();
        if (Events is not null)
            await Events.DisposeAsync();
        Tokens?.Dispose();
        Logs?.Stop();
        if (_app is not null)
            await _app.DisposeAsync();
        if (_builder is not null)
            await _builder.DisposeAsync();
        _app = null;
        _builder = null;
    }

    private static InvalidOperationException NotBooted() => new("The Chillax AppHost has not been booted");

    private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max] + "…";
}
