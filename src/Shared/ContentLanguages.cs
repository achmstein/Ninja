#nullable enable
namespace Ninja;

/// <summary>
/// Which languages a tenant writes its own text in (its menu, places, stock,
/// branches): <see cref="Both"/>, or one of them only. A one-language
/// tenant's admin asks for that language alone, its customers read the apps
/// in it, and the assistant writes only it. The apps' own words (buttons,
/// messages) are translated either way; this is about the tenant's text.
/// </summary>
/// <remarks>
/// One source, linked into Tenant and Control and into Ninja.AI (which
/// Catalog, Inventory and Finance reach it through).
/// </remarks>
public static class ContentLanguages
{
    public const string Both = "both";
    public const string Arabic = "ar";
    public const string English = "en";

    public static bool IsValid(string? value) => value is Both or Arabic or English;

    /// <summary>Lower-cased and trimmed; anything that is not a known value reads as <see cref="Both"/>.</summary>
    public static string Normalize(string? value)
    {
        var v = value?.Trim().ToLowerInvariant();
        return IsValid(v) ? v! : Both;
    }

    /// <summary>True when a business writing in <paramref name="languages"/> writes <paramref name="language"/> ("ar" or "en").</summary>
    public static bool Writes(string languages, string language) =>
        languages == Both || languages == language;

    /// <summary>The language the customer app opens in: the tenant's only one, else the default it chose.</summary>
    public static string Opening(string languages, string defaultLanguage) =>
        languages is Arabic or English ? languages : defaultLanguage;

    /// <summary>
    /// The rule every assistant prompt that writes names states, for the
    /// "languages" field its user message carries.
    /// </summary>
    public const string PromptRule = """
        - "languages" in the user message is the languages the business writes its own text in: "both", "ar"
          (Arabic only) or "en" (English only). With "ar", fill only the Arabic fields (nameAr, descriptionAr, …) and
          leave every English one ""; with "en", the reverse. Never translate into a language the business does not write.
        """;

    /// <summary>
    /// What to keep of one text the assistant wrote, as (en, ar), each null
    /// when empty. With both languages, both sides as written. With one, only
    /// that side; when the model left it empty but wrote the other, that text
    /// moves over if its script is the tenant's (Arabic letters for Arabic,
    /// none for English): a name on the wrong side is still the name. Text in
    /// the other script stays where it is rather than being lost, so the owner
    /// sees it in the review and can fix it.
    /// </summary>
    public static (string? En, string? Ar) Keep(string? en, string? ar, string languages)
    {
        en = string.IsNullOrWhiteSpace(en) ? null : en;
        ar = string.IsNullOrWhiteSpace(ar) ? null : ar;
        return languages switch
        {
            Arabic when ar is not null => (null, ar),
            Arabic when en is not null && HasArabicLetter(en) => (null, en),
            English when en is not null => (en, null),
            English when ar is not null && !HasArabicLetter(ar) => (ar, null),
            _ => (en, ar),
        };
    }

    private static bool HasArabicLetter(string text)
    {
        foreach (var c in text)
        {
            if (c is >= '\u0600' and <= '\u06FF' or >= '\u0750' and <= '\u077F' or >= '\u08A0' and <= '\u08FF'
                or >= '\uFB50' and <= '\uFDFF' or >= '\uFE70' and <= '\uFEFF')
                return true;
        }
        return false;
    }
}
