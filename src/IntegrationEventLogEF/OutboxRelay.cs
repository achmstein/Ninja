using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Ninja.EventBus.Abstractions;
using Ninja.IntegrationEventLogEF.Services;

namespace Ninja.IntegrationEventLogEF;

/// <summary>
/// Sends what the outbox kept but never sent. A service saves an event with
/// the change it describes, then publishes it straight after; if the publish
/// throws, or the process dies between the two, the event stays in the log
/// and nothing else would ever send it — an order would wait for the menu
/// check forever. Every half minute this republishes events older than a
/// minute (the straight-after publish has long had its chance), a few tries
/// each. One that used them all up (the broker was out for longer) is tried
/// again every few minutes for three days, so an outage delays an event but
/// never strands it. A consumer may so hear an event twice, which every
/// handler already has to bear: the bus delivers at least once.
/// </summary>
public sealed class OutboxRelay(
    IServiceScopeFactory scopes,
    ILogger<OutboxRelay> logger) : BackgroundService
{
    public static readonly TimeSpan Interval = TimeSpan.FromSeconds(30);
    public static readonly TimeSpan Grace = TimeSpan.FromMinutes(1);
    public const int MaxAttempts = 10;

    /// <summary>How often, in passes, the events past their quick tries are tried again (every five minutes)</summary>
    public const int ParkedEvery = 10;

    /// <summary>How long an event past its quick tries is still worth sending</summary>
    public static readonly TimeSpan ParkedFor = TimeSpan.FromDays(3);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        var pass = 0;
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await RelayOnceAsync(DateTime.UtcNow, parked: ++pass % ParkedEvery == 0);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "The outbox relay failed; it tries again in {Interval}", Interval);
            }
        }
    }

    /// <summary>One pass: every stuck event, published and marked, or marked failed for the next pass.</summary>
    public async Task<int> RelayOnceAsync(DateTime utcNow, bool parked = false)
    {
        using var scope = scopes.CreateScope();
        var log = scope.ServiceProvider.GetRequiredService<IIntegrationEventLogService>();
        var bus = scope.ServiceProvider.GetRequiredService<IEventBus>();

        var sent = 0;
        var due = (await log.RetrieveStuckEventLogsAsync(utcNow - Grace, MaxAttempts)).ToList();
        if (parked) due.AddRange(await log.RetrieveParkedEventLogsAsync(utcNow - ParkedFor, MaxAttempts));
        foreach (var entry in due)
        {
            try
            {
                await log.MarkEventAsInProgressAsync(entry.EventId);
                await bus.PublishAsync(entry.IntegrationEvent);
                await log.MarkEventAsPublishedAsync(entry.EventId);
                sent++;
                logger.LogWarning("Relayed integration event {IntegrationEventId} ({EventType}) that was never sent", entry.EventId, entry.EventTypeShortName);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Relaying integration event {IntegrationEventId} failed (try {Attempt})", entry.EventId, entry.TimesSent);
                await log.MarkEventAsFailedAsync(entry.EventId);
            }
        }
        return sent;
    }
}

public static class OutboxRelayExtensions
{
    /// <summary>Republish what this service's outbox kept but never sent (<see cref="OutboxRelay"/>).</summary>
    public static IServiceCollection AddOutboxRelay(this IServiceCollection services)
    {
        services.AddSingleton<OutboxRelay>();
        services.AddHostedService(sp => sp.GetRequiredService<OutboxRelay>());
        return services;
    }
}
