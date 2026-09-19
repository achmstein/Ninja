using System.Text.Json.Serialization;

namespace Ninja.Catalog.API.Model;

/// <summary>
/// Represents a menu item in the cafe catalog (drinks, food, snacks, desserts)
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
    public bool IsOfferActive
        => IsOnOffer && OfferPrice.HasValue && OfferWindow.Covers(OfferWeekdays, OfferFrom, OfferTo, TenantClock.Now);

    /// <summary>
    /// Returns the effective price: OfferPrice while the offer is active, otherwise regular Price
    /// </summary>
    public decimal EffectivePrice => IsOfferActive ? OfferPrice!.Value : Price;

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
    /// Required for EF Core
    /// </summary>
    private CatalogItem() { }

    public CatalogItem(string name, string? description = null)
    {
        Name = new LocalizedText(name);
        Description = new LocalizedText(description ?? string.Empty);
    }

    [JsonConstructor]
    public CatalogItem(LocalizedText name, LocalizedText? description = null)
    {
        Name = name;
        Description = description ?? new LocalizedText(string.Empty);
    }
}
