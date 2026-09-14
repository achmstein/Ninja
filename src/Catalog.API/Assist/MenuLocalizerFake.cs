using System.Text.Json;
using Chillax.AI.Fake;
using Chillax.AI.Json;

namespace Chillax.Catalog.API.Assist;

/// <summary>
/// What the localizer answers under test: the source text marked as fake
/// in the other language, and the first category when one is asked for.
/// Deterministic, so the E2E suite can assert on it.
/// </summary>
public static class MenuLocalizerFake
{
    public static string Respond(FakeAgentRequest request)
    {
        var prompt = JsonSerializer.Deserialize<LocalizePrompt>(request.UserText, AIJson.Options)
            ?? throw new InvalidOperationException("The localizer prompt is not the expected JSON");

        var result = new LocalizeResult(
            Fill(prompt.Name),
            Fill(prompt.Description),
            prompt.SuggestCategory ? prompt.Categories.Select(c => c.Id).FirstOrDefault() : 0,
            string.Empty);

        return JsonSerializer.Serialize(result, AIJson.Options);
    }

    private static LocalizedPair Fill(LocalizedPair pair)
    {
        if (pair.En.Length == 0 && pair.Ar.Length == 0)
            return pair;
        return pair.En.Length > 0
            ? new LocalizedPair(pair.En, $"{pair.En} (تجريبي)")
            : new LocalizedPair($"{pair.Ar} (fake)", pair.Ar);
    }
}
