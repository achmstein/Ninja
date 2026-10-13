using System.Text.Json;
using Ninja.AI.Fake;
using Ninja.AI.Json;

namespace Ninja.Catalog.API.Assist;

/// <summary>
/// What the suggester answers under test: the items bought together most
/// often, then the menu in its order, up to the room left. Deterministic, so
/// the E2E suite can assert on it; the post-processor still drops anything
/// the list could not take.
/// </summary>
public static class PairingSuggesterFake
{
    public static string Respond(FakeAgentRequest request)
    {
        var prompt = JsonSerializer.Deserialize<PairingsPrompt>(request.UserText, AIJson.Options)
            ?? throw new InvalidOperationException("The pairing prompt is not the expected JSON");

        var picks = prompt.BoughtWith.Together.Select(t => t.CatalogItemId)
            .Concat(prompt.Menu.Select(m => m.Id))
            .Where(id => !prompt.AlreadySuggested.Contains(id))
            .Distinct()
            .Take(prompt.Room)
            .Select(id => new PairingResult(id, new LocalizedPair("Goes well with it", "حلو معاه")))
            .ToList();

        return JsonSerializer.Serialize(new PairingsResult(picks, string.Empty), AIJson.Options);
    }
}
