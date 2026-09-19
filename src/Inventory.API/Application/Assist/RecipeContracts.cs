#nullable enable
namespace Ninja.Inventory.API.Application.Assist;

/// <summary>
/// Menu items the back office wants tracked, as the menu page has them.
/// Inventory keeps no copy of the menu, so the names, descriptions and
/// options travel in the request; the shelf is added here.
/// </summary>
public sealed record ProposeRecipesRequest(IReadOnlyList<MenuItemToTrack> Items);

/// <param name="Options">The item's customization options (id, group and name) so a line can be tied to one.</param>
public sealed record MenuItemToTrack(
    int CatalogItemId,
    LocalizedText Name,
    LocalizedText? Description,
    string? Category,
    decimal Price,
    IReadOnlyList<MenuOptionToTrack>? Options);

public sealed record MenuOptionToTrack(int Id, string Group, LocalizedText Name);

/// <summary>
/// What the assistant proposes for a batch of menu items: the ingredients
/// the shelf is missing, then one stock rule per item. Nothing is saved:
/// the review sheet creates the ingredients it agrees with, then sets the
/// recipes (or tracks by unit) through the endpoints that already exist.
/// </summary>
/// <param name="NewItems">Ingredients not on the shelf yet, one per key, shared across the recipes that need them.</param>
/// <param name="Recipes">One per requested item, in the request's order.</param>
public sealed record RecipesProposal(
    IReadOnlyList<ProposedIngredient> NewItems,
    IReadOnlyList<ProposedRecipe> Recipes,
    IReadOnlyList<string> Warnings,
    string? Notes);

/// <param name="Key">The name the recipes refer to it by. An ingredient whose name is already on the shelf is not listed: its lines point at the shelf item instead.</param>
public sealed record ProposedIngredient(
    string Key,
    LocalizedText Name,
    string Unit,
    decimal? PackSize,
    string? PackName,
    bool AutoSoldOut);

/// <param name="Kind">"unit": the item is a stock item of its own, one per sale; "recipe": the lines below.</param>
/// <param name="Warnings">What to look at on this item before accepting.</param>
public sealed record ProposedRecipe(
    int CatalogItemId,
    string Kind,
    IReadOnlyList<ProposedRecipeLine> Lines,
    IReadOnlyList<string> Warnings);

/// <param name="StockItemId">An item on the shelf, or the shelf item a new ingredient matched.</param>
/// <param name="NewItemKey">Else the key of a proposed ingredient.</param>
/// <param name="Quantity">Per unit sold, in the ingredient's base unit.</param>
/// <param name="OptionIds">Empty for the slot's default; else every option the override needs chosen.</param>
/// <param name="Slot">Lines sharing a slot are one thing a sale takes: the default and its overrides.</param>
public sealed record ProposedRecipeLine(int? StockItemId, string? NewItemKey, decimal Quantity, IReadOnlyList<int> OptionIds, int Slot);

public static class RecipeKinds
{
    public const string Unit = "unit";
    public const string Recipe = "recipe";
}

// What the model answers. Every field is required and nothing is nullable
// so the JSON schema stays plain enough for every provider; "" and 0 mean
// "none" and the validator turns them into nulls.

public sealed record RecipesExtraction(IReadOnlyList<ExtractedIngredient> NewItems, IReadOnlyList<ExtractedRecipe> Recipes, string Notes);

public sealed record ExtractedIngredient(string Key, string NameEn, string NameAr, string Unit, decimal PackSize, string PackName, bool AutoSoldOut);

public sealed record ExtractedRecipe(int CatalogItemId, string Kind, IReadOnlyList<ExtractedRecipeLine> Lines);

public sealed record ExtractedRecipeLine(int StockItemId, string NewItemKey, decimal Quantity, IReadOnlyList<int> OptionIds, int Slot);

/// <summary>The prompt: the menu items to track and what is already on the shelf.</summary>
internal sealed record RecipesPrompt(IReadOnlyList<PromptMenuItem> Items, IReadOnlyList<CandidateItem> Shelf);

internal sealed record PromptMenuItem(int Id, string En, string Ar, string Description, string Category, decimal Price, IReadOnlyList<PromptOption> Options);

internal sealed record PromptOption(int Id, string Group, string En, string Ar);
