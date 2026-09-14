using System.Text.RegularExpressions;
using Chillax.AI.Json;

namespace Chillax.Catalog.API.Assist;

/// <summary>
/// Turns the model's answer into the response the form gets: the source
/// side is always what the user typed, the target side is cleaned and
/// capped, and anything odd becomes a warning instead of a silent edit.
/// </summary>
public static partial class LocalizerPostProcessor
{
    public const int MaxNameLength = 120;
    public const int MaxDescriptionLength = 600;

    public static LocalizeResponse Apply(LocalizeRequest request, LocalizeResult result, IReadOnlyList<CatalogType> categories)
    {
        var filled = new List<string>();
        var warnings = new List<string>();

        var name = Merge("name", request.Name, result.Name, MaxNameLength, filled, warnings);

        LocalizedText? description = null;
        if (request.Description is not null && HasText(request.Description))
            description = Merge("description", request.Description, result.Description, MaxDescriptionLength, filled, warnings);
        else if (request.Description is not null)
            description = request.Description;

        int? suggested = null;
        if (request.SuggestCategory)
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

    /// <summary>The source side comes from the request; the target side from the model, cleaned.</summary>
    private static LocalizedText Merge(string field, LocalizedText source, LocalizedPair? answer, int maxLength, List<string> filled, List<string> warnings)
    {
        var sourceIsEnglish = !string.IsNullOrWhiteSpace(source.En);
        var target = AIJson.Clean(sourceIsEnglish ? answer?.Ar : answer?.En, maxLength);
        var targetKey = sourceIsEnglish ? "ar" : "en";

        if (target.Length == 0)
        {
            warnings.Add($"The assistant left the {(sourceIsEnglish ? "Arabic" : "English")} {field} empty.");
            return source;
        }

        if (PriceWording().IsMatch(target))
        {
            target = AIJson.Clean(PriceWording().Replace(target, string.Empty), maxLength);
            warnings.Add($"Removed price wording from the {field}.");
            if (target.Length == 0)
            {
                warnings.Add($"The assistant's {field} was only price wording; nothing filled in.");
                return source;
            }
        }

        if (sourceIsEnglish && !ArabicLetter().IsMatch(target))
            warnings.Add($"The Arabic {field} contains no Arabic letters; check it.");

        filled.Add($"{field}.{targetKey}");
        return sourceIsEnglish
            ? new LocalizedText(source.En, target)
            : new LocalizedText(target, source.Ar);
    }

    public static bool HasText(LocalizedText text) => !string.IsNullOrWhiteSpace(text.En) || !string.IsNullOrWhiteSpace(text.Ar);

    /// <summary>Exactly one side filled in, both within the caps; the reason when not.</summary>
    public static string? Validate(LocalizeRequest request)
    {
        var en = !string.IsNullOrWhiteSpace(request.Name.En);
        var ar = !string.IsNullOrWhiteSpace(request.Name.Ar);
        if (en == ar)
            return "Fill in the name in exactly one language, English or Arabic.";

        if ((request.Name.En?.Length ?? 0) > MaxNameLength || (request.Name.Ar?.Length ?? 0) > MaxNameLength)
            return $"The name is longer than {MaxNameLength} characters.";

        var hasDescription = request.Description is not null && HasText(request.Description);
        if (request.Kind != LocalizeKind.MenuItem && (hasDescription || request.SuggestCategory))
            return "Only menu items have a description and a category.";

        if (hasDescription)
        {
            var description = request.Description!;
            var descEn = !string.IsNullOrWhiteSpace(description.En);
            var descAr = !string.IsNullOrWhiteSpace(description.Ar);
            if (descEn && descAr)
                return "The description is already filled in in both languages.";
            if (descEn != en)
                return "Fill in the description in the same language as the name.";
            if ((description.En?.Length ?? 0) > MaxDescriptionLength || (description.Ar?.Length ?? 0) > MaxDescriptionLength)
                return $"The description is longer than {MaxDescriptionLength} characters.";
        }

        return null;
    }

    [GeneratedRegex(@"\s*[\(\-–,]?\s*\d+([.,]\d+)?\s*(EGP|LE|L\.E\.?|ج\.م\.?|جنيه|جم)\b[\)]?", RegexOptions.IgnoreCase)]
    private static partial Regex PriceWording();

    [GeneratedRegex(@"\p{IsArabic}")]
    private static partial Regex ArabicLetter();
}
