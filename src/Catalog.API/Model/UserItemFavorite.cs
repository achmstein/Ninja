namespace Ninja.Catalog.API.Model;

/// <summary>
/// Represents a user's favorite menu item
/// </summary>
public class UserItemFavorite
{
    public int Id { get; set; }
    public required string UserId { get; set; }
    public int CatalogItemId { get; set; }
    public DateTime AddedAt { get; set; }
    public CatalogItem? CatalogItem { get; set; }
}
