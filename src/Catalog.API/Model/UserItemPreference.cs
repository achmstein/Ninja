using System.ComponentModel.DataAnnotations;

namespace Ninja.Catalog.API.Model;

/// <summary>
/// Stores a user's customization preferences for a specific catalog item.
/// Updated after each successful order containing this item.
/// </summary>
public class UserItemPreference
{
    public int Id { get; set; }

    /// <summary>
    /// The user's identity GUID (from Keycloak/identity provider)
    /// </summary>
    [Required]
    public string UserId { get; set; } = string.Empty;

    /// <summary>
    /// The catalog item this preference applies to
    /// </summary>
    public int CatalogItemId { get; set; }

    public CatalogItem? CatalogItem { get; set; }

    /// <summary>
    /// When this preference was last updated
    /// </summary>
    public DateTime LastUpdated { get; set; }

    /// <summary>
    /// The selected customization options
    /// </summary>
    public ICollection<UserPreferenceOption> SelectedOptions { get; set; } = new List<UserPreferenceOption>();
}

/// <summary>
/// Represents a selected option in a user's item preference
/// </summary>
public class UserPreferenceOption
{
    public int Id { get; set; }

    public int UserItemPreferenceId { get; set; }

    public UserItemPreference? UserItemPreference { get; set; }

    /// <summary>
    /// The customization group ID (e.g., "Roasting")
    /// </summary>
    public int CustomizationId { get; set; }

    /// <summary>
    /// The selected option ID within that customization
    /// </summary>
    public int OptionId { get; set; }
}
