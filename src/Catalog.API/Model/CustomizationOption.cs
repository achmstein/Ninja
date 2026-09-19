using System.Text.Json.Serialization;

namespace Ninja.Catalog.API.Model;

/// <summary>
/// Represents a single option within a customization group (e.g., "Dark Roast", "Large", "No Sugar")
/// </summary>
public class CustomizationOption
{
    public int Id { get; set; }

    public int ItemCustomizationId { get; set; }

    public ItemCustomization? ItemCustomization { get; set; }

    /// <summary>
    /// Localized name of the option (e.g., "Light Roast", "Medium", "No Sugar", "Oat Milk")
    /// </summary>
    public LocalizedText Name { get; set; } = new();

    /// <summary>
    /// Price adjustment for this option (can be 0, positive, or negative)
    /// </summary>
    public decimal PriceAdjustment { get; set; }

    /// <summary>
    /// If true, this option is pre-selected by default
    /// </summary>
    public bool IsDefault { get; set; }

    /// <summary>
    /// Display order for sorting options
    /// </summary>
    public int DisplayOrder { get; set; }

    /// <summary>
    /// Required for EF Core
    /// </summary>
    private CustomizationOption() { }

    public CustomizationOption(string name)
    {
        Name = new LocalizedText(name);
    }

    [JsonConstructor]
    public CustomizationOption(LocalizedText name)
    {
        Name = name;
    }
}
