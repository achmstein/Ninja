using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;

namespace Chillax.E2E.Harness;

/// <summary>One server-to-client push as the SPAs receive it. Payloads are lowerCamel anonymous objects.</summary>
public sealed record HubMessage(long Seq, string Method, JsonElement Payload, DateTimeOffset ReceivedAt)
{
    public JsonElement? Prop(string name)
    {
        if (Payload.ValueKind != JsonValueKind.Object)
            return null;
        foreach (var p in Payload.EnumerateObject())
        {
            if (string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase))
                return p.Value;
        }
        return null;
    }

    public int Int(string name) => Prop(name) is { ValueKind: JsonValueKind.Number } e ? e.GetInt32() : throw Missing(name);
    public bool Bool(string name) => Prop(name) is { ValueKind: JsonValueKind.True or JsonValueKind.False } e ? e.GetBoolean() : throw Missing(name);
    public string? Str(string name) => Prop(name) is { } e ? (e.ValueKind == JsonValueKind.Null ? null : e.ToString()) : throw Missing(name);

    private InvalidOperationException Missing(string name) => new($"hub {Method} payload has no {name} property: {Payload}");
}

/// <summary>
/// A SignalR client sitting in the admin and rooms groups, the way
/// admin_web/pos_web do (src/pos_web/src/hooks/use-pos-notifications.ts),
/// recording every push so a scenario can assert the UI would have refreshed.
/// </summary>
public sealed class HubRecorder : IAsyncDisposable
{
    /// <summary>Every server-to-client method Notification.API sends (see its EventHandling folder).</summary>
    public static readonly string[] KnownMethods =
    [
        "TicketUpdated", "OrderStatusChanged", "RoomStatusChanged", "CatalogChanged",
        "StockLow", "ServiceRequestCreated", "ServiceRequestChanged", "BranchSettingsChanged",
        "AccountChanged", "PlaceCleared",
    ];

    private readonly HubConnection _connection;
    private readonly List<HubMessage> _records = [];
    private readonly Lock _lock = new();
    private long _seq;

    private HubRecorder(HubConnection connection) => _connection = connection;

    public HubConnectionState State => _connection.State;

    public static async Task<HubRecorder> ConnectAsync(Uri bffBaseAddress, Func<CancellationToken, Task<AccessToken>>? token,
        CancellationToken ct, bool joinAdmin = true, bool joinRooms = true, string? guestId = null)
    {
        var connection = new HubConnectionBuilder()
            .WithUrl(new Uri(bffBaseAddress, "hub/notifications"), options =>
            {
                options.Transports = HttpTransportType.WebSockets;
                if (token is not null)
                    options.AccessTokenProvider = async () => (await token(CancellationToken.None)).Value;
            })
            .WithAutomaticReconnect()
            .Build();

        var recorder = new HubRecorder(connection);
        foreach (var method in KnownMethods)
        {
            var name = method;
            connection.On<JsonElement>(name, payload => recorder.Record(name, payload));
        }

        await connection.StartAsync(ct);
        if (joinAdmin)
            await connection.InvokeAsync("JoinAdminGroup", ct);
        if (joinRooms)
            await connection.InvokeAsync("JoinRoomsGroup", ct);
        if (guestId is not null)
            await connection.InvokeAsync("JoinGuestGroup", guestId, ct);
        return recorder;
    }

    private void Record(string method, JsonElement payload)
    {
        lock (_lock)
        {
            _records.Add(new HubMessage(++_seq, method, payload.Clone(), DateTimeOffset.UtcNow));
        }
    }

    public Marker Mark()
    {
        lock (_lock)
        {
            return new Marker(_seq);
        }
    }

    public IReadOnlyList<HubMessage> Since(Marker since, string? method = null)
    {
        lock (_lock)
        {
            return _records.Where(r => r.Seq > since.Seq && (method is null || r.Method == method)).ToArray();
        }
    }

    public async Task<HubMessage> WaitForAsync(string method, Func<HubMessage, bool>? where, TimeSpan? timeout, CancellationToken ct, Marker? since = null)
    {
        var from = since ?? Marker.Start;
        HubMessage? found = null;
        await Eventually.Async(
            () => Task.FromResult((found = Since(from, method).FirstOrDefault(m => where is null || where(m))) is not null),
            $"hub push {method}{(where is null ? "" : " matching the predicate")}",
            ct, timeout, TimeSpan.FromMilliseconds(100));
        return found!;
    }

    public Task<HubMessage> WaitForAsync(string method, CancellationToken ct, Marker? since = null)
        => WaitForAsync(method, null, null, ct, since);

    public Task<HubMessage> WaitForAsync(string method, Func<HubMessage, bool> where, CancellationToken ct, Marker? since = null)
        => WaitForAsync(method, where, null, ct, since);

    /// <summary>OrderStatusChanged pushes carry a lowerCamel "type" such as order_submitted / order_confirmed / order_ready / order_cancelled.</summary>
    public Task<HubMessage> WaitForOrderStatusAsync(string type, CancellationToken ct, Marker? since = null, Func<HubMessage, bool>? where = null)
        => WaitForAsync("OrderStatusChanged", m => m.Str("type") == type && (where is null || where(m)), null, ct, since);

    /// <summary>RoomStatusChanged pushes carry a "type" such as session_started / session_ended / room_available / reservation_cancelled.</summary>
    public Task<HubMessage> WaitForRoomStatusAsync(string type, CancellationToken ct, Marker? since = null, Func<HubMessage, bool>? where = null)
        => WaitForAsync("RoomStatusChanged", m => m.Str("type") == type && (where is null || where(m)), null, ct, since);

    public async ValueTask DisposeAsync()
    {
        try { await _connection.StopAsync(); } catch (Exception) { /* hub may already be gone */ }
        await _connection.DisposeAsync();
    }
}
