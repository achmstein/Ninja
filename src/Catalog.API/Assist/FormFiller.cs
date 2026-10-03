using System.Text.Json;
using Ninja.AI.Agents;
using Ninja.AI.Json;
using Microsoft.Extensions.AI;

namespace Ninja.Catalog.API.Assist;

/// <summary>
/// Fills in a form's empty fields from what is already typed in it (a dish's
/// name, a supplier's name, a stock item's unit): the other language, a
/// description, the fitting choice. One agent call per form; the answer is
/// checked by <see cref="FormFillPostProcessor"/> before it leaves.
/// </summary>
public sealed class FormFiller(INinjaAgentFactory factory)
{
    public const string AgentKey = "form-filler";

    public static readonly AgentDefinition Definition = new(
        AgentKey,
        "Form filler",
        "Fills in the empty fields of an admin form from the ones already typed",
        Instructions,
        Temperature: 0.3f,
        MaxOutputTokens: 900,
        Timeout: TimeSpan.FromSeconds(30));

    /// <summary>False when no chat model is configured; the endpoint answers 503.</summary>
    public bool IsEnabled => factory.IsEnabled;

    public async Task<FillFormResponse> FillAsync(FillFormRequest request, CancellationToken ct)
    {
        var prompt = new FillFormPrompt(request.Form.Trim(), FormFillPostProcessor.FieldsToFill(request), request.Fields);

        var agent = factory.Create(Definition);
        var messages = new List<ChatMessage>
        {
            new(ChatRole.User, JsonSerializer.Serialize(prompt, AIJson.Options)),
        };

        var run = await agent.RunAsync<FillFormResult>(messages, ct);
        return FormFillPostProcessor.Apply(request, run.Result);
    }

    private const string Instructions = $"""
        #agent: {AgentKey}
        You fill in a form in the back office of a café, restaurant or kitchen in Egypt. The user message is a JSON
        object: "form" says what the form makes (a menu item, a supplier, an expense…), "fields" is every field with
        its key, label, type, current value (empty when nothing is typed), its options when it is a choice, and its
        language when it is one side of a two-language text; "fill" lists the keys you may answer.

        Rules:
        - Answer only keys in "fill", each at most once. Leave out any key you cannot tell from the fields already
          filled; an unanswered field is better than a guess.
        - Never invent money (prices, amounts, salaries, costs), quantities, dates, phone numbers, emails, addresses
          or account numbers: leave those out unless the filled fields state them.
        - A field with language "ar" or "en" is the other side of a field with the same key before the dot: say the
          same thing in that language. Arabic is Egyptian menu Arabic, the way a café's menu reads ("قهوة تركي",
          "مشروبات مثلجة"), everyday words over formal ones; brand and drink names are transliterated (Latte → لاتيه).
          English names are Title Case.
        - A LongText with no other side (a description, a note) is one plain sentence, at most 15 words, nothing the
          filled fields do not imply: no origins, no health claims, no "best".
        - A Choice is answered with one of its options' "value" exactly; pick the one the filled fields point to.
        - A YesNo is answered "true" or "false"; a Number with digits only.
        - notes is normally an empty string; use it only when the filled fields make no sense for the form.
        - Answer with the JSON object only.
        """;
}
