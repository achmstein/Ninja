using System.Text.Json.Serialization;

namespace Ninja.Catalog.API.Model;

/// <summary>
/// Represents a customization group for a menu item (e.g., "Roasting", "Sugar Level", "Size")
/// </summary>
public class ItemCustomization
{
    public int Id { get; set; }

    public int CatalogItemId { get; set; }

    public CatalogItem? CatalogItem { get; set; }

    /// <summary>
    /// Localized name of the customization group (e.g., "Roasting", "Sugar Level", "Size", "Milk")
    /// </summary>
    public LocalizedText Name { get; set; } = new();

    /// <summary>
    /// If true, customer must select at least one option
    /// </summary>
    public bool IsRequired { get; set; }

    /// <summary>
    /// If true, customer can select multiple options (e.g., for extras/toppings)
    /// </summary>
    public bool AllowMultiple { get; set; }

    /// <summary>
    /// Display order for sorting customizations
    /// </summary>
    public int DisplayOrder { get; set; }

    /// <summary>
    /// Available options for this customization
    /// </summary>
    public ICollection<CustomizationOption> Options { get; set; } = new List<CustomizationOption>();

    /// <summary>
    /// Required for EF Core
    /// </summary>
    private ItemCustomization() { }

    public ItemCustomization(string name)
    {
        Name = new LocalizedText(name);
    }

    [JsonConstructor]
    public ItemCustomization(LocalizedText name)
    {
        Name = name;
    }
}
