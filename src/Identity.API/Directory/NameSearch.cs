using System.Globalization;
using System.Text;

using Ninja.ServiceDefaults.Names;

namespace Ninja.Identity.API.Directory;

/// <summary>
/// How a cashier's typing is matched against a customer: the way Loyverse
/// feels, because the whole list is local. The name is matched by sound
/// (<see cref="NameMatch"/>, shared with Ninja AI): either script finds a
/// name saved in the other (محمد finds Mohamed), any spelling finds it
/// (Muhammad, Mohammed), each typed word may be only the start of a word,
/// words run together or apart are one name ("elhady" finds "El Hady"), and
/// a typo in a longer word still scores. Digits match the phone number
/// anywhere. Pure functions; the directory applies them.
/// </summary>
public static class NameSearch
{
    /// <summary>
    /// Lower-case, accents and Arabic diacritics stripped, Arabic letter
    /// variants unified (أ إ آ → ا, ة → ه, ى → ي, ؤ → و, ئ → ي), tatweel,
    /// apostrophes and dots removed, hyphens and underscores read as spaces
    /// (so "El-Hady" is two words, and "elhady" still finds it run together),
    /// whitespace collapsed.
    /// </summary>
    public static string Normalize(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var decomposed = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposed.Length);
        var lastWasSpace = true;
        foreach (var ch in decomposed)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(ch);
            if (category == UnicodeCategory.NonSpacingMark) continue; // accents, tashkeel
            var c = ch switch
            {
                'أ' or 'إ' or 'آ' or 'ٱ' => 'ا',
                'ة' => 'ه',
                'ى' or 'ئ' => 'ي',
                'ؤ' => 'و',
                'ـ' or '\'' or '’' or '.' => '\0',
                '-' or '_' => ' ',
                _ => char.ToLowerInvariant(ch),
            };
            if (c == '\0') continue;
            if (char.IsWhiteSpace(c))
            {
                if (!lastWasSpace) sb.Append(' ');
                lastWasSpace = true;
                continue;
            }
            sb.Append(c);
            lastWasSpace = false;
        }
        return sb.ToString().Trim();
    }

    /// <summary>Just the digits of a phone number, so "+20 100-123" and "0100123" compare.</summary>
    public static string Digits(string? text) =>
        string.IsNullOrEmpty(text) ? string.Empty : new string(text.Where(char.IsDigit).ToArray());

    /// <summary>
    /// A query typed as a number (digits with optional +, spaces, dashes) is
    /// one phone token; anything else is words.
    /// </summary>
    public static bool LooksLikePhone(string query)
    {
        var digits = Digits(query);
        return digits.Length >= 2 && digits.Length >= Normalize(query).Replace(" ", "").Length - 1;
    }

    /// <summary>
    /// How well a customer matches the query: 0 when any typed word matches
    /// nothing, otherwise higher for a closer name. A name whose first word
    /// was typed is ahead of one met at a later word, a whole word ahead of
    /// its start, and both ahead of a typo; an email or username hit comes
    /// last. Digits score against the phone number.
    /// </summary>
    public static double Score(
        string query,
        PreparedName name,
        string phoneDigits,
        string emailNormalized,
        string usernameNormalized)
    {
        if (LooksLikePhone(query))
        {
            var digits = Digits(query);
            return phoneDigits.Contains(digits, StringComparison.Ordinal) ? 1 : 0;
        }

        // Digits typed beside a name ("ahmed 0100") narrow by the phone; the rest is the name
        var words = query.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var numbers = words.Where(w => w.Length >= 2 && w.All(char.IsDigit)).ToList();
        if (numbers.Any(n => !phoneDigits.Contains(Digits(n), StringComparison.Ordinal))) return 0;
        var typed = numbers.Count == 0 ? query : string.Join(' ', words.Where(w => !numbers.Contains(w)));

        var said = PreparedName.Of(typed);
        if (said.Count == 0) return numbers.Count > 0 ? 1 : 0;

        if (NameMatch.Compare(said, name, typing: true) is { } how)
            return how.Closeness + (how.Leading ? LeadingWord : 0);

        var text = Normalize(typed).Replace(" ", "");
        return text.Length >= 2 && (emailNormalized.Contains(text, StringComparison.Ordinal) || usernameNormalized.Contains(text, StringComparison.Ordinal))
            ? LastResort
            : 0;
    }

    /// <summary>What a match on the name's first word is worth over one on a later word: less than any typo costs.</summary>
    private const double LeadingWord = 0.05;

    /// <summary>An email or username hit: below any name match.</summary>
    private const double LastResort = 0.1;
}
