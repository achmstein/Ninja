using Ninja.E2E.Harness;
using Ninja.E2E.Support;

namespace Ninja.E2E.Actors;

/// <summary>
/// The kitchen display (src/kds_web) and the shop's print host (the till or
/// a kitchen tablet with "Print kitchen tickets" on). Both sign in with a
/// staff token — the same Pos policy the till uses.
/// </summary>
public sealed class KitchenActor(ApiClient api)
{
    public ApiClient Api { get; } = api;

    /// <summary>use-kitchen-orders.ts: confirmed orders of the last 24 h — one station's, or the pass.</summary>
    public Task<List<KitchenOrder>> BoardAsync(CancellationToken ct, int? stationId = null)
        => Api.GetAsync<List<KitchenOrder>>(stationId is null ? "/api/orders/kitchen" : $"/api/orders/kitchen?stationId={stationId}", ct);

    /// <summary>use-ready.ts on the pass: done (or bring it back with ready:false).</summary>
    public async Task MarkReadyAsync(int orderId, CancellationToken ct, bool ready = true)
    {
        using var r = await Api.PutAsync($"/api/orders/{orderId}/ready", new { ready }, ct);
    }

    /// <summary>use-ready.ts on a station's screen: its part done, or back.</summary>
    public async Task MarkStationReadyAsync(int orderId, int stationId, CancellationToken ct, bool ready = true)
    {
        using var r = await Api.PutAsync($"/api/orders/{orderId}/stations/{stationId}/ready", new { ready }, ct);
    }

    /// <summary>use-station.ts: the branch's stations.</summary>
    public Task<List<KitchenStation>> StationsAsync(CancellationToken ct)
        => Api.GetAsync<List<KitchenStation>>("/api/kitchen/stations", ct);

    // --- The print host: kitchen_printing.dart's queue ---------------------------

    public Task<List<KitchenTicket>> PrintJobsAsync(CancellationToken ct)
        => Api.GetAsync<List<KitchenTicket>>("/api/kitchen/print-jobs", ct);

    /// <summary>True when this device got the ticket; false when another holds it or it is printed.</summary>
    public async Task<bool> ClaimAsync(int jobId, string deviceId, CancellationToken ct)
    {
        using var r = await Api.PostAsync($"/api/kitchen/print-jobs/{jobId}/claim", new { deviceId }, ct, ensureSuccess: false);
        return r.IsSuccessStatusCode;
    }

    public async Task PrintedAsync(int jobId, CancellationToken ct)
    {
        using var r = await Api.PostAsync($"/api/kitchen/print-jobs/{jobId}/printed", null, ct);
    }

    /// <summary>The till's Kitchen tickets → Reprint.</summary>
    public async Task ReprintAsync(int orderId, CancellationToken ct)
    {
        using var r = await Api.PostAsync($"/api/orders/{orderId}/reprint", null, ct);
    }
}
