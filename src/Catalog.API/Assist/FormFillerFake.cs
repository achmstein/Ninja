using System.Text.Json;
using Ninja.AI.Fake;
using Ninja.AI.Json;

namespace Ninja.Catalog.API.Assist;

/// <summary>
/// What the form filler answers under test: every key it may fill, a text
/// as "{label} (fake)", a choice as its first option, a number as 1, a
/// yes-or-no as false. Deterministic, so the E2E suite can assert on it.
/// </summary>
public static class FormFillerFake
{
    public static string Respond(FakeAgentRequest request)
    {
        var prompt = JsonSerializer.Deserialize<FillFormPrompt>(request.UserText, AIJson.Options)
            ?? throw new InvalidOperationException("The form filler prompt is not the expected JSON");

        var fields = prompt.Fields.ToDictionary(f => f.Key, StringComparer.Ordinal);
        var values = prompt.Fill
            .Select(key => fields[key])
            .Select(f => new FilledValue(f.Key, f.Type switch
            {
                FormFieldType.Choice => f.Options![0].Value,
                FormFieldType.Number => "1",
                FormFieldType.YesNo => "false",
                _ => $"{f.Label} (fake)",
            }))
            .ToList();

        return JsonSerializer.Serialize(new FillFormResult(values, string.Empty), AIJson.Options);
    }
}
