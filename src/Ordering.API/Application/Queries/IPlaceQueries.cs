#nullable enable
using Chillax.Ordering.Infrastructure.Projections;

namespace Chillax.Ordering.API.Application.Queries;

/// <summary>Ordering's projection of the Spaces places (see <see cref="Place"/>).</summary>
public interface IPlaceQueries
{
    Task<Place?> FindAsync(int placeId);

    /// <summary>The place behind a room id from an older client (rooms kept their ids; the legacy id is checked too).</summary>
    Task<Place?> FindByRoomIdAsync(int roomId);

    /// <summary>The place behind the table id a printed sticker carries.</summary>
    Task<Place?> FindByTableIdAsync(int tableId);

    /// <summary>The place an order names, by whichever id the client sent: place first, then room, then table.</summary>
    Task<Place?> ResolveAsync(int? placeId, int? roomId, int? tableId);
}

public class PlaceQueries(OrderingContext context) : IPlaceQueries
{
    public async Task<Place?> FindAsync(int placeId)
        => await context.Places.AsNoTracking().FirstOrDefaultAsync(p => p.PlaceId == placeId);

    public async Task<Place?> FindByRoomIdAsync(int roomId)
        => await context.Places.AsNoTracking().FirstOrDefaultAsync(p => p.LegacyRoomId == roomId)
           ?? await context.Places.AsNoTracking().FirstOrDefaultAsync(p => p.PlaceId == roomId && p.Kind == "Room");

    public async Task<Place?> FindByTableIdAsync(int tableId)
        => await context.Places.AsNoTracking().FirstOrDefaultAsync(p => p.LegacyTableId == tableId)
           ?? await context.Places.AsNoTracking().FirstOrDefaultAsync(p => p.PlaceId == tableId && p.Kind == "Table");

    public async Task<Place?> ResolveAsync(int? placeId, int? roomId, int? tableId)
    {
        if (placeId is int id) return await FindAsync(id);
        if (roomId is int room) return await FindByRoomIdAsync(room);
        if (tableId is int table) return await FindByTableIdAsync(table);
        return null;
    }
}
