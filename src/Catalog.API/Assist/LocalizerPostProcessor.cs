using System.Text.RegularExpressions;
using Ninja.AI.Json;

namespace Ninja.Catalog.API.Assist;

/// <summary>
/// Decides what the assistant is asked to fill in, and turns its answer
/// into the response the form gets: what the user typed is always kept,
/// what the model wrote is cleaned and capped, and anything odd becomes a
/// warning instead of a silent edit.
/// </summary>
public static partial class LocalizerPostProcessor
{
    public const int MaxNameLength = 120;
    public const int MaxDescriptionLength = 600;

    public const string NameEn = "name.en";
    public const string NameAr = "name.ar";
    public const string DescriptionEn = "description.en";
    public const string DescriptionAr = "description.ar";
    public const string CategoryId = "categoryId";

    /// <summary>
    /// The fields the model is told to produce and the only ones taken from
    /// its answer: the empty side of a half-filled name or description, both
    /// sides of a description that is asked for and empty, the category when
    /// asked for.
    /// </summary>
    public static IReadOnlyList<string> FieldsToFill(LocalizeRequest request)
    {
        var fill = new List<string>();

        if (EmptySide(request.Name) is { } nameSide)
            fill.Add($"name.{nameSide}");

        var description = request.Description ?? new LocalizedText();
        if (HasText(description))
        {
            if (EmptySide(description) is { } side)
                fill.Add($"description.{side}");
        }
        else if (request.SuggestDescription)
        {
            fill.Add(DescriptionEn);
            fill.Add(DescriptionAr);
        }

        if (request.SuggestCategory)
            fill.Add(CategoryId);

        return fill;
    }

    public static LocalizeResponse Apply(LocalizeRequest request, LocalizeResult result, IReadOnlyList<CatalogType> categories)
    {
        var fill = FieldsToFill(request);
        var filled = new List<string>();
        var warnings = new List<string>();

        var name = Merge("name", request.Name, result.Name, MaxNameLength, fill, filled, warnings);

        var description = request.Description;
        if (fill.Contains(DescriptionEn) || fill.Contains(DescriptionAr))
            description = Merge("description", request.Description ?? new LocalizedText(), result.Description, MaxDescriptionLength, fill, filled, warnings);

        int? suggested = null;
        if (fill.Contains(CategoryId))
        {
            if (result.SuggestedCategoryId > 0 && categories.Any(c => c.Id == result.SuggestedCategoryId))
            {
                suggested = result.SuggestedCategoryId;
                filled.Add("catalogTypeId");
            }
            else if (result.SuggestedCategoryId > 0)
            {
                warnings.Add("The assistant suggested a category that does not exist; pick one yourself.");
            }
        }

        var notes = AIJson.Clean(result.Notes, 200);
        if (notes.Length > 0)
            warnings.Add($"Assistant: {notes}");

        return new LocalizeResponse(name, description, suggested, filled, warnings);
    }

    /// <summary>The sides listed in <paramref name="fill"/> come from the model, cleaned; every other side is the user's text.</summary>
    private static LocalizedText Merge(string field, LocalizedText source, LocalizedPair? answer, int maxLength, IReadOnlyList<string> fill, List<string> filled, List<string> warnings)
    {
        var en = source.En;
        var ar = source.Ar;

        if (fill.Contains($"{field}.en") && Take(field, "en", answer?.En, maxLength, filled, warnings) is { } newEn)
            en = newEn;
        if (fill.Contains($"{field}.ar") && Take(field, "ar", answer?.Ar, maxLength, filled, warnings) is { } newAr)
            ar = newAr;

        return new LocalizedText(en, ar);
    }

    /// <summary>One side of the model's answer, cleaned and checked; null when it is unusable, with a warning saying why.</summary>
    private static string? Take(string field, string side, string? text, int maxLength, List<string> filled, List<string> warnings)
    {
        var language = side == "ar" ? "Arabic" : "English";
        var value = AIJson.Clean(text, maxLength);

        if (value.Length == 0)
        {
            warnings.Add($"The assistant left the {language} {field} empty.");
            return null;
        }

        if (PriceWording().IsMatch(value))
        {
            value = AIJson.Clean(PriceWording().Replace(value, string.Empty), maxLength);
            warnings.Add($"Removed price wording from the {field}.");
            if (value.Length == 0)
            {
                warnings.Add($"The assistant's {field} was only price wording; nothing filled in.");
                return null;
            }
        }

        if (side == "ar" && !ArabicLetter().IsMatch(value))
            warnings.Add($"The Arabic {field} contains no Arabic letters; check it.");

        filled.Add($"{field}.{side}");
        return value;
    }

    public static bool HasText(LocalizedText text) => !string.IsNullOrWhiteSpace(text.En) || !string.IsNullOrWhiteSpace(text.Ar);

    /// <summary>"en" or "ar" when exactly that side is empty; null when both are filled or both empty.</summary>
    private static string? EmptySide(LocalizedText text)
    {
        var en = !string.IsNullOrWhiteSpace(text.En);
        var ar = !string.IsNullOrWhiteSpace(text.Ar);
        if (en == ar) return null;
        return en ? "ar" : "en";
    }

    /// <summary>The name has text, everything is within the caps and there is something to fill in; the reason when not.</summary>
    public static string? Validate(LocalizeRequest request)
    {
        if (!HasText(request.Name))
            return "Type the name in English or Arabic first.";

        if ((request.Name.En?.Length ?? 0) > MaxNameLength || (request.Name.Ar?.Length ?? 0) > MaxNameLength)
            return $"The name is longer than {MaxNameLength} characters.";

        var hasDescription = request.Description is not null && HasText(request.Description);
        if (request.Kind != LocalizeKind.MenuItem && (hasDescription || request.SuggestCategory || request.SuggestDescription))
            return "Only menu items have a description and a category.";

        if (hasDescription)
        {
            var description = request.Description!;
            // One source language: a half-filled description is filled from the same side as the name
            if (EmptySide(description) is { } missing && EmptySide(request.Name) is { } nameMissing && missing != nameMissing)
                return "Fill in the description in the same language as the name.";
            if ((description.En?.Length ?? 0) > MaxDescriptionLength || (description.Ar?.Length ?? 0) > MaxDescriptionLength)
                return $"The description is longer than {MaxDescriptionLength} characters.";
        }

        if (FieldsToFill(request).Count == 0)
            return "Nothing to fill in: both languages are already filled in.";

        return null;
    }

    [GeneratedRegex(@"\s*[\(\-–,]?\s*\d+([.,]\d+)?\s*(EGP|LE|L\.E\.?|ج\.م\.?|جنيه|جم)\b[\)]?", RegexOptions.IgnoreCase)]
    private static partial Regex PriceWording();

    [GeneratedRegex(@"\p{IsArabic}")]
    private static partial Regex ArabicLetter();
}
