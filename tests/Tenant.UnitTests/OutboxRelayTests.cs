using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.EventBus.Abstractions;
using Ninja.EventBus.Events;
using Ninja.IntegrationEventLogEF;
using Ninja.IntegrationEventLogEF.Services;

namespace Tenant.UnitTests;

/// <summary>
/// An event that used up its quick tries while the broker was out is tried
/// again on the slow pass, for three days, rather than left for nobody to send.
/// </summary>
[TestClass]
public class OutboxRelayTests
{
    private sealed record Happened : IntegrationEvent;

    private static IntegrationEventLogEntry Entry(int timesSent, DateTime created)
    {
        var @event = new Happened { CreationDate = created };
        var entry = new IntegrationEventLogEntry(@event, Guid.NewGuid()) { State = EventStateEnum.PublishedFailed, TimesSent = timesSent };
        return entry.DeserializeJsonContent(typeof(Happened));
    }

    private static (OutboxRelay Relay, Log Log, Bus Bus) Relay(params IntegrationEventLogEntry[] entries)
    {
        var log = new Log(entries);
        var bus = new Bus();
        var services = new ServiceCollection()
            .AddSingleton<IIntegrationEventLogService>(log)
            .AddSingleton<IEventBus>(bus)
            .BuildServiceProvider();
        return (new OutboxRelay(services.GetRequiredService<IServiceScopeFactory>(), NullLogger<OutboxRelay>.Instance), log, bus);
    }

    [TestMethod]
    public async Task An_event_past_its_quick_tries_waits_for_the_slow_pass_and_then_goes()
    {
        var now = new DateTime(2026, 11, 25, 2, 0, 0, DateTimeKind.Utc);
        var parked = Entry(OutboxRelay.MaxAttempts, now.AddHours(-1));
        var (relay, _, bus) = Relay(parked);

        Assert.AreEqual(0, await relay.RelayOnceAsync(now), "the quick pass leaves it alone");
        Assert.AreEqual(1, await relay.RelayOnceAsync(now, parked: true));
        Assert.AreEqual(parked.EventId, bus.Published.Single().Id);
        Assert.AreEqual(EventStateEnum.Published, parked.State);
    }

    [TestMethod]
    public async Task An_event_older_than_three_days_is_not_sent_any_more()
    {
        var now = new DateTime(2026, 11, 25, 2, 0, 0, DateTimeKind.Utc);
        var (relay, _, bus) = Relay(Entry(OutboxRelay.MaxAttempts, now - OutboxRelay.ParkedFor - TimeSpan.FromMinutes(1)));

        Assert.AreEqual(0, await relay.RelayOnceAsync(now, parked: true));
        Assert.AreEqual(0, bus.Published.Count);
    }

    /// <summary>The outbox's queries, over a list, as the EF one asks them.</summary>
    private sealed class Log(IEnumerable<IntegrationEventLogEntry> entries) : IIntegrationEventLogService
    {
        private readonly List<IntegrationEventLogEntry> _entries = [.. entries];

        public Task<IEnumerable<IntegrationEventLogEntry>> RetrieveEventLogsPendingToPublishAsync(Guid transactionId) => Task.FromResult(Enumerable.Empty<IntegrationEventLogEntry>());

        public Task<IEnumerable<IntegrationEventLogEntry>> RetrieveStuckEventLogsAsync(DateTime createdBefore, int maxAttempts) =>
            Task.FromResult(_entries.Where(e => e.State != EventStateEnum.Published && e.CreationTime < createdBefore && e.TimesSent < maxAttempts).ToList().AsEnumerable());

        public Task<IEnumerable<IntegrationEventLogEntry>> RetrieveParkedEventLogsAsync(DateTime createdAfter, int minAttempts) =>
            Task.FromResult(_entries.Where(e => e.State != EventStateEnum.Published && e.CreationTime > createdAfter && e.TimesSent >= minAttempts).ToList().AsEnumerable());

        public Task SaveEventAsync(IntegrationEvent @event, Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction) => Task.CompletedTask;
        public Task MarkEventAsPublishedAsync(Guid eventId) => Set(eventId, EventStateEnum.Published);
        public Task MarkEventAsInProgressAsync(Guid eventId) => Set(eventId, EventStateEnum.InProgress);
        public Task MarkEventAsFailedAsync(Guid eventId) => Set(eventId, EventStateEnum.PublishedFailed);

        private Task Set(Guid eventId, EventStateEnum state)
        {
            _entries.Single(e => e.EventId == eventId).State = state;
            return Task.CompletedTask;
        }
    }

    private sealed class Bus : IEventBus
    {
        public List<IntegrationEvent> Published { get; } = [];

        public Task PublishAsync(IntegrationEvent @event)
        {
            Published.Add(@event);
            return Task.CompletedTask;
        }
    }
}
