#nullable enable
using Ninja.Ordering.Infrastructure.Projections;

namespace Ninja.Ordering.API.Application.Queries;

/// <summary>Ordering's projection of the Spaces places (see <see cref="Place"/>).</summary>
public interface IPlaceQueries
{
    Task<Place?> FindAsync(int placeId);
}

public class PlaceQueries(OrderingContext context) : IPlaceQueries
{
    public async Task<Place?> FindAsync(int placeId)
        => await context.Places.AsNoTracking().FirstOrDefaultAsync(p => p.PlaceId == placeId);
}
