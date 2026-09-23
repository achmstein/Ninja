#nullable enable
namespace Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>
/// The share of an order one kitchen station makes, as the station was when
/// the order reached the kitchen: its name and how it hears about the part
/// are copied here, so changing a station later leaves orders already in the
/// kitchen as they were. Only a part on a screen is ever marked ready; a
/// printed part is done the moment it leaves the printer, which nobody tells us.
/// </summary>
public class OrderStationPart : Entity
{
    public int StationId { get; private set; }

    public LocalizedText StationName { get; private set; } = new();

    public bool ShowsOnScreen { get; private set; }

    public bool PrintsTickets { get; private set; }

    /// <summary>When the station's screen marked its part done; null while it is on the board.</summary>
    public DateTime? ReadyAt { get; private set; }

    public bool IsReady => ReadyAt != null;

    protected OrderStationPart() { }

    public OrderStationPart(int stationId, LocalizedText stationName, bool showsOnScreen, bool printsTickets)
    {
        StationId = stationId;
        StationName = stationName;
        ShowsOnScreen = showsOnScreen;
        PrintsTickets = printsTickets;
    }

    internal void SetReady(bool ready, DateTime now) => ReadyAt = ready ? ReadyAt ?? now : null;
}
