using System.ComponentModel.DataAnnotations;

namespace Ninja.Catalog.API.Model;

/// <summary>
/// One purchase fact: a customer ordered a catalog item on a given order. One
/// row per (UserId, CatalogItemId, OrderId) — a fact, not a running counter —
/// so consuming the confirmation event more than once is a no-op (the unique
/// index absorbs redelivery). A customer's "usuals" are the items with the most
/// such rows. Guest/walk-in orders (no identity) are not recorded.
/// </summary>
public class CustomerItemPurchase
{
    public int Id { get; set; }

    /// <summary>
    /// The customer's identity GUID (Keycloak sub) — the same key as
    /// <see cref="UserItemPreference.UserId"/> and <see cref="UserItemFavorite.UserId"/>.
    /// </summary>
    [Required]
    public string UserId { get; set; } = string.Empty;

    /// <summary>The catalog item that was ordered.</summary>
    public int CatalogItemId { get; set; }

    public CatalogItem? CatalogItem { get; set; }

    /// <summary>The confirmed order this fact came from — the dedupe key.</summary>
    public int OrderId { get; set; }

    /// <summary>Units of this item on that order (summed across its lines).</summary>
    public int Units { get; set; }

    /// <summary>When the order was recorded — breaks ties between equally-frequent items.</summary>
    public DateTime OrderedAt { get; set; }
}
