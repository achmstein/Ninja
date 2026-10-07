namespace Ninja.Assistant.API.Downstream;

// What the dish tools send to and read from Catalog and Inventory: mirrors of
// their contracts, only the fields used.

// --- Catalog -----------------------------------------------------------------

public sealed record CategoryDto(int Id, LocalizedText? Name, int DisplayOrder);

public sealed record LocalizeMenuRequest(int Kind, LocalizedText Name, LocalizedText? Description, int? CatalogTypeId, bool SuggestCategory, bool SuggestDescription, string? Languages = null);

public sealed record LocalizeMenuResponse(LocalizedText Name, LocalizedText? Description, int? SuggestedCatalogTypeId, List<string>? Filled, List<string>? Warnings);

public sealed record SuggestCustomizationsRequest(LocalizedText Name, LocalizedText? Description, int? CatalogTypeId, decimal Price, List<LocalizedText>? ExistingGroups = null, string? Languages = null);

public sealed record SuggestCustomizationsResponse(List<SuggestedGroup>? Groups, List<string>? Warnings);

public sealed record SuggestedGroup(LocalizedText Name, bool IsRequired, bool AllowMultiple, List<SuggestedOption>? Options);

public sealed record SuggestedOption(LocalizedText Name, decimal PriceAdjustment, bool IsDefault);

public sealed record ComposeItemRequest(
    LocalizedText Name, LocalizedText? Description, decimal Price, int? CatalogTypeId, LocalizedText? NewCategoryName,
    bool IsPopular, int? PreparationTimeMinutes, List<ComposeGroup> Customizations);

public sealed record ComposeGroup(LocalizedText Name, bool IsRequired, bool AllowMultiple, List<ComposeOption> Options);

public sealed record ComposeOption(int Ref, LocalizedText Name, decimal PriceAdjustment, bool IsDefault);

public sealed record ComposeItemResult(int ItemId, int CatalogTypeId, List<ComposedOption>? Options);

public sealed record ComposedOption(int Ref, int Id);

public sealed record DrawDishPhotoRequest(string? NameEn, string? NameAr, string? Description, string? Category, string? Style, string? Note);

// --- Inventory ---------------------------------------------------------------

public sealed record StockItemDto(int Id, LocalizedText? Name, string? Unit, bool IsActive);

public sealed record StockItemRequest(LocalizedText Name, string Unit, decimal? PackSize, LocalizedText? PackName, bool AutoSoldOut, bool? IsActive = true);

public sealed record ProposeRecipesRequest(List<MenuItemToTrack> Items, string? Languages = null);

public sealed record MenuItemToTrack(int CatalogItemId, LocalizedText Name, LocalizedText? Description, string? Category, decimal Price, List<MenuOptionToTrack>? Options, string? Brief);

public sealed record MenuOptionToTrack(int Id, string Group, LocalizedText Name);

public sealed record RecipesProposal(List<ProposedIngredient>? NewItems, List<ProposedRecipe>? Recipes, List<string>? Warnings, string? Notes);

public sealed record ProposedIngredient(string Key, LocalizedText Name, string Unit, decimal? PackSize, LocalizedText? PackName, bool AutoSoldOut);

public sealed record ProposedRecipe(int CatalogItemId, string Kind, List<ProposedRecipeLine>? Lines, List<string>? Warnings);

public sealed record ProposedRecipeLine(int? StockItemId, string? NewItemKey, decimal Quantity, List<int>? OptionIds, int Slot, bool None);

public sealed record RecipeRequest(List<RecipeLineInput> Lines);

public sealed record RecipeLineInput(int StockItemId, decimal Quantity, List<int>? OptionIds, int Slot, bool None);

public sealed record TrackByUnitRequest(int CatalogItemId, LocalizedText Name);
