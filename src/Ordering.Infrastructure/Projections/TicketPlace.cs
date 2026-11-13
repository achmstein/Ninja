#nullable enable
namespace Ninja.Ordering.Infrastructure.Projections;

/// <summary>
/// Which place an open bill is the bill of, kept from Sales' TicketOpenedIntegrationEvent — Ordering
/// never calls Sales. An order rung up onto a bill takes its place from here, so the kitchen's card
/// says "Room 5" whichever till sent the order and whether or not the till said where the bill is.
/// The row goes when the bill is settled or voided. No row means the bill has no place (a counter
/// bill) or has not been heard of yet: the order is taken as sent, and given its place when the bill
/// is heard of.
/// </summary>
public class TicketPlace
{
    /// <summary>Sales' ticket id.</summary>
    public int TicketId { get; set; }

    public int BranchId { get; set; }

    public int PlaceId { get; set; }

    /// <summary>"Room" or "Table".</summary>
    public string? PlaceKind { get; set; }

    public string? PlaceNameEn { get; set; }

    public string? PlaceNameAr { get; set; }

    public DateTime UpdatedAt { get; set; }
}
