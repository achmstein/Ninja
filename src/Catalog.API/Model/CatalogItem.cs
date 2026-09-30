using System.Text.Json.Serialization;

namespace Ninja.Catalog.API.Model;

/// <summary>
/// Represents a menu item in the business catalog (drinks, food, snacks, desserts)
/// </summary>
public class CatalogItem
{
    public int Id { get; set; }

    /// <summary>
    /// Localized name of the menu item
    /// </summary>
    public LocalizedText Name { get; set; } = new();

    /// <summary>
    /// Localized description of the menu item
    /// </summary>
    public LocalizedText Description { get; set; } = new();

    public decimal Price { get; set; }

    public string? PictureFileName { get; set; }

    public int CatalogTypeId { get; set; }

    public CatalogType? CatalogType { get; set; }

    /// <summary>
    /// Indicates if the item is currently available for ordering
    /// </summary>
    public bool IsAvailable { get; set; } = true;

    /// <summary>
    /// Estimated preparation time in minutes (optional)
    /// </summary>
    public int? PreparationTimeMinutes { get; set; }

    /// <summary>
    /// Whether this item is currently on offer (has a discounted price)
    /// </summary>
    public bool IsOnOffer { get; set; }

    /// <summary>
    /// The discounted offer price (only applicable when IsOnOffer is true)
    /// </summary>
    public decimal? OfferPrice { get; set; }

    /// <summary>When the offer applies: a bit per <see cref="DayOfWeek"/>; null or 0 is every day.</summary>
    public int? OfferWeekdays { get; set; }

    /// <summary>The offer's hours, local time; both null is all day. Ending before it starts runs past midnight.</summary>
    public TimeOnly? OfferFrom { get; set; }

    public TimeOnly? OfferTo { get; set; }

    /// <summary>The offer is switched on, priced, and its window covers now.</summary>
    public bool IsOfferActive => PriceAt(null, TenantClock.Now).IsOnOffer;

    /// <summary>
    /// Returns the effective price: OfferPrice while the offer is active, otherwise regular Price
    /// </summary>
    public decimal EffectivePrice => PriceAt(null, TenantClock.Now).Effective;

    /// <summary>
    /// What the item costs at a branch at a local moment: the branch's price
    /// and offer where it set them, the item's otherwise, and the offer only
    /// while its window (always the item's) covers that moment. The one rule
    /// the menu shows and an order is checked against.
    /// </summary>
    public ItemPrice PriceAt(BranchItemOverride? branch, DateTime local)
    {
        var price = branch?.PriceOverride ?? Price;
        var offerPrice = branch?.OfferPriceOverride ?? OfferPrice;
        var isOnOffer = (branch?.IsOnOfferOverride ?? IsOnOffer)
            && offerPrice.HasValue
            && OfferWindow.Covers(OfferWeekdays, OfferFrom, OfferTo, local);
        return new ItemPrice(price, offerPrice, isOnOffer, isOnOffer ? offerPrice!.Value : price);
    }

    /// <summary>
    /// Whether this item should appear in the "Most Popular" section
    /// </summary>
    public bool IsPopular { get; set; }

    /// <summary>
    /// Display order within the category (lower numbers appear first)
    /// </summary>
    public int DisplayOrder { get; set; }

    /// <summary>
    /// Available customization options for this item (e.g., size, sugar level, roasting)
    /// </summary>
    public ICollection<ItemCustomization> Customizations { get; set; } = new List<ItemCustomization>();

    /// <summary>
    /// The items suggested alongside this one ("goes well with"), in
    /// <see cref="CatalogItemPairing.DisplayOrder"/>; loaded by the menu lists.
    /// </summary>
    public ICollection<CatalogItemPairing> Pairings { get; set; } = new List<CatalogItemPairing>();

    /// <summary>
    /// Required for EF Core
    /// </summary>
    private CatalogItem() { }

    [JsonConstructor]
    public CatalogItem(LocalizedText name, LocalizedText? description = null)
    {
        Name = name;
        Description = description ?? new LocalizedText();
    }
}

/// <summary>An item's price at a branch at a moment (<see cref="CatalogItem.PriceAt"/>): what it costs is <see cref="Effective"/>.</summary>
public readonly record struct ItemPrice(decimal Price, decimal? OfferPrice, bool IsOnOffer, decimal Effective);
