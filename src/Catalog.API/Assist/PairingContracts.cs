using Ninja.AI.Text;

namespace Ninja.Catalog.API.Assist;

/// <summary>
/// The assistant proposes what to suggest alongside an item ("goes well
/// with"), from the menu and from what the item is actually bought with.
/// Nothing is saved: the proposals go back to the item's pairings list,
/// to keep, reorder or drop before Save.
/// </summary>
/// <param name="ItemId">The item, saved: pairings are only kept for saved items.</param>
/// <param name="Current">The items its list holds now, saved or not, so none is proposed twice.</param>
/// <param name="Together">What the item was bought with on settled tickets (the sales pairs report), most often first; empty for a new item.</param>
/// <param name="TicketsWithItem">How many settled tickets had the item, for the counts' weight.</param>
/// <param name="Languages">The business's languages: "both", "ar" or "en"; the reasons come back in those. Null is both.</param>
/// <param name="Note">The owner's own word on what to suggest ("desserts only", "no drinks"), in either language.</param>
public sealed record SuggestPairingsRequest(
    int ItemId,
    IReadOnlyList<int>? Current = null,
    IReadOnlyList<BoughtTogether>? Together = null,
    int TicketsWithItem = 0,
    string? Languages = null,
    string? Note = null);

/// <param name="Together">Tickets that had both items.</param>
public sealed record BoughtTogether(int CatalogItemId, int Together);

/// <param name="Items">Proposed items, best first, at most as many as the list has room for.</param>
/// <param name="Warnings">Anything worth a second look, in plain words.</param>
public sealed record SuggestPairingsResponse(IReadOnlyList<ProposedPairing> Items, IReadOnlyList<string> Warnings);

/// <param name="Reason">Why it goes with the item, a few words, in the business's languages.</param>
public sealed record ProposedPairing(int CatalogItemId, LocalizedText Reason);

/// <summary>What the model answers; every field required so the schema stays simple for every provider.</summary>
public sealed record PairingsResult(IReadOnlyList<PairingResult> Items, string Notes);

public sealed record PairingResult(int Id, LocalizedPair Reason);

/// <summary>What the model is shown, as JSON.</summary>
/// <param name="Item">The item to suggest for.</param>
/// <param name="Menu">Every other item that can be ordered now.</param>
/// <param name="AlreadySuggested">Ids already on the item's list, not to be proposed again.</param>
/// <param name="BoughtWith">Real sales: how often each item was on the same ticket.</param>
/// <param name="Examples">Other items' lists: the owner's own taste in pairings.</param>
/// <param name="Room">How many to propose at most.</param>
internal sealed record PairingsPrompt(
    PairingsMenuItem Item,
    IReadOnlyList<PairingsMenuItem> Menu,
    IReadOnlyList<int> AlreadySuggested,
    PairingsSales BoughtWith,
    IReadOnlyList<PairingsExample> Examples,
    int Room,
    string Languages = ContentLanguages.Both,
    string Note = "");

internal sealed record PairingsMenuItem(int Id, string Name, string Category, decimal Price);

/// <param name="TicketsWithItem">Settled tickets that had the item; 0 when it is new or has not sold.</param>
internal sealed record PairingsSales(int TicketsWithItem, IReadOnlyList<BoughtTogether> Together);

internal sealed record PairingsExample(string Item, IReadOnlyList<string> SuggestedWith);
