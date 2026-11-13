#nullable enable
using Ninja.Sales.Infrastructure;

namespace Ninja.Sales.API.Application.Queries;

/// <summary>
/// What a place is called, from Sales' copy of Spaces' places. The one thing a bill opened by hand
/// at a table reads its name from: the till says which table by its id, never what it is called.
/// </summary>
public interface IPlaceNames
{
    /// <summary>A copy of the place's name to keep on a bill; null for a place never heard of.</summary>
    Task<LocalizedText?> OfAsync(int placeId, CancellationToken ct = default);
}

public class PlaceNames(SalesContext context) : IPlaceNames
{
    public async Task<LocalizedText?> OfAsync(int placeId, CancellationToken ct = default)
    {
        var row = await context.Places.AsNoTracking().FirstOrDefaultAsync(p => p.PlaceId == placeId, ct);
        return row is null ? null : new LocalizedText(row.Name.En, row.Name.Ar);
    }
}
