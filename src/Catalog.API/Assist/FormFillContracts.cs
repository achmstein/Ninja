using System.ComponentModel;

namespace Ninja.Catalog.API.Assist;

/// <summary>What a field holds, so the answer can be checked against it.</summary>
public enum FormFieldType
{
    Text = 0,
    LongText = 1,
    Number = 2,
    Choice = 3,
    YesNo = 4,
}

/// <param name="Value">What the form sends for the choice (an id, a code).</param>
/// <param name="Label">What the owner reads for it.</param>
public sealed record FormFieldOption(string Value, string Label);

/// <param name="Key">The form's own name for the field; one language of a two-language text is its own field ("name.ar").</param>
/// <param name="Label">What the owner reads above the field, in English, with its language when it is one side of a pair ("Name (Arabic)").</param>
/// <param name="Type">What it holds.</param>
/// <param name="Value">What is in it now; empty when nothing is.</param>
/// <param name="Options">A choice's options; the answer is one of their values.</param>
/// <param name="Language">"en" or "ar" when the field is written in one language.</param>
public sealed record FormField(
    string Key,
    string Label,
    FormFieldType Type,
    string? Value = null,
    IReadOnlyList<FormFieldOption>? Options = null,
    string? Language = null);

/// <summary>
/// A form as it stands: what it is for and its fields, some filled in. The
/// assistant fills the empty ones it can tell from the rest; nothing is
/// saved, and nothing the owner typed is changed.
/// </summary>
/// <param name="Form">What the form makes, in plain words ("a menu item", "a supplier", "an expense").</param>
/// <param name="Fields">Up to 40 fields, in the form's order.</param>
/// <param name="Languages">The business's languages: "both", "ar" or "en"; a field in a language it does not write is left alone. Null is both.</param>
public sealed record FillFormRequest(
    [property: Description("What the form makes, in plain words")] string Form,
    IReadOnlyList<FormField> Fields,
    string? Languages = null);

/// <param name="Values">The filled fields: key and value, only fields that were empty.</param>
/// <param name="Warnings">Anything worth a second look, in plain words.</param>
public sealed record FillFormResponse(
    IReadOnlyList<FilledValue> Values,
    IReadOnlyList<string> Warnings);

public sealed record FilledValue(string Key, string Value);

/// <summary>What the model answers; a list rather than a map, so every provider's schema can carry it.</summary>
public sealed record FillFormResult(IReadOnlyList<FilledValue> Values, string Notes);

/// <summary>What the model is shown, as JSON.</summary>
/// <param name="Fill">The keys it may answer: the empty fields in the business's languages.</param>
internal sealed record FillFormPrompt(
    string Form,
    IReadOnlyList<string> Fill,
    IReadOnlyList<FormField> Fields);
