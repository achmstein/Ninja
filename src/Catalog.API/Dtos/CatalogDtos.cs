using Chillax.Catalog.API.Model;

namespace Chillax.Catalog.API.Dtos;

/// <summary>
/// DTO for catalog item (menu item)
/// </summary>
public record CatalogItemDto
{
    public int Id { get; init; }
    public LocalizedText Name { get; init; } = new();
    public LocalizedText Description { get; init; } = new();
    public decimal Price { get; init; }
    public string? PictureUri { get; init; }
    public int CatalogTypeId { get; init; }
    public LocalizedText CatalogTypeName { get; init; } = new();
    public bool IsAvailable { get; init; }
    /// <summary>
    /// Inventory ran out of something this item needs at the requested branch.
    /// Already folded into <see cref="IsAvailable"/>; exposed so staff can tell
    /// a stock-out from a manual sold-out.
    /// </summary>
    public bool IsOutOfStock { get; init; }
    /// <summary>The offer applies right now: switched on and inside its window.</summary>
    public bool IsOnOffer { get; init; }
    public decimal? OfferPrice { get; init; }
    public decimal EffectivePrice { get; init; }
    /// <summary>A bit per DayOfWeek (1 is Sunday); null is every day.</summary>
    public int? OfferWeekdays { get; init; }
    /// <summary>"HH:mm" local; both null is all day.</summary>
    public string? OfferFrom { get; init; }
    public string? OfferTo { get; init; }
    public bool IsPopular { get; init; }
    public int? PreparationTimeMinutes { get; init; }
    public int DisplayOrder { get; init; }
    public List<ItemCustomizationDto> Customizations { get; init; } = new();
    /// <summary>
    /// The chain-wide values when a branch override changed what this DTO
    /// shows (price, offer, availability); null when nothing is overridden.
    /// The admin edits the item from these, not from the branch-effective ones.
    /// </summary>
    public CatalogItemBaseDto? Base { get; init; }
}

/// <summary>The item as the chain defines it, before any branch override.</summary>
public record CatalogItemBaseDto(decimal Price, decimal? OfferPrice, bool IsOnOffer, bool IsAvailable, int? OfferWeekdays = null, string? OfferFrom = null, string? OfferTo = null);

/// <summary>
/// What the admin may change on a menu item. Display order is owned by the
/// reorder endpoint and the picture by the upload endpoint.
/// </summary>
public record UpdateCatalogItemRequest
{
    public LocalizedText Name { get; init; } = new();
    public LocalizedText Description { get; init; } = new();
    public decimal Price { get; init; }
    public int CatalogTypeId { get; init; }
    public bool IsAvailable { get; init; } = true;
    public bool IsOnOffer { get; init; }
    public decimal? OfferPrice { get; init; }
    public int? OfferWeekdays { get; init; }
    public string? OfferFrom { get; init; }
    public string? OfferTo { get; init; }
    public bool IsPopular { get; init; }
    public int? PreparationTimeMinutes { get; init; }
}

/// <summary>
/// DTO for catalog type (category)
/// </summary>
public record CatalogTypeDto
{
    public int Id { get; init; }
    public LocalizedText Name { get; init; } = new();
    public int DisplayOrder { get; init; }
}

/// <summary>
/// DTO for item customization group
/// </summary>
public record ItemCustomizationDto
{
    public int Id { get; init; }
    public LocalizedText Name { get; init; } = new();
    public bool IsRequired { get; init; }
    public bool AllowMultiple { get; init; }
    public int DisplayOrder { get; init; }
    public List<CustomizationOptionDto> Options { get; init; } = new();
}

/// <summary>
/// DTO for customization option
/// </summary>
public record CustomizationOptionDto
{
    public int Id { get; init; }
    public LocalizedText Name { get; init; } = new();
    public decimal PriceAdjustment { get; init; }
    public bool IsDefault { get; init; }
    public int DisplayOrder { get; init; }
    /// <summary>
    /// True when Inventory has marked this option sold out at the branch the
    /// request was scoped to; always false without a branch context.
    /// </summary>
    public bool IsOutOfStock { get; init; }
}

/// <summary>
/// Paginated items response
/// </summary>
public record PaginatedItemsDto<T>
{
    public int PageIndex { get; init; }
    public int PageSize { get; init; }
    public long Count { get; init; }
    public List<T> Data { get; init; } = new();

