using System.Globalization;
using System.Text;

namespace Ninja.ServiceDefaults.Names;

/// <summary>One word of a name: as written (lower case, marks off), as its sounds, and whether in Arabic letters.</summary>
public readonly record struct NameWord(string Text, string Sounds, bool Arabic);

/// <summary>
/// Turns a name into the sounds it is compared by (<see cref="SoundDistance"/>).
///
/// A sound is one character:
/// - a consonant: a lower-case letter. x is the sh of ش and "sh", "ch",
///   "sch"; j is ج, "j" and "g"; q is ق; θ and ð are ث and ذ ("th", "dh"),
///   said t or s, d or z depending on the country;
/// - H: an h closing the word, often silent (Sarah, فاطمه);
/// - a long vowel, which Arabic writes: A (ا), W (و), Y (ي), and E, the ى
///   closing a name (said a, typed ي as often);
/// - a short vowel, which only Latin letters write: a e i o u. The ain and
///   the hamza are one too, since Latin letters write them as a vowel.
///
/// Latin letters are read the way names are spelled across languages
/// (English, French and German pairs: sh ch sch tch dj ph ou oo ee, c
/// before e and i), and the Arabic script with its Persian and Urdu
/// letters. A letter of any other script is its own sound, so such names
/// still match letter for letter, with a typo forgiven.
/// </summary>
public static class NameSounds
{
    /// <summary>Names that close in ى are typed with ي as often as not (Egypt most of all).</summary>
    private static readonly HashSet<string> ClosedWithYa =
        ["مصطفي", "موسي", "عيسي", "يحيي", "مني", "هدي", "ندي", "سلمي", "ليلي", "نهي", "لبني", "بشري", "مرتضي", "نجوي", "سلوي", "فدوي", "يسري", "حسني", "ذكري", "رضوي", "اروي", "ضحي"];

    public static bool IsArabic(char c) => c is (>= '؀' and <= 'ۿ') or (>= 'ݐ' and <= 'ݿ') or (>= 'ﭐ' and <= '﷿') or (>= 'ﹰ' and <= '﻿');

    public static bool IsShort(char c) => c is 'a' or 'e' or 'i' or 'o' or 'u';

    public static bool IsLong(char c) => c is 'A' or 'W' or 'Y' or 'E';

    /// <summary>The words of a name: accents and Arabic marks off, anything that is not a letter or digit a space, lower case.</summary>
    public static NameWord[] Words(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return [];
        var sb = new StringBuilder(name.Length);
        // Presentation forms (ﻣﺤﻤﺪ pasted from a PDF) become the letters first
        foreach (var ch in name.Normalize(NormalizationForm.FormKD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) is UnicodeCategory.NonSpacingMark or UnicodeCategory.EnclosingMark) continue;
            if (ch is 'ـ' or '\'' or '’' or '`' or '.') continue;
            sb.Append(char.IsLetterOrDigit(ch) ? char.ToLowerInvariant(ch) : ' ');
        }
        return [.. sb.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Select(t => new NameWord(t, Sounds(t), t.Any(IsArabic)))
            .Where(w => w.Sounds.Length > 0)];
    }

    /// <summary>One word (lower case, marks off) as its sounds.</summary>
    public static string Sounds(string word)
    {
        var sb = new StringBuilder(word.Length);
        void Add(char c)
        {
            // A doubled sound is said once
            if (sb.Length == 0 || sb[^1] != c) sb.Append(c);
        }
        if (word.Any(IsArabic)) Arabic(word, Add);
        else Latin(word, Add);
        return sb.ToString();
    }

    private static void Arabic(string word, Action<char> add)
    {
        // The waw closing عمرو is not said: it is Amr
        if (word == "عمرو") word = "عمر";
        if (ClosedWithYa.Contains(word)) word = word[..^1] + 'ى';
        // The alef of "ال" after عبد is not a long vowel: عبدالله is Abdullah as much as Abdallah
        var article = word.StartsWith("عبدال", StringComparison.Ordinal) ? 3 : -1;

        for (var i = 0; i < word.Length; i++)
        {
            var closing = i == word.Length - 1 && i > 0;
            char? sound = word[i] switch
            {
                'ا' or 'ٱ' => i == 0 || i == article ? 'a' : 'A',
                'ى' => 'E',
                'و' => 'W',
                'ي' or 'ی' or 'ے' => 'Y',
                'ة' or 'ء' or 'ع' => 'a',
                'ه' or 'ہ' or 'ھ' => closing ? 'H' : 'h',
                'ح' => 'h',
                'ب' => 'b',
                'پ' => 'p',
                'ت' or 'ط' or 'ٹ' => 't',
                'ث' => 'θ',
                'ج' or 'غ' or 'گ' or 'ژ' => 'j',
                'چ' or 'ش' => 'x',
                'خ' or 'ك' or 'ک' => 'k',
                'ق' => 'q',
                'د' or 'ض' or 'ڈ' => 'd',
                'ذ' => 'ð',
                'ز' or 'ظ' => 'z',
                'ر' or 'ڑ' => 'r',
                'س' or 'ص' => 's',
                'ف' => 'f',
                'ڤ' => 'v',
                'ل' => 'l',
                'م' => 'm',
                'ن' or 'ں' => 'n',
                _ => null,
            };
            if (sound is { } s) add(s);
        }
    }

    private static void Latin(string word, Action<char> add)
    {
        for (var i = 0; i < word.Length; i++)
        {
            var c = word[i];
            var next = i + 1 < word.Length ? word[i + 1] : '\0';
            var prev = i > 0 ? word[i - 1] : '\0';

            // Three letters for one sound: Schmidt, Tchaikovsky
            if (i + 2 < word.Length && (c, next, word[i + 2]) is ('s', 'c', 'h') or ('t', 'c', 'h'))
            {
                add('x');
                i += 2;
                continue;
            }
            char? pair = (c, next) switch
            {
                ('s', 'h') or ('c', 'h') => 'x',
                ('k', 'h') or ('c', 'k') => 'k',
                ('g', 'h') or ('d', 'j') => 'j',
                ('t', 'h') => 'θ',
                ('d', 'h') => 'ð',
                ('p', 'h') => 'f',
                ('a', 'a') => 'A',
                ('e', 'e') => 'Y',
                ('o', 'o') or ('o', 'u') => 'W',
                _ => null,
            };
            if (pair is { } two)
            {
                add(two);
                i++;
                continue;
            }
            if (c == 'x')
            {
                add('k');
                add('s');
                continue;
            }
            char sound = c switch
            {
                // "ai" and "ei" are a ya after a vowel: Hussein, Ismail
                'i' when prev is 'a' or 'e' => 'Y',
                'a' or 'e' or 'i' or 'o' or 'u' => c,
                'y' => 'Y',
                'w' => 'W',
                'h' => i == word.Length - 1 && i > 0 ? 'H' : 'h',
                'c' => next is 'e' or 'i' or 'y' ? 's' : 'k',
                'g' => 'j',
                // Chat-Arabic digits: 7 is ح, 3 is ع, 2 is hamza, 5 is خ, 8 is غ, 9 is ص, 6 is ط
                '7' => 'h',
                '3' or '2' => 'a',
                '5' => 'k',
                '8' => 'j',
                '9' => 's',
                '6' => 't',
                // Every other letter, of this script or another, is its own sound
                _ => char.IsLetter(c) ? c : '\0',
            };
            if (sound != '\0') add(sound);
        }
    }
}
