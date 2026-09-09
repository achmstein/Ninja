using System.Globalization;
using System.Text;

namespace Chillax.Identity.API.Directory;

/// <summary>
/// How a cashier's typing is matched against a customer's name: the way
/// Loyverse feels, because the whole list is local. Names and queries are
/// normalized the same way (case, accents, Arabic letter variants, hyphens),
/// every typed word must be the start of some word of the name — or of the
/// name with its spaces removed, so "elhady" finds "El Hady" — and a typo
/// inside a word of four letters or more still scores. Digits match the
/// phone number anywhere. Pure functions; the directory applies them.
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

    /// <summary>The normalized words of a name.</summary>
    public static string[] Tokenize(string? text) =>
        Normalize(text).Split(' ', StringSplitOptions.RemoveEmptyEntries);

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
    /// nothing, otherwise the sum over words of the best match found — the
    /// first word of the name beats a later word, which beats the
    /// run-together form, which beats a typo, which beats an email or
    /// username hit. Digits score against the phone number.
    /// </summary>
    public static int Score(
        string query,
        string[] nameTokens,
        string phoneDigits,
        string emailNormalized,
        string usernameNormalized)
    {
        if (LooksLikePhone(query))
        {
            var digits = Digits(query);
            return phoneDigits.Contains(digits, StringComparison.Ordinal) ? 3 : 0;
        }

        var words = Tokenize(query);
        if (words.Length == 0) return 0;

        var total = 0;
        foreach (var word in words)
        {
            var best = 0;
            for (var i = 0; i < nameTokens.Length && best < 4; i++)
            {
                var token = nameTokens[i];
                if (token.StartsWith(word, StringComparison.Ordinal))
                {
                    best = Math.Max(best, i == 0 ? 4 : 3);
                }
                else if (i + 1 < nameTokens.Length && string.Concat(nameTokens.Skip(i)).StartsWith(word, StringComparison.Ordinal))
                {
                    best = Math.Max(best, 2);
                }
                else if (word.Length >= 4 && WithinOneEdit(word, token))
                {
                    best = Math.Max(best, 1);
                }
            }

            if (best == 0 && word.All(char.IsDigit) && phoneDigits.Contains(word, StringComparison.Ordinal))
            {
                best = 2;
            }

            if (best == 0 && (emailNormalized.Contains(word, StringComparison.Ordinal) || usernameNormalized.Contains(word, StringComparison.Ordinal)))
            {
                best = 1;
            }

            if (best == 0) return 0;
            total += best;
        }
        return total;
    }

    /// <summary>
    /// The typed word against the same-length start of the name's word,
    /// allowing one substitution, insertion, deletion or swapped pair —
    /// "ahemd" still finds Ahmed, "mohamd" still finds Mohamed.
    /// </summary>
    public static bool WithinOneEdit(string word, string token)
    {
        if (token.Length == 0) return false;
        var prefix = token.Length > word.Length + 1 ? token[..(word.Length + 1)] : token;
        return DamerauLevenshtein(word, prefix) <= 1 || DamerauLevenshtein(word, token.Length > word.Length ? token[..word.Length] : token) <= 1;
    }

    private static int DamerauLevenshtein(string a, string b)
    {
        var d = new int[a.Length + 1, b.Length + 1];
        for (var i = 0; i <= a.Length; i++) d[i, 0] = i;
        for (var j = 0; j <= b.Length; j++) d[0, j] = j;
        for (var i = 1; i <= a.Length; i++)
        {
            for (var j = 1; j <= b.Length; j++)
            {
                var cost = a[i - 1] == b[j - 1] ? 0 : 1;
                d[i, j] = Math.Min(Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1), d[i - 1, j - 1] + cost);
                if (i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1])
                {
                    d[i, j] = Math.Min(d[i, j], d[i - 2, j - 2] + 1);
                }
            }
        }
        return d[a.Length, b.Length];
    }
}
