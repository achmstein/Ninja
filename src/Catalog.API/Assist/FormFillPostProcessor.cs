using System.Globalization;

namespace Ninja.Catalog.API.Assist;

/// <summary>
/// Decides which fields the assistant may fill and checks what it wrote:
/// only fields that were empty, only in the business's languages, a choice
/// only from its options, a number only as a number. Whatever fails is
/// dropped, never guessed at; the owner's own values are never touched.
/// </summary>
public static class FormFillPostProcessor
{
    public const int MaxFields = 40;
    public const int MaxTextLength = 120;
    public const int MaxLongTextLength = 600;
    public const int MaxFormLength = 80;

    /// <summary>A reason the request cannot be answered, or null.</summary>
    public static string? Validate(FillFormRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Form) || request.Form.Length > MaxFormLength)
            return $"Say what the form makes, in under {MaxFormLength} characters.";
        if (request.Fields is not { Count: > 0 })
            return "Send the form's fields.";
        if (request.Fields.Count > MaxFields)
            return $"Send at most {MaxFields} fields.";
        if (request.Fields.Select(f => f.Key).Distinct(StringComparer.Ordinal).Count() != request.Fields.Count)
            return "Each field needs its own key.";
        if (request.Fields.Any(f => string.IsNullOrWhiteSpace(f.Key) || string.IsNullOrWhiteSpace(f.Label)))
            return "Every field needs a key and a label.";
        if (request.Fields.Any(f => f.Type == FormFieldType.Choice && f.Options is not { Count: > 0 }))
            return "A choice needs its options.";
        if (FieldsToFill(request).Count == 0)
            return "Nothing is empty to fill in.";
        if (!request.Fields.Any(f => !IsEmpty(f)))
            return "Fill in something first (a name): the rest is filled in from it.";
        return null;
    }

    /// <summary>The keys the model may answer: empty fields, in a language the business writes.</summary>
    public static IReadOnlyList<string> FieldsToFill(FillFormRequest request)
    {
        var languages = ContentLanguages.Normalize(request.Languages);
        return request.Fields
            .Where(IsEmpty)
            .Where(f => f.Language is not ("en" or "ar") || ContentLanguages.Writes(languages, f.Language))
            .Select(f => f.Key)
            .ToList();
    }

    public static FillFormResponse Apply(FillFormRequest request, FillFormResult result)
    {
        var allowed = FieldsToFill(request).ToHashSet(StringComparer.Ordinal);
        var fields = request.Fields.ToDictionary(f => f.Key, StringComparer.Ordinal);
        var values = new List<FilledValue>();
        var warnings = new List<string>();
        var seen = new HashSet<string>(StringComparer.Ordinal);

        foreach (var answer in result.Values)
        {
            if (!allowed.Contains(answer.Key) || !seen.Add(answer.Key)) continue;
            var field = fields[answer.Key];
            if (Clean(field, answer.Value) is { } value)
                values.Add(new FilledValue(field.Key, value));
        }

        if (!string.IsNullOrWhiteSpace(result.Notes))
            warnings.Add(result.Notes.Trim());

        return new FillFormResponse(values, warnings);
    }

    private static string? Clean(FormField field, string? raw)
    {
        var value = raw?.Trim();
        if (string.IsNullOrEmpty(value)) return null;

        switch (field.Type)
        {
            case FormFieldType.Text:
                return Cap(value, MaxTextLength);
            case FormFieldType.LongText:
                return Cap(value, MaxLongTextLength);
            case FormFieldType.Number:
                return decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var number) && number >= 0
                    ? number.ToString(CultureInfo.InvariantCulture)
                    : null;
            case FormFieldType.Choice:
                return field.Options!.FirstOrDefault(o => string.Equals(o.Value, value, StringComparison.Ordinal))?.Value;
            case FormFieldType.YesNo:
                return value.ToLowerInvariant() switch
                {
                    "true" or "yes" => "true",
                    "false" or "no" => "false",
                    _ => null,
                };
            default:
                return null;
        }
    }

    private static string Cap(string value, int max) => value.Length <= max ? value : value[..max].TrimEnd();

    private static bool IsEmpty(FormField field) => string.IsNullOrWhiteSpace(field.Value);
}
