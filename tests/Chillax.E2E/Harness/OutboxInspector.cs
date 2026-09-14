using Npgsql;

namespace Chillax.E2E.Harness;

/// <summary>A row of a service's IntegrationEventLog outbox (src/IntegrationEventLogEF).</summary>
public sealed record OutboxRow(string Database, Guid EventId, string EventTypeName, int State, int TimesSent, DateTime CreationTime, string Content)
{
    public string EventTypeShortName => EventTypeName.Split('.')[^1];

    public string StateName => State switch
    {
        0 => "NotPublished",
        1 => "InProgress",
        2 => "Published",
        3 => "PublishedFailed",
        _ => State.ToString(System.Globalization.CultureInfo.InvariantCulture),
    };
}

/// <summary>
/// Reads the outbox tables directly. A row that never reaches Published means
/// the service committed its transaction but the event never left the box.
/// </summary>
public sealed class OutboxInspector(IReadOnlyDictionary<string, string> connectionStrings)
{
    public const int Published = 2;

    private readonly Dictionary<string, string?> _schemas = [];
    private readonly Lock _lock = new();

    public async Task<IReadOnlyList<OutboxRow>> RowsSinceAsync(string database, DateTime sinceUtc, CancellationToken ct)
    {
        var schema = await SchemaAsync(database, ct);
        if (schema is null)
            return [];

        await using var conn = new NpgsqlConnection(connectionStrings[database]);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"""
            SELECT "EventId", "EventTypeName", "State", "TimesSent", "CreationTime", "Content"
            FROM "{schema}"."IntegrationEventLog"
            WHERE "CreationTime" >= @since
            ORDER BY "CreationTime"
            """;
        cmd.Parameters.AddWithValue("since", DateTime.SpecifyKind(sinceUtc, DateTimeKind.Utc));

        var rows = new List<OutboxRow>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            rows.Add(new OutboxRow(database, reader.GetGuid(0), reader.GetString(1), reader.GetInt32(2), reader.GetInt32(3),
                reader.GetDateTime(4), reader.IsDBNull(5) ? "" : reader.GetString(5)));
        }
        return rows;
    }

    public async Task<IReadOnlyList<string>> EventNamesAsync(string database, DateTime sinceUtc, CancellationToken ct)
        => (await RowsSinceAsync(database, sinceUtc, ct)).Select(r => r.EventTypeShortName).Distinct().ToArray();

    public async Task<IReadOnlyDictionary<int, int>> CountByStateAsync(string database, DateTime sinceUtc, CancellationToken ct)
        => (await RowsSinceAsync(database, sinceUtc, ct)).GroupBy(r => r.State).ToDictionary(g => g.Key, g => g.Count());

    /// <summary>
    /// Every outbox row written since <paramref name="sinceUtc"/> in every
    /// outbox database must be Published. Waits a little: the publish happens
    /// right after commit, but not inside it.
    /// </summary>
    public async Task AssertAllPublishedAsync(DateTime sinceUtc, CancellationToken ct, TimeSpan? timeout = null)
    {
        List<OutboxRow> stuck = [];
        try
        {
            await Eventually.Async(async () =>
            {
                stuck = [];
                foreach (var db in KnownResources.OutboxDatabases)
                    stuck.AddRange((await RowsSinceAsync(db, sinceUtc, ct)).Where(r => r.State != Published));
                return stuck.Count == 0;
            }, "every outbox row to be Published", ct, timeout ?? TimeSpan.FromSeconds(30), TimeSpan.FromSeconds(1));
        }
        catch (TimeoutException ex)
        {
            var lines = stuck.Select(r =>
                $"  {r.Database} {r.EventTypeShortName} state={r.StateName} timesSent={r.TimesSent} created={r.CreationTime:O}\n    {Truncate(r.Content, 300)}");
            throw new Xunit.Sdk.XunitException($"{stuck.Count} outbox row(s) never published:\n{string.Join("\n", lines)}", ex);
        }
    }

    private async Task<string?> SchemaAsync(string database, CancellationToken ct)
    {
        lock (_lock)
        {
            if (_schemas.TryGetValue(database, out var known))
                return known;
        }

        await using var conn = new NpgsqlConnection(connectionStrings[database]);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT table_schema FROM information_schema.tables WHERE table_name = 'IntegrationEventLog' LIMIT 1";
        var schema = await cmd.ExecuteScalarAsync(ct) as string;

        lock (_lock)
        {
            _schemas[database] = schema;
        }
        return schema;
    }

    private static string Truncate(string s, int max)
    {
        var flat = s.Replace("\r", "").Replace("\n", " ");
        return flat.Length <= max ? flat : flat[..max] + "…";
    }
}
