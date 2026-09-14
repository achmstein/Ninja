using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.Extensions.DependencyInjection;

namespace Chillax.E2E.Harness;

public sealed record LogRecord(long Seq, string Resource, DateTimeOffset? Timestamp, string Text, bool IsStdErr);

public sealed record LogFailure(LogRecord Line, IReadOnlyList<LogRecord> Context)
{
    public override string ToString()
        => $"[{Line.Resource}] {Line.Text}" + (Context.Count == 0 ? "" : "\n" + string.Join("\n", Context.Select(c => "    " + c.Text)));
}

/// <summary>
/// Tails every resource's log through Aspire's ResourceLoggerService. The
/// bus ACKs a message even when the handler throws, so the warning
/// RabbitMQEventBus writes at that moment is the only trace of a lost event;
/// this is where the suite looks for it.
/// </summary>
public sealed partial class LogRecorder(DistributedApplication app)
{
    /// <summary>Lines that mean a service failed at something the scenarios rely on.</summary>
    public static readonly Regex[] FailurePatterns =
    [
        LevelMarker(),                                             // fail: / crit: from the console formatter
        new(@"Error Processing message", RegexOptions.Compiled),   // RabbitMQEventBus: handler threw, message ACKed and lost
        new(@"Unable to resolve event type for event name", RegexOptions.Compiled),
        new(@"Error with RabbitMQ consumer channel", RegexOptions.Compiled),
        new(@"Error starting RabbitMQ connection", RegexOptions.Compiled),
        new(@"An error occurred while migrating", RegexOptions.Compiled),
        new(@"Unhandled exception", RegexOptions.Compiled),
    ];

    /// <summary>
    /// Blocks that are "fail:" by level but expected: EF probes __EFMigrationsHistory
    /// before the first migration creates it and logs the miss as a failure.
    /// </summary>
    public static readonly string[] DefaultIgnore = [@"__EFMigrationsHistory"];

    private readonly List<LogRecord> _records = [];
    private readonly Lock _lock = new();
    private readonly CancellationTokenSource _stop = new();
    private readonly List<Task> _watchers = [];
    private long _seq;

    /// <summary>Call after <c>app.StartAsync()</c>; resource instance names only exist once DCP has created them.</summary>
    public void Start(IEnumerable<string> resourceNames)
    {
        var model = app.Services.GetRequiredService<DistributedApplicationModel>();
        var logs = app.Services.GetRequiredService<ResourceLoggerService>();
        foreach (var name in resourceNames)
        {
            var resource = model.Resources.FirstOrDefault(r => r.Name == name)
                ?? throw new InvalidOperationException($"No resource named {name} in the application model");
            _watchers.Add(Task.Run(() => WatchAsync(resource, logs, _stop.Token)));
        }
    }

    private async Task WatchAsync(IResource resource, ResourceLoggerService logs, CancellationToken ct)
    {
        try
        {
            await foreach (var batch in logs.WatchAsync(resource).WithCancellation(ct))
            {
                lock (_lock)
                {
                    foreach (var line in batch)
                        _records.Add(Parse(resource.Name, line));
                }
            }
        }
        catch (OperationCanceledException)
        {
            // stopped
        }
    }

    private LogRecord Parse(string resource, LogLine line)
    {
        // Content is "<ISO-8601 timestamp> <text>" for DCP-sourced lines, and the
        // console formatter colours the level marker with ANSI escapes.
        var content = AnsiEscape().Replace(line.Content, "");
        DateTimeOffset? ts = null;
        var text = content;
        var space = content.IndexOf(' ', StringComparison.Ordinal);
        if (space > 0 && DateTimeOffset.TryParse(content[..space], CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var parsed))
        {
            ts = parsed;
            text = content[(space + 1)..];
        }
        return new LogRecord(++_seq, resource, ts, text, line.IsErrorMessage);
    }

    public Marker Mark()
    {
        lock (_lock)
        {
            return new Marker(_seq);
        }
    }

    public IReadOnlyList<LogRecord> Since(Marker since, string? resource = null)
    {
        lock (_lock)
        {
            return _records.Where(r => r.Seq > since.Seq && (resource is null || r.Resource == resource)).ToArray();
        }
    }

    /// <summary>
    /// Failure lines since the marker, each with the indented continuation
    /// lines (stack trace) that followed it. Ignore patterns are matched
    /// against the whole block, marker line plus context.
    /// </summary>
    public IReadOnlyList<LogFailure> Failures(Marker since, IEnumerable<string>? ignoreRegex = null)
    {
        var ignore = DefaultIgnore.Concat(ignoreRegex ?? []).Select(p => new Regex(p)).ToArray();
        var lines = Since(since);
        var failures = new List<LogFailure>();
        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            if (!FailurePatterns.Any(p => p.IsMatch(line.Text)))
                continue;

            var context = new List<LogRecord>();
            for (var j = i + 1; j < lines.Count && context.Count < 40; j++)
            {
                if (lines[j].Resource != line.Resource)
                    continue;
                if (AnyLevelMarker().IsMatch(lines[j].Text))
                    break;
                context.Add(lines[j]);
            }

            var block = line.Text + "\n" + string.Join("\n", context.Select(c => c.Text));
            if (ignore.Any(p => p.IsMatch(block)))
                continue;
            failures.Add(new LogFailure(line, context));
        }
        return failures;
    }

    public void AssertNoHandlerFailures(Marker since, params string[] ignoreRegex)
    {
        var failures = Failures(since, ignoreRegex);
        if (failures.Count > 0)
            throw new Xunit.Sdk.XunitException($"{failures.Count} failure(s) in service logs:\n{string.Join("\n\n", failures)}");
    }

    public string Dump(string resource, int tail = 200)
    {
        var lines = Since(Marker.Start, resource);
        return string.Join("\n", lines.Skip(Math.Max(0, lines.Count - tail)).Select(l => $"[{resource}] {l.Text}"));
    }

    public string DumpAll(int tail = 80)
    {
        var names = Since(Marker.Start).Select(l => l.Resource).Distinct();
        return string.Join("\n\n", names.Select(n => Dump(n, tail)));
    }

    public void Stop()
    {
        _stop.Cancel();
    }

    [GeneratedRegex(@"\x1B\[[0-9;]*[A-Za-z]", RegexOptions.Compiled)]
    private static partial Regex AnsiEscape();

    [GeneratedRegex(@"^(fail|crit): ", RegexOptions.Compiled)]
    private static partial Regex LevelMarker();

    [GeneratedRegex(@"^(trce|dbug|info|warn|fail|crit): ", RegexOptions.Compiled)]
    private static partial Regex AnyLevelMarker();
}
