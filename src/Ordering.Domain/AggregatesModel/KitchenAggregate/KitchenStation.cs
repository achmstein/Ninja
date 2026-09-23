#nullable enable
namespace Ninja.Ordering.Domain.AggregatesModel.KitchenAggregate;

/// <summary>
/// A place in a branch's kitchen that makes part of an order — the grill,
/// the bar, the shisha corner — and how it hears about its part: on a screen,
/// on a printer, or both. The menu categories it makes decide which lines of
/// an order go to it; the branch's default station takes every line no other
/// station claims, so nothing is ever lost between stations.
/// </summary>
public class KitchenStation : Entity, IAggregateRoot
{
    public const int DefaultPrinterPort = 9100;

    public int BranchId { get; private set; }

    public LocalizedText Name { get; private set; } = new();

    /// <summary>The menu categories (Catalog's types) whose lines this station makes.</summary>
    public List<int> CategoryIds { get; private set; } = [];

    /// <summary>Its part shows on a kitchen screen, where someone marks it ready.</summary>
    public bool ShowsOnScreen { get; private set; }

    /// <summary>Its part prints on a kitchen printer, which never marks anything ready.</summary>
    public bool PrintsTickets { get; private set; }

    /// <summary>The printer on the shop's network, as a till or a kitchen tablet reaches it.</summary>
    public string? PrinterHost { get; private set; }

    public int PrinterPort { get; private set; } = DefaultPrinterPort;

    /// <summary>Takes every line no other station claims. One per branch.</summary>
    public bool IsDefault { get; private set; }

    public int DisplayOrder { get; private set; }

    protected KitchenStation() { }

    public KitchenStation(int branchId, LocalizedText name, IEnumerable<int> categoryIds, bool showsOnScreen, bool printsTickets,
        string? printerHost, int? printerPort, bool isDefault, int displayOrder)
    {
        BranchId = branchId;
        IsDefault = isDefault;
        Update(name, categoryIds, showsOnScreen, printsTickets, printerHost, printerPort, displayOrder);
    }

    /// <summary>
    /// The station every branch starts with: one screen that makes
    /// everything, which is the kitchen as it was before stations.
    /// </summary>
    public static KitchenStation NewDefault(int branchId) =>
        new(branchId, new LocalizedText("Kitchen", "المطبخ"), [], showsOnScreen: true, printsTickets: false,
            printerHost: null, printerPort: null, isDefault: true, displayOrder: 0);

    public void Update(LocalizedText name, IEnumerable<int> categoryIds, bool showsOnScreen, bool printsTickets,
        string? printerHost, int? printerPort, int displayOrder)
    {
        if (string.IsNullOrWhiteSpace(name.En) && string.IsNullOrWhiteSpace(name.Ar))
        {
            throw new OrderingDomainException("A station needs a name.");
        }

        if (!showsOnScreen && !printsTickets)
        {
            throw new OrderingDomainException("A station has to show on a screen, print, or both.");
        }

        var host = string.IsNullOrWhiteSpace(printerHost) ? null : printerHost.Trim();
        if (printsTickets && host is null)
        {
            throw new OrderingDomainException("A station that prints needs its printer's address.");
        }

        var port = printerPort ?? DefaultPrinterPort;
        if (port is < 1 or > 65535)
        {
            throw new OrderingDomainException("A printer port is between 1 and 65535.");
        }

        Name = new LocalizedText(name.En.Trim(), string.IsNullOrWhiteSpace(name.Ar) ? null : name.Ar.Trim());
        CategoryIds = categoryIds.Where(id => id > 0).Distinct().Order().ToList();
        ShowsOnScreen = showsOnScreen;
        PrintsTickets = printsTickets;
        // The address is kept while printing is off, so switching it back on
        // does not ask for it again
        PrinterHost = host;
        PrinterPort = port;
        DisplayOrder = displayOrder;
    }
}
