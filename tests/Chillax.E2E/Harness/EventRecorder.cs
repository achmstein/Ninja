using System.Text;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using RabbitMQ.Client.Exceptions;

namespace Chillax.E2E.Harness;

/// <summary>One integration event as it crossed the bus. Wire JSON is PascalCase; property lookups here ignore case.</summary>
public sealed record RecordedEvent(long Seq, string Name, JsonElement Payload, string RawJson, DateTimeOffset ReceivedAt)
{
    public Guid Id => Prop("Id") is { } id && id.TryGetGuid(out var g) ? g : Guid.Empty;

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
    public long Long(string name) => Prop(name) is { ValueKind: JsonValueKind.Number } e ? e.GetInt64() : throw Missing(name);
    public decimal Dec(string name) => Prop(name) is { ValueKind: JsonValueKind.Number } e ? e.GetDecimal() : throw Missing(name);
    public bool Bool(string name) => Prop(name) is { ValueKind: JsonValueKind.True or JsonValueKind.False } e ? e.GetBoolean() : throw Missing(name);
    public string? Str(string name) => Prop(name) is { } e ? (e.ValueKind == JsonValueKind.Null ? null : e.ToString()) : throw Missing(name);
    public JsonElement[] Array(string name) => Prop(name) is { ValueKind: JsonValueKind.Array } e ? e.EnumerateArray().ToArray() : [];

    private InvalidOperationException Missing(string name) => new($"{Name} has no {name} property: {RawJson}");
}

/// <summary>
/// Sees everything published on the eshop_event_bus exchange. A direct
/// exchange delivers a copy to every queue whose binding matches, so an
/// extra exclusive queue bound to every known routing key observes the
/// traffic without taking anything away from the services.
/// </summary>
public sealed class EventRecorder : IAsyncDisposable
{
    public const string Exchange = "eshop_event_bus";

    private readonly IConnection _connection;
    private readonly IChannel _channel;
    private readonly List<RecordedEvent> _records = [];
    private readonly Lock _lock = new();
    private long _seq;

    private EventRecorder(IConnection connection, IChannel channel)
    {
        _connection = connection;
        _channel = channel;
    }

    public static async Task<EventRecorder> StartAsync(string amqpUri, IReadOnlyCollection<string> routingKeys, CancellationToken ct)
    {
        var factory = new ConnectionFactory { Uri = new Uri(amqpUri), ClientProvidedName = "chillax-e2e-recorder" };
        var connection = await factory.CreateConnectionAsync(ct);
        var channel = await connection.CreateChannelAsync(cancellationToken: ct);

        // Same declaration as RabbitMQEventBus: a differing durable flag is a 406 from the broker.
        await channel.ExchangeDeclareAsync(Exchange, "direct", durable: false, autoDelete: false, cancellationToken: ct);
        var queue = await channel.QueueDeclareAsync(queue: "", durable: false, exclusive: true, autoDelete: true, cancellationToken: ct);
        foreach (var key in routingKeys)
            await channel.QueueBindAsync(queue.QueueName, Exchange, key, cancellationToken: ct);

        var recorder = new EventRecorder(connection, channel);
        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += (_, ea) =>
        {
            recorder.Record(ea.RoutingKey, Encoding.UTF8.GetString(ea.Body.Span));
            return Task.CompletedTask;
        };
        await channel.BasicConsumeAsync(queue.QueueName, autoAck: true, consumer, ct);
        return recorder;
    }

    private void Record(string name, string json)
    {
        JsonElement payload;
        try
        {
            using var doc = JsonDocument.Parse(json);
            payload = doc.RootElement.Clone();
        }
        catch (JsonException)
        {
            payload = default;
        }

        lock (_lock)
        {
            _records.Add(new RecordedEvent(++_seq, name, payload, json, DateTimeOffset.UtcNow));
        }
    }

    public Marker Mark()
    {
        lock (_lock)
        {
            return new Marker(_seq);
        }
    }

