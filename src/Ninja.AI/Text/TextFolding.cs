using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Ninja.AI.Text;

/// <summary>
/// One spelling for text that means the same thing, so a name the model
/// read can be matched to a name already on file: Arabic is normalised (no
/// tashkeel, one alef, one ya, ة as ه, Arabic-Indic digits as Western),
/// Latin is lower-cased without diacritics, punctuation becomes spaces.
/// Shared by every service that matches what the assistant read against
/// its own records.
/// </summary>
public static partial class TextFolding
{
    public static string Fold(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return string.Empty;

        var builder = new StringBuilder(text.Length);
        foreach (var rune in text.Normalize(NormalizationForm.FormD).EnumerateRunes())
        {
            var c = rune.Value;
            switch (c)
            {
                case >= 0x064B and <= 0x0652: // tashkeel
                case 0x0640: // tatweel
                    continue;
                case 0x0622 or 0x0623 or 0x0625 or 0x0671: // alef with hamza / madda / wasla
                    builder.Append('ا');
                    continue;
                case 0x0629: // ta marbuta
                    builder.Append('ه');
                    continue;
                case 0x0649: // alef maqsura
                    builder.Append('ي');
                    continue;
                case 0x0624: // waw with hamza
                    builder.Append('و');
                    continue;
                case 0x0626: // ya with hamza
                    builder.Append('ي');
                    continue;
                case >= 0x0660 and <= 0x0669: // Arabic-Indic digits
                    builder.Append((char)('0' + (c - 0x0660)));
                    continue;
                case >= 0x06F0 and <= 0x06F9: // Eastern Arabic-Indic digits
                    builder.Append((char)('0' + (c - 0x06F0)));
                    continue;
            }

            var category = Rune.GetUnicodeCategory(rune);
            if (category == UnicodeCategory.NonSpacingMark)
                continue; // Latin diacritics after FormD

            if (Rune.IsLetterOrDigit(rune))
                builder.Append(Rune.ToLowerInvariant(rune).ToString());
            else
                builder.Append(' ');
        }

        return Whitespace().Replace(builder.ToString(), " ").Trim();
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();
}
