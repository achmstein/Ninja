using Ninja.E2E.Harness;
using Ninja.E2E.Support;

namespace Ninja.E2E.Actors;

/// <summary>
/// The kitchen display (src/kds_web): one board, one move. It signs in with
/// a staff token — the same Pos policy the till uses.
/// </summary>
public sealed class KitchenActor(ApiClient api)
{
    public ApiClient Api { get; } = api;

    /// <summary>use-kitchen-orders.ts: confirmed orders of the last 24 h.</summary>
    public Task<List<KitchenOrder>> BoardAsync(CancellationToken ct)
        => Api.GetAsync<List<KitchenOrder>>("/api/orders/kitchen", ct);

    /// <summary>use-ready.ts: done (or bring it back with ready:false).</summary>
    public async Task MarkReadyAsync(int orderId, CancellationToken ct, bool ready = true)
    {
        using var r = await Api.PutAsync($"/api/orders/{orderId}/ready", new { ready }, ct);
    }
}