    public IReadOnlyList<RecordedEvent> Since(Marker since, string? name = null)
    {
        var key = name is null ? null : Manifest.KnownEvents.Key(name);
        lock (_lock)
        {
            return _records.Where(r => r.Seq > since.Seq && (key is null || r.Name == key)).ToArray();
        }
    }

    public IReadOnlyList<RecordedEvent> All() => Since(Marker.Start);

    /// <summary>Waits for an event by short name ("TicketSettled") or routing key, optionally matching its payload.</summary>
    public async Task<RecordedEvent> WaitForAsync(string name, Func<RecordedEvent, bool>? where, TimeSpan? timeout, CancellationToken ct, Marker? since = null)
    {
        var from = since ?? Marker.Start;
        RecordedEvent? found = null;
        await Eventually.Async(
            () => Task.FromResult((found = Since(from, name).FirstOrDefault(e => where is null || where(e))) is not null),
            $"{Manifest.KnownEvents.Key(name)} on the bus{(where is null ? "" : " matching the predicate")}",
            ct, timeout, TimeSpan.FromMilliseconds(100));
        return found!;
    }

    public Task<RecordedEvent> WaitForAsync(string name, CancellationToken ct, Marker? since = null)
        => WaitForAsync(name, null, null, ct, since);

    public Task<RecordedEvent> WaitForAsync(string name, Func<RecordedEvent, bool> where, CancellationToken ct, Marker? since = null)
        => WaitForAsync(name, where, null, ct, since);

    public async Task<IReadOnlyList<RecordedEvent>> WaitForCountAsync(string name, int count, CancellationToken ct, Marker? since = null, TimeSpan? timeout = null)
    {
        var from = since ?? Marker.Start;
        await Eventually.Async(() => Task.FromResult(Since(from, name).Count >= count),
            $"{count} x {Manifest.KnownEvents.Key(name)} on the bus", ct, timeout, TimeSpan.FromMilliseconds(100));
        return Since(from, name);
    }

    /// <summary>Asserts that <paramref name="name"/> does NOT show up within a quiet period, for the paths that must stay silent.</summary>
    public async Task AssertNoneAsync(string name, Marker since, CancellationToken ct, TimeSpan? quietPeriod = null)
    {
        await Task.Delay(quietPeriod ?? TimeSpan.FromSeconds(3), ct);
        var seen = Since(since, name);
        if (seen.Count > 0)
            throw new Xunit.Sdk.XunitException($"Expected no {Manifest.KnownEvents.Key(name)} but saw {seen.Count}:\n{string.Join("\n", seen.Select(e => e.RawJson))}");
    }

    /// <summary>
    /// Services answer /health a moment before their consumer is bound, so the
    /// harness waits until every service queue has a consumer before letting
    /// scenarios publish anything.
    /// </summary>
    public async Task WaitForServiceQueuesAsync(IEnumerable<string> queues, TimeSpan timeout, CancellationToken ct)
    {
        var pending = queues.ToList();
        await Eventually.Async(async () =>
        {
            foreach (var queue in pending.ToArray())
            {
                // A passive declare of a missing queue closes the channel, so probe on a throwaway one.
                await using var probe = await _connection.CreateChannelAsync(cancellationToken: ct);
                try
                {
                    var ok = await probe.QueueDeclarePassiveAsync(queue, ct);
                    if (ok.ConsumerCount >= 1)
                        pending.Remove(queue);
                }
                catch (OperationInterruptedException)
                {
                    // not declared yet
                }
            }
            return pending.Count == 0;
        }, $"consumers on RabbitMQ queues: {string.Join(", ", pending)}", ct, timeout, TimeSpan.FromMilliseconds(500));

        // RabbitMQEventBus binds after BasicConsume; give the last bindings a moment.
        await Task.Delay(500, ct);
    }

    public async ValueTask DisposeAsync()
    {
        try { await _channel.CloseAsync(); } catch (Exception) { /* broker may already be gone */ }
        await _channel.DisposeAsync();
        try { await _connection.CloseAsync(); } catch (Exception) { /* ditto */ }
        await _connection.DisposeAsync();
    }
}
