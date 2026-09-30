using Ninja.AI.Text;

namespace Ninja.Catalog.API.Assist;

/// <summary>
/// What the assistant proposes from the photos of a menu — the pages of a
/// printed menu, a board, a flyer. Nothing is saved: the user reviews every
/// section and item, picks or creates the categories, fixes prices, unticks
/// what is already on the menu, and the sheet saves the rest in one go
/// (<c>POST /menu/import</c>).
/// </summary>
/// <param name="Categories">The menu's sections in printed order, each with its items.</param>
/// <param name="Warnings">What to look at before accepting ("Hot Drinks, line 3: …").</param>
/// <param name="Notes">The assistant's own remark, when it had one.</param>
public sealed record MenuProposal(IReadOnlyList<ProposedCategory> Categories, IReadOnlyList<string> Warnings, string? Notes);

/// <param name="Name">The section heading in both languages.</param>
/// <param name="CatalogTypeId">The existing category this section corresponds to, when one does; the items go under it.</param>
/// <param name="Items">The section's items in printed order.</param>
public sealed record ProposedCategory(LocalizedText Name, int? CatalogTypeId, IReadOnlyList<ProposedItem> Items);

/// <param name="RawText">The line as printed, for the user to compare against.</param>
/// <param name="Name">English and Arabic, both filled in.</param>
/// <param name="Description">What the menu printed under the item, when anything; empty otherwise.</param>
/// <param name="Price">The printed price in EGP (the smallest, when several are printed); 0 when none was readable.</param>
/// <param name="ExistingItemId">A menu item that already has this name, so the row starts unticked.</param>
/// <param name="Choice">The printed prices of its sizes (or single/double, hot/iced…), when it has several; saved as a required option group.</param>
public sealed record ProposedItem(string RawText, LocalizedText Name, LocalizedText Description, decimal Price, int? ExistingItemId, ProposedChoice? Choice = null);

/// <summary>An item's printed choices: "Size" with Small 30, Medium 35, Large 40.</summary>
/// <param name="Name">What the choice is ("Size" / "الحجم").</param>
/// <param name="Options">Each choice with its full printed price, cheapest first.</param>
public sealed record ProposedChoice(LocalizedText Name, IReadOnlyList<ProposedChoiceOption> Options);

/// <param name="Price">The full printed price for this choice, not the difference.</param>
public sealed record ProposedChoiceOption(LocalizedText Name, decimal Price);

// What the model answers. Every field is required and nothing is nullable
// so the JSON schema stays plain enough for every provider; "" and 0 mean
// "none" and the validator turns them into nulls.

public sealed record MenuExtraction(IReadOnlyList<ExtractedCategory> Categories, string Notes);

public sealed record ExtractedCategory(string NameEn, string NameAr, int CatalogTypeId, IReadOnlyList<ExtractedItem> Items);

public sealed record ExtractedItem(
    string RawText, string NameEn, string NameAr, string DescriptionEn, string DescriptionAr, decimal Price,
    string ChoiceEn, string ChoiceAr, IReadOnlyList<ExtractedChoiceOption> Choices);

public sealed record ExtractedChoiceOption(string NameEn, string NameAr, decimal Price);

/// <summary>The text part of the prompt: the categories the system already has, to match sections to.</summary>
internal sealed record MenuScanPrompt(IReadOnlyList<CategoryOption> Categories, string Languages = ContentLanguages.Both);
