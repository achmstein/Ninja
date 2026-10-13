namespace Ninja.Catalog.API.Model;

/// <summary>
/// An item made by POST /items/compose, kept by its request id so the same
/// request again answers what was made rather than making a second item.
/// </summary>
public class ComposedItemRequest
{
    public Guid RequestId { get; set; }

    public int CatalogItemId { get; set; }

    public int CatalogTypeId { get; set; }

    /// <summary>The caller's option references and the ids they got, as JSON</summary>
    public string Options { get; set; } = "[]";

    public DateTime CreatedAt { get; set; }
}
