using System.Text.Json.Serialization;

namespace Ninja.Catalog.API.Model;

/// <summary>
/// Represents a category in the cafe catalog (e.g., Drinks, Food, Snacks, Desserts)
/// </summary>
public class CatalogType
{
    public int Id { get; set; }

    /// <summary>
    /// Localized name of the category
    /// </summary>
    public LocalizedText Name { get; set; } = new();

    /// <summary>
    /// Display order of the category (lower numbers appear first)
    /// </summary>
    public int DisplayOrder { get; set; }

    /// <summary>
    /// Required for EF Core
    /// </summary>
    private CatalogType() { }

    public CatalogType(string name)
    {
        Name = new LocalizedText(name);
    }

    [JsonConstructor]
    public CatalogType(LocalizedText name)
    {
        Name = name;
    }
}
