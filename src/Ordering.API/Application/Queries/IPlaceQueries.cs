#nullable enable
using Ninja.Ordering.Infrastructure.Projections;

namespace Ninja.Ordering.API.Application.Queries;

/// <summary>Ordering's projection of the Spaces places (see <see cref="Place"/>).</summary>
public interface IPlaceQueries
{
    Task<Place?> FindAsync(int placeId);

    /// <summary>
    /// LEGACY(places): resolves an old room id — remove when the printed room/table stickers are reprinted with /p/{id}.
    /// The place behind a room id from an older client (rooms kept their ids; the legacy id is checked too).
    /// </summary>
    Task<Place?> FindByRoomIdAsync(int roomId);

    /// <summary>
    /// LEGACY(places): resolves an old table id — remove when the printed room/table stickers are reprinted with /p/{id}.
    /// The place behind the table id a printed sticker carries.
    /// </summary>
    Task<Place?> FindByTableIdAsync(int tableId);

    /// <summary>
    /// LEGACY(places): the roomId/tableId fallbacks resolve an old room/table id — remove when the printed room/table stickers are reprinted with /p/{id}.
    /// The place an order names, by whichever id the client sent: place first, then room, then table.
    /// </summary>
    Task<Place?> ResolveAsync(int? placeId, int? roomId, int? tableId);
}

public class PlaceQueries(OrderingContext context) : IPlaceQueries
{
    public async Task<Place?> FindAsync(int placeId)
        => await context.Places.AsNoTracking().FirstOrDefaultAsync(p => p.PlaceId == placeId);

    // LEGACY(places): resolves an old room id — remove when the printed room/table stickers are reprinted with /p/{id}.
    public async Task<Place?> FindByRoomIdAsync(int roomId)
        => await context.Places.AsNoTracking().FirstOrDefaultAsync(p => p.LegacyRoomId == roomId)
           ?? await context.Places.AsNoTracking().FirstOrDefaultAsync(p => p.PlaceId == roomId && p.Kind == "Room");

    // LEGACY(places): resolves an old table id — remove when the printed room/table stickers are reprinted with /p/{id}.
    public async Task<Place?> FindByTableIdAsync(int tableId)
        => await context.Places.AsNoTracking().FirstOrDefaultAsync(p => p.LegacyTableId == tableId)
           ?? await context.Places.AsNoTracking().FirstOrDefaultAsync(p => p.PlaceId == tableId && p.Kind == "Table");

    public async Task<Place?> ResolveAsync(int? placeId, int? roomId, int? tableId)
    {
        if (placeId is int id) return await FindAsync(id);
        // LEGACY(places): old room/table id fallbacks — remove when the printed room/table stickers are reprinted with /p/{id}.
        if (roomId is int room) return await FindByRoomIdAsync(room);
        if (tableId is int table) return await FindByTableIdAsync(table);
        return null;
    }
}
