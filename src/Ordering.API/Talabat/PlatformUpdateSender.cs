#nullable enable
using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.Options;

namespace Ninja.Ordering.API.Talabat;

/// <summary>
/// How this stack reaches Talabat: through the platform, which holds Ninja's
/// Talabat credentials (one set for every business) and signs the call. The
/// control plane stamps these; without them nothing is sent.
/// </summary>
public sealed class TalabatOptions
{
    public const string Section = "Talabat";

    /// <summary>The platform's relay, on the shared network: http://control-api:8080.</summary>
    public string? RelayUrl { get; set; }

    /// <summary>This business's slug, which the relay knows it by.</summary>
    public string? Tenant { get; set; }

    /// <summary>This business's key to the relay, derived by the platform from the slug; it proves the caller is this stack.</summary>
    public string? RelayKey { get; set; }

    public bool Configured => !string.IsNullOrWhiteSpace(RelayUrl) && !string.IsNullOrWhiteSpace(Tenant) && !string.IsNullOrWhiteSpace(RelayKey);
}

/// <summary>One change for the relay to pass on to Talabat.</summary>
public sealed record PlatformRelayRequest(string Token, string Kind, string Url, string RemoteOrderId, string? Reason, DateTime? AcceptanceTime);

/// <summary>
/// Sends the queued changes to the platform, oldest first, and retries until
/// the platform takes each one. An acceptance Talabat is not ready for yet
/// (409 while it is still dispatching) is tried again for a few minutes, as
/// its documentation asks; one refused for good, or older than an hour, is
/// given up with the reason kept.
/// </summary>
public sealed class PlatformUpdateSender(
    IServiceScopeFactory scopes,
    IHttpClientFactory http,
    IOptions<TalabatOptions> options,
    ILogger<PlatformUpdateSender> logger) : BackgroundService
{
    public const string HttpClientName = "talabat-relay";
    public const string TenantHeader = "X-Ninja-Tenant";
    public const string KeyHeader = "X-Ninja-Relay-Key";

    private static readonly TimeSpan Idle = TimeSpan.FromSeconds(3);
    private static readonly TimeSpan GiveUpAfter = TimeSpan.FromHours(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SendDueAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "Sending platform updates failed; trying again shortly");
            }

            try
            {
                await Task.Delay(Idle, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }
    }

    private async Task SendDueAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<OrderingContext>();
        var now = DateTime.UtcNow;

        var due = await context.PlatformUpdates
            .Where(u => u.SentAt == null && u.AbandonedAt == null && u.NextAttemptAt <= now)
            .OrderBy(u => u.Id)
            .Take(20)
            .ToListAsync(ct);
        if (due.Count == 0)
            return;

        var relay = options.Value;
        foreach (var update in due)
        {
            if (now - update.CreatedAt > GiveUpAfter)
            {
                Abandon(update, now, update.LastError ?? "Never reached the platform within the hour.");
                continue;
            }

            if (!relay.Configured)
            {
                Retry(update, now, "This stack has no Talabat relay; the control plane stamps one when the platform has Talabat credentials.");
                continue;
            }

            try
            {
                var (status, body) = await SendAsync(relay, update, ct);
                if (status is >= 200 and < 300)
                {
                    update.SentAt = now;
                    update.Attempts++;
                    logger.LogInformation("Told {Platform} order {OrderId} was {Kind}", update.Platform, update.OrderId, update.Kind);
                }
                else if (status == (int)HttpStatusCode.Conflict && update.Kind == PlatformUpdateKind.Accepted && now - update.CreatedAt < TimeSpan.FromMinutes(5))
                {
                    // Talabat has not finished dispatching it: every ten seconds, for five minutes
                    Retry(update, now, $"409: {body}", TimeSpan.FromSeconds(10));
                }
                else if (status is (int)HttpStatusCode.Conflict or (int)HttpStatusCode.BadRequest or (int)HttpStatusCode.NotFound or (int)HttpStatusCode.Forbidden)
                {
                    Abandon(update, now, $"{status}: {body}");
                }
                else
                {
                    Retry(update, now, $"{status}: {body}");
                }
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
            {
                Retry(update, now, ex.Message);
            }
        }

        await context.SaveChangesAsync(ct);
    }

    private async Task<(int Status, string Body)> SendAsync(TalabatOptions relay, PlatformUpdate update, CancellationToken ct)
    {
        var client = http.CreateClient(HttpClientName);
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{relay.RelayUrl!.TrimEnd('/')}/api/talabat/relay/status")
        {
            Content = JsonContent.Create(new PlatformRelayRequest(
                update.Token,
                update.Kind.ToString(),
                update.Url,
                update.OrderId.ToString(),
                update.Reason,
                update.AcceptanceTime)),
        };
        request.Headers.Add(TenantHeader, relay.Tenant);
        request.Headers.Add(KeyHeader, relay.RelayKey);

        using var response = await client.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        return ((int)response.StatusCode, body.Length > 500 ? body[..500] : body);
    }

    private void Retry(PlatformUpdate update, DateTime now, string error, TimeSpan? after = null)
    {
        update.Attempts++;
        update.LastError = error.Length > 1000 ? error[..1000] : error;
        // 5s, 10s, 20s … up to two minutes between tries
        update.NextAttemptAt = now + (after ?? TimeSpan.FromSeconds(Math.Min(120, 5 * Math.Pow(2, Math.Min(update.Attempts - 1, 5)))));
        logger.LogWarning("{Platform} update {Kind} for order {OrderId} not taken ({Error}); trying again at {Next:u}", update.Platform, update.Kind, update.OrderId, update.LastError, update.NextAttemptAt);
    }

    private void Abandon(PlatformUpdate update, DateTime now, string error)
    {
        update.Attempts++;
        update.AbandonedAt = now;
        update.LastError = error.Length > 1000 ? error[..1000] : error;
        logger.LogError("{Platform} update {Kind} for order {OrderId} given up: {Error}", update.Platform, update.Kind, update.OrderId, update.LastError);
    }
}
