#nullable enable
namespace Ninja.Ordering.Domain.AggregatesModel.KitchenAggregate;

/// <summary>
/// A branch's stations as one answer to "who makes this line": the station
/// that claims the line's category, else the default one. Built from the
/// branch's stations as they stand when an order is confirmed.
/// </summary>
public class KitchenRouting
{
    private readonly Dictionary<int, KitchenStation> _byCategory = new();

    public KitchenStation Default { get; }

    public KitchenRouting(IEnumerable<KitchenStation> stations)
    {
        var list = stations.ToList();
        Default = list.SingleOrDefault(s => s.IsDefault)
            ?? throw new OrderingDomainException("A branch's kitchen needs a default station.");

        foreach (var station in list)
        {
            foreach (var categoryId in station.CategoryIds)
            {
                // Saving a station refuses a category another one holds; if
                // two ever did, the first in display order keeps it
                _byCategory.TryAdd(categoryId, station);
            }
        }
    }

    public KitchenStation StationFor(int? categoryId) =>
        categoryId is { } id && _byCategory.TryGetValue(id, out var station) ? station : Default;

    /// <summary>
    /// Every category in <paramref name="categoryIds"/> that a station other
    /// than <paramref name="stationId"/> already makes — what saving that
    /// station would steal. <paramref name="stationId"/> is null for a new one.
    /// </summary>
    public static IReadOnlyList<int> TakenCategories(IEnumerable<KitchenStation> stations, int? stationId, IEnumerable<int> categoryIds)
    {
        var taken = stations
            .Where(s => s.Id != stationId)
            .SelectMany(s => s.CategoryIds)
            .ToHashSet();
        return categoryIds.Where(taken.Contains).Distinct().ToList();
    }
}
