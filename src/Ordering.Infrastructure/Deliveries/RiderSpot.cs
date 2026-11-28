#nullable enable
using System.Text.Json;

namespace Ninja.Ordering.Infrastructure.Deliveries;

/// <summary>
/// Where a rider's phone last said it was, while it has a delivery out: one
/// row per rider, written over with every report (about every 20 seconds).
/// Kept here and never on the order: a report must not touch the order's row,
/// which the till may be editing at the same moment. With it, the progress
/// each customer was last told for the deliveries the rider has out, so a
/// customer hears of a real move and not of every report. The customer is
/// never given the point itself.
/// </summary>
public class RiderSpot
{
    /// <summary>The rider's account (the token's subject).</summary>
    public string RiderUserId { get; set; } = string.Empty;

    public double Latitude { get; set; }

    public double Longitude { get; set; }

    /// <summary>When the phone said so.</summary>
    public DateTime At { get; set; }

    /// <summary>The progress last told, 0 to 100, by order: JSON, {"482":40}. Only the deliveries still out are kept.</summary>
    public string Told { get; set; } = "{}";

    private Dictionary<int, int> ReadTold()
    {
        try
        {
            return JsonSerializer.Deserialize<Dictionary<int, int>>(Told) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    /// <summary>The progress the order's customer was last told; 0 before any.</summary>
    public int ToldFor(int orderId) => ReadTold().GetValueOrDefault(orderId);

    /// <summary>Remembers what each customer was now told, and forgets every delivery no longer out.</summary>
    public void Tell(IReadOnlyDictionary<int, int> told, IReadOnlyCollection<int> stillOut)
    {
        var kept = ReadTold().Where(t => stillOut.Contains(t.Key)).ToDictionary(t => t.Key, t => t.Value);
        foreach (var (orderId, points) in told)
        {
            if (stillOut.Contains(orderId))
                kept[orderId] = Math.Max(points, kept.GetValueOrDefault(orderId));
        }
        Told = JsonSerializer.Serialize(kept);
    }
}
