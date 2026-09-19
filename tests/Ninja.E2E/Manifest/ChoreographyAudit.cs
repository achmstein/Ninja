using Ninja.E2E.Harness;

namespace Ninja.E2E.Manifest;

/// <summary>
/// The end-of-day audit: every outbox row left the box, every event the day
/// should have produced was seen on the bus and nothing unknown was, every
/// push the screens rely on went out, and no handler failed along the way.
/// </summary>
public static class ChoreographyAudit
{
    public sealed record HubExpectation(string Method, string? Type = null)
    {
        public override string ToString() => Type is null ? Method : $"{Method}[{Type}]";
    }

    public static readonly HubExpectation[] ExpectedInFullDay =
    [
        new("BranchSettingsChanged"),
        new("TicketUpdated"),
        new("OrderStatusChanged", "order_submitted"),
        new("OrderStatusChanged", "order_confirmed"),
        new("OrderStatusChanged", "order_ready"),
        new("OrderStatusChanged", "order_cancelled"),
        new("RoomStatusChanged", "session_started"),
        new("RoomStatusChanged", "session_ended"),
        new("RoomStatusChanged", "room_available"),
        new("RoomStatusChanged", "reservation_cancelled"),
        new("CatalogChanged"),
        new("StockLow"),
        new("ServiceRequestCreated"),
    ];

    public static async Task RunAsync(NinjaApp app, Checkpoint since, CancellationToken ct,
        IEnumerable<string>? expectedEvents = null, IEnumerable<HubExpectation>? expectedHub = null, IEnumerable<string>? ignoreLogRegex = null)
    {
        var problems = new List<string>();

        // 1. Outbox: nothing stuck in NotPublished / InProgress / PublishedFailed.
        try
        {
            await app.Outbox.AssertAllPublishedAsync(since.UtcNow, ct);
        }
        catch (Xunit.Sdk.XunitException ex)
        {
            problems.Add(ex.Message);
        }

        // 2. Bus: the expected set was seen, and nothing outside the manifest.
        var seen = app.Events.Since(since.Events).Select(e => e.Name).ToHashSet(StringComparer.Ordinal);
        var expected = (expectedEvents ?? KnownEvents.ExpectedInFullDay).Select(KnownEvents.Key).ToHashSet(StringComparer.Ordinal);
        var missing = expected.Except(seen).Order().ToList();
        if (missing.Count > 0)
            problems.Add($"Events expected but never seen on the bus: {string.Join(", ", missing)}");
        var unknown = seen.Except(KnownEvents.All).Except(KnownEvents.Tolerated).Order().ToList();
        if (unknown.Count > 0)
            problems.Add($"Events seen on the bus that KnownEvents does not list: {string.Join(", ", unknown)}");

        // 3. Hub: every push the screens refresh on.
        var pushes = app.Hub.Since(since.Hub);
        var missingPushes = (expectedHub ?? ExpectedInFullDay)
            .Where(x => !pushes.Any(p => p.Method == x.Method && (x.Type is null || p.Str("type") == x.Type)))
            .Select(x => x.ToString())
            .ToList();
        if (missingPushes.Count > 0)
            problems.Add($"Hub pushes expected but never received: {string.Join(", ", missingPushes)}");

        // 4. Logs: no handler threw (the bus would have ACKed and dropped the message).
        var failures = app.Logs.Failures(since.Logs, ignoreLogRegex);
        if (failures.Count > 0)
            problems.Add($"{failures.Count} failure(s) in service logs:\n{string.Join("\n\n", failures)}");

        if (problems.Count > 0)
            throw new Xunit.Sdk.XunitException("Choreography audit failed:\n\n" + string.Join("\n\n", problems));
    }
}
