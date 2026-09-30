namespace Ninja.Catalog.API.Model;

/// <summary>
/// An item the owner suggests alongside another ("goes well with"): a
/// croissant with a cappuccino, fries with a burger, a drink with a session.
/// One way only — pairing a cappuccino with a croissant says nothing about
/// what the croissant suggests. The customer app shows these on the item's
/// sheet and nudges one in the cart; the till offers them after the item is
/// rung up. At most <see cref="MaxPerItem"/> per item, in the owner's order.
/// </summary>
public class CatalogItemPairing
{
    /// <summary>More than a handful stops being a suggestion.</summary>
    public const int MaxPerItem = 4;

    public int Id { get; set; }

    /// <summary>The item the suggestion is shown with.</summary>
    public int CatalogItemId { get; set; }
    public CatalogItem CatalogItem { get; set; } = null!;

    /// <summary>The item suggested.</summary>
    public int PairedItemId { get; set; }
    public CatalogItem PairedItem { get; set; } = null!;

    /// <summary>Lower first.</summary>
    public int DisplayOrder { get; set; }
}
