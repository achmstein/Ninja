namespace Ninja.Assistant.API.Downstream;

// What the menu-editing and stock tools send to and read from Catalog and
// Inventory: mirrors of their contracts, only the fields used. Enums go as
// their numbers, as the services read them.

// --- Catalog: items ----------------------------------------------------------

/// <summary>
/// A menu item as the list shows it, with <see cref="Base"/>: the chain-wide
/// price, offer and availability before any branch override. An edit starts
/// from Base, never from the branch's view, or it would write a branch's
/// price into every branch.
/// </summary>
public sealed record CatalogItemDetail(
    int Id,
    LocalizedText? Name,
    LocalizedText? Description,
    decimal Price,
    int CatalogTypeId,
    LocalizedText? CatalogTypeName,
    bool IsAvailable,
    bool IsOnOffer,
    decimal? OfferPrice,
    int? OfferWeekdays,
    string? OfferFrom,
    string? OfferTo,
    bool IsPopular,
    int? PreparationTimeMinutes,
    CatalogItemBase? Base);

public sealed record CatalogItemBase(decimal Price, decimal? OfferPrice, bool IsOnOffer, bool IsAvailable, int? OfferWeekdays, string? OfferFrom, string? OfferTo);

/// <summary>Catalog's UpdateCatalogItemRequest: the whole item, every field, each time</summary>
public sealed record UpdateCatalogItemRequest(
    LocalizedText Name,
    LocalizedText Description,
    decimal Price,
    int CatalogTypeId,
    bool IsAvailable,
    bool IsOnOffer,
    decimal? OfferPrice,
    int? OfferWeekdays,
    string? OfferFrom,
    string? OfferTo,
    bool IsPopular,
    int? PreparationTimeMinutes);

/// <summary>OfferWeekdays is a bit per DayOfWeek (1 is Sunday), null every day; the hours are "HH:mm", both or neither</summary>
public sealed record SetItemOfferRequest(bool IsOnOffer, decimal? OfferPrice, int? OfferWeekdays, string? OfferFrom, string? OfferTo);

public sealed record BranchItemOverrideDto(int Id, int BranchId, int CatalogItemId, bool IsAvailable, bool IsOutOfStock, decimal? PriceOverride, decimal? OfferPriceOverride, bool? IsOnOfferOverride);

public sealed record BranchItemOverrideRequest(bool IsAvailable, decimal? PriceOverride, decimal? OfferPriceOverride, bool? IsOnOfferOverride);

// --- Catalog: categories and customizations ----------------------------------

/// <summary>Catalog binds a category's create and update to its CatalogType: the name and the order</summary>
public sealed record CategoryRequest(LocalizedText Name, int DisplayOrder);

public sealed record CustomizationDto(int Id, LocalizedText? Name, bool IsRequired, bool AllowMultiple, int DisplayOrder, List<CustomizationOptionDto>? Options);

public sealed record CustomizationOptionDto(int Id, LocalizedText? Name, decimal PriceAdjustment, bool IsDefault, int DisplayOrder);

/// <summary>A group as Catalog binds it (ItemCustomization). On an update an option with Id 0 is new and one left out is deleted.</summary>
public sealed record CustomizationRequest(LocalizedText Name, bool IsRequired, bool AllowMultiple, int DisplayOrder, List<CustomizationOptionRequest> Options);

public sealed record CustomizationOptionRequest(int Id, LocalizedText Name, decimal PriceAdjustment, bool IsDefault, int DisplayOrder);

// --- Catalog: promo codes ----------------------------------------------------

/// <param name="Kind">0 a percentage off, 1 a fixed amount off</param>
public sealed record PromoCodeDto(int Id, string Code, int Kind, decimal Value, decimal? MinSubtotal, DateTime? StartsAt, DateTime? EndsAt, int? MaxUses, bool OncePerCustomer, bool IsActive, int Uses);

public sealed record PromoCodeRequest(string Code, int Kind, decimal Value, decimal? MinSubtotal, DateTime? StartsAt, DateTime? EndsAt, int? MaxUses, bool OncePerCustomer, bool IsActive);

public sealed record SetPromoActiveRequest(bool IsActive);

// --- Inventory ---------------------------------------------------------------

/// <summary>A stock item whole, as Inventory's PUT wants it back</summary>
public sealed record StockItemView(int Id, LocalizedText? Name, string? Unit, decimal? PackSize, LocalizedText? PackName, bool AutoSoldOut, bool IsActive);

public sealed record ReorderLevelRequest(decimal? ReorderLevel);

/// <param name="Type">MovementType: 2 Waste, 4 Adjustment (the only two posted by hand)</param>
public sealed record AdjustmentRequest(int StockItemId, int Type, decimal Quantity, string Reason, decimal? UnitCost);

public sealed record PurchaseRequest(string? Supplier, string? InvoiceRef, List<PurchaseLineInput> Lines, int? SupplierId);

public sealed record PurchaseLineInput(int StockItemId, decimal Quantity, decimal UnitCost);

public sealed record StockCountRequest(string? Note, List<StockCountLineInput> Lines);

public sealed record StockCountLineInput(int StockItemId, decimal Counted);

public sealed record TransferRequest(string? Note, List<TransferLineInput> Lines);

public sealed record TransferLineInput(int StockItemId, decimal Quantity);

public sealed record RecipeView(int CatalogItemId, List<RecipeLineView>? Lines);

public sealed record RecipeLineView(int StockItemId, LocalizedText? Name, string? Unit, decimal Quantity, List<int>? OptionIds, int Slot, bool IsNone);
