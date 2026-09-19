namespace Ninja.Catalog.API.Assist;

/// <summary>
/// The assistant proposes the option groups a customer picks from when
/// ordering a menu item (size, sugar, milk, extras…). The item is sent as
/// the form has it — saved or not yet — so the groups can come back while
/// the item is still being added. Nothing is saved: the groups go back for
/// the user to keep, edit or discard.
/// </summary>
/// <param name="Name">The item's name as typed, in one language or both.</param>
/// <param name="Description">As typed; may be empty.</param>
/// <param name="CatalogTypeId">The item's category, when one is picked.</param>
/// <param name="Price">The item's price in pounds; 0 when not typed yet.</param>
/// <param name="ExistingGroups">Names of the groups the item already has, so none is proposed twice.</param>
public sealed record SuggestCustomizationsRequest(
    LocalizedText Name,
    LocalizedText? Description = null,
    int? CatalogTypeId = null,
    decimal Price = 0,
    IReadOnlyList<LocalizedText>? ExistingGroups = null);

/// <param name="Groups">Proposed groups, in the order to show them; groups the item already has are left out.</param>
/// <param name="Warnings">Anything worth a second look, in plain words.</param>
public sealed record SuggestCustomizationsResponse(IReadOnlyList<ProposedCustomization> Groups, IReadOnlyList<string> Warnings);

/// <summary>One proposed group, in the shape the customization form keeps.</summary>
public sealed record ProposedCustomization(LocalizedText Name, bool IsRequired, bool AllowMultiple, IReadOnlyList<ProposedOption> Options);

public sealed record ProposedOption(LocalizedText Name, decimal PriceAdjustment, bool IsDefault);

/// <summary>What the model answers; every field required so the schema stays simple for every provider.</summary>
public sealed record CustomizationsResult(IReadOnlyList<CustomizationGroupResult> Groups, string Notes);

public sealed record CustomizationGroupResult(LocalizedPair Name, bool IsRequired, bool AllowMultiple, IReadOnlyList<CustomizationOptionResult> Options);

public sealed record CustomizationOptionResult(LocalizedPair Name, decimal PriceAdjustment, bool IsDefault);

/// <summary>What the model is shown, as JSON.</summary>
/// <param name="Item">The item to propose for.</param>
/// <param name="ExistingGroups">Names of the groups the item already has, not to be proposed again.</param>
/// <param name="Examples">Groups from other items on the menu: the house's wording and prices.</param>
internal sealed record CustomizationsPrompt(
    CustomizationsItem Item,
    IReadOnlyList<string> ExistingGroups,
    IReadOnlyList<CustomizationExample> Examples);

internal sealed record CustomizationsItem(LocalizedPair Name, LocalizedPair Description, string Category, decimal Price);

internal sealed record CustomizationExample(string Item, CustomizationGroupResult Group);