    public PaginatedItemsDto(int pageIndex, int pageSize, long count, List<T> data)
    {
        PageIndex = pageIndex;
        PageSize = pageSize;
        Count = count;
        Data = data;
    }
}

/// <summary>
/// DTO for user's item preference
/// </summary>
public record UserItemPreferenceDto
{
    public int CatalogItemId { get; init; }
    public DateTime LastUpdated { get; init; }
    public List<UserPreferenceOptionDto> SelectedOptions { get; init; } = new();
}

/// <summary>
/// DTO for a selected option in user preference
/// </summary>
public record UserPreferenceOptionDto
{
    public int CustomizationId { get; init; }
    public int OptionId { get; init; }
}

/// <summary>
/// Request to batch reorder items or categories
/// </summary>
public record ReorderRequest
{
    public List<ReorderItemDto> Items { get; init; } = new();
}

/// <summary>
/// Single item in a reorder request
/// </summary>
public record ReorderItemDto
{
    public int Id { get; init; }
    public int DisplayOrder { get; init; }
}

/// <summary>
/// Request to explicitly set item availability
/// </summary>
public record SetAvailabilityRequest
{
    public bool IsAvailable { get; init; }
}

/// <summary>
/// Request to save user preferences for multiple items
/// </summary>
public record SaveUserPreferencesRequest
{
    public List<SaveItemPreference> Items { get; init; } = new();
}

/// <summary>
/// Preference data for a single item
/// </summary>
public record SaveItemPreference
{
    public int CatalogItemId { get; init; }
    public List<UserPreferenceOptionDto> SelectedOptions { get; init; } = new();
}

/// <summary>
/// Request to set or clear an item offer
/// </summary>
public record SetItemOfferRequest
{
    public bool IsOnOffer { get; init; }
    public decimal? OfferPrice { get; init; }
    /// <summary>A bit per DayOfWeek (1 is Sunday); null or 0 is every day.</summary>
    public int? OfferWeekdays { get; init; }
    /// <summary>"HH:mm" local; both or neither.</summary>
    public string? OfferFrom { get; init; }
    public string? OfferTo { get; init; }
}

/// <summary>
/// DTO for bundle deal
/// </summary>
public record BundleDealDto
{
    public int Id { get; init; }
    public LocalizedText Name { get; init; } = new();
    public LocalizedText Description { get; init; } = new();
    public decimal BundlePrice { get; init; }
    public decimal OriginalPrice { get; init; }
    public string? PictureUri { get; init; }
    public bool IsActive { get; init; }
    public int DisplayOrder { get; init; }
    public List<BundleDealItemDto> Items { get; init; } = new();
}

/// <summary>
/// DTO for an item within a bundle deal
/// </summary>
public record BundleDealItemDto
{
    public int Id { get; init; }
    public int CatalogItemId { get; init; }
    public LocalizedText ItemName { get; init; } = new();
    public decimal ItemPrice { get; init; }
    public int Quantity { get; init; }
}

/// <summary>
/// Request to create or update a bundle deal
/// </summary>
public record CreateOrUpdateBundleDealRequest
{
    public LocalizedText Name { get; init; } = new();
    public LocalizedText Description { get; init; } = new();
    public decimal BundlePrice { get; init; }
    public bool IsActive { get; init; }
    public int DisplayOrder { get; init; }
    public List<BundleDealItemRequest> Items { get; init; } = new();
}

/// <summary>
/// Item within a bundle deal request
/// </summary>
public record BundleDealItemRequest
{
    public int CatalogItemId { get; init; }
    public int Quantity { get; init; } = 1;
}

/// <summary>
/// Request to toggle bundle active status
/// </summary>
public record SetBundleActiveRequest
{
    public bool IsActive { get; init; }
}

/// <summary>
/// DTO for branch item override
/// </summary>
public record BranchItemOverrideDto(
    int Id,
    int BranchId,
    int CatalogItemId,
    bool IsAvailable,
    bool IsOutOfStock,
    decimal? PriceOverride,
    decimal? OfferPriceOverride,
    bool? IsOnOfferOverride);

/// <summary>
/// Request to set branch item override
/// </summary>
public record BranchItemOverrideRequest
{
    public bool IsAvailable { get; init; } = true;
    public decimal? PriceOverride { get; init; }
    public decimal? OfferPriceOverride { get; init; }
    public bool? IsOnOfferOverride { get; init; }
}
