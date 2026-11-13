#nullable enable
using Ninja.Ordering.Infrastructure.Projections;

namespace Ninja.Ordering.API.Application.Queries;

/// <summary>Where an open bill is: the place an order rung up onto it belongs to.</summary>
public record TicketPlaceView(int PlaceId, string? PlaceKind, LocalizedText? PlaceName);

/// <summary>
/// Ordering's record of which place each open bill is the bill of (see <see cref="TicketPlace"/>):
/// learned when Sales opens the bill, asked when an order is rung up onto it, forgotten when it is
/// settled or voided.
/// </summary>
public interface ITicketPlaces
{
    /// <summary>The bill's place; null for a counter bill, or one not heard of yet.</summary>
    Task<TicketPlaceView?> FindAsync(int ticketId, CancellationToken ct = default);

    /// <summary>
    /// The bill is at this place: kept, and every order already on the bill that was taken without a
    /// place is given it, so a card the kitchen already has gains its "Room 5".
    /// Returns how many orders were given their place.
    /// </summary>
    Task<int> LearnAsync(int ticketId, int branchId, int placeId, string? placeKind, LocalizedText? placeName, CancellationToken ct = default);

    /// <summary>The bill is settled or voided: nothing more is rung up onto it.</summary>
    Task ForgetAsync(int ticketId, CancellationToken ct = default);
}

public class TicketPlaces(OrderingContext context) : ITicketPlaces
{
    public async Task<TicketPlaceView?> FindAsync(int ticketId, CancellationToken ct = default)
    {
        var row = await context.TicketPlaces.AsNoTracking().FirstOrDefaultAsync(t => t.TicketId == ticketId, ct);
        return row is null ? null : new TicketPlaceView(row.PlaceId, row.PlaceKind, NameOf(row));
    }

    public async Task<int> LearnAsync(int ticketId, int branchId, int placeId, string? placeKind, LocalizedText? placeName, CancellationToken ct = default)
    {
        var row = await context.TicketPlaces.FirstOrDefaultAsync(t => t.TicketId == ticketId, ct);
        if (row is null)
        {
            row = new TicketPlace { TicketId = ticketId };
            context.TicketPlaces.Add(row);
        }
        row.BranchId = branchId;
        row.PlaceId = placeId;
        row.PlaceKind = placeKind;
        row.PlaceNameEn = placeName?.En;
        row.PlaceNameAr = placeName?.Ar;
        row.UpdatedAt = DateTime.UtcNow;

        // Orders the bill already holds from before it was heard of: taken with no place, given it now
        var unplaced = await context.Orders.Where(o => o.TicketId == ticketId && o.PlaceId == null).ToListAsync(ct);
        foreach (var order in unplaced)
        {
            order.TakePlaceOfTicket(placeId, placeKind, placeName);
        }

        await context.SaveChangesAsync(ct);
        return unplaced.Count;
    }

    public async Task ForgetAsync(int ticketId, CancellationToken ct = default)
    {
        var row = await context.TicketPlaces.FirstOrDefaultAsync(t => t.TicketId == ticketId, ct);
        if (row is null) return;
        context.TicketPlaces.Remove(row);
        await context.SaveChangesAsync(ct);
    }

    private static LocalizedText? NameOf(TicketPlace row) =>
        row.PlaceNameEn is null && row.PlaceNameAr is null ? null : new LocalizedText(row.PlaceNameEn, row.PlaceNameAr);
}
