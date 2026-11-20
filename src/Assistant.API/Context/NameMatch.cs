using System.Globalization;
using System.Text;

namespace Ninja.Assistant.API.Context;

/// <summary>
/// How close a name as it was said is to a name as it is saved, in either
/// script. Each word becomes its sounds: the consonants, the long vowels
/// Arabic writes (ا و ي) and the short ones only Latin letters write. Two
/// words are then compared sound by sound: a consonant apart costs a whole
/// point, a long vowel most of one, and a short vowel next to nothing across
/// scripts, where Arabic never wrote it. So محمد is Mohamed, Mohammed and
/// Muhammad, and is not Mahmoud (محمود); حسن is Hassan and not Hussein.
/// Words written apart or together are the same name: "El Ameen", "ElAmeen",
/// "Al-Amin" and الأمين, "Abd El Rahman" and عبدالرحمن.
/// </summary>
public static class NameMatch
{
    /// <summary>One word of a name as its sounds, and whether it was written in Arabic letters.</summary>
    public readonly record struct Word(string Sounds, bool Arabic, string Text);

    /// <summary>How well one account's name answers what was said.</summary>
    /// <param name="Closeness">0 to 1: how alike the words said are to the words they met; 1 is the same name.</param>
    /// <param name="Covered">The share of the saved name's words that were said.</param>
    /// <param name="Weakest">The least alike of the words said: one wrong word is not hidden by the right ones.</param>
    public readonly record struct Result(double Closeness, double Covered, double Weakest)
    {
        /// <summary>Close enough to act on without asking: spelling and script differ, the name does not.</summary>
        public bool Sure => Weakest >= 0.9;

        /// <summary>For ranking: the whole name said beats the same words inside a longer name.</summary>
        public double Score => Closeness * (0.85 + 0.15 * Covered);

        /// <summary>The whole name, said as it is saved (spelling and script aside).</summary>
        public bool WholeName => Covered >= 1 && Sure;
    }

    private const int LongestRun = 3;

    private static readonly HashSet<string> ClosedWithYa =
        ["مصطفي", "موسي", "عيسي", "يحيي", "مني", "هدي", "ندي", "سلمي", "ليلي", "نهي", "لبني", "بشري", "مرتضي", "نجوي", "سلوي", "فدوي", "يسري", "حسني", "ذكري", "رضوي", "اروي", "ضحي"];

    /// <summary>The words of a name: accents and Arabic marks off, hyphens as spaces, lower case.</summary>
    public static Word[] Words(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return [];
        var sb = new StringBuilder(name.Length);
        foreach (var ch in name.Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark) continue;
            if (ch is 'ـ' or '\'' or '’' or '`' or '.') continue;
            sb.Append(char.IsLetterOrDigit(ch) ? char.ToLowerInvariant(ch) : ' ');
        }
        return [.. sb.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Select(t => new Word(Sounds(t), t.Any(IsArabic), t))
            .Where(w => w.Sounds.Length > 0)];
    }

    private static bool IsArabic(char c) => c is >= '؀' and <= 'ۿ';

    private static bool IsWeak(char c) => c is 'a' or 'e' or 'i' or 'o' or 'u';

    private static bool IsLong(char c) => c is 'A' or 'W' or 'Y' or 'E';

    /// <summary>
    /// A word as its sounds. Consonants are lower-case letters (x is ش, j is
    /// ج and غ, k is ك ق خ), θ and ð are ث and ذ (said t or s, z or d), H is an
    /// h closing the word (often silent); A W Y are the long vowels and E the
    /// ى that closes a name (said a, typed ي as often); a e i o u
    /// are short vowels, and the ain and hamza that Latin letters write as one.
    /// </summary>
    public static string Sounds(string word)
    {
        var sb = new StringBuilder(word.Length);
        void Add(char c)
        {
            if (sb.Length == 0 || sb[^1] != c) sb.Append(c);
        }

        if (word.Any(IsArabic))
        {
            // The waw closing عمرو is not said: it is Amr
            if (word == "عمرو") word = "عمر";
            // Names that end in ى are typed with ي as often as not
            if (ClosedWithYa.Contains(word)) word = word[..^1] + 'ى';
            // The alef of "ال" after عبد is not a long vowel: عبدالله is Abdullah as much as Abdallah
            var article = word.StartsWith("عبدال", StringComparison.Ordinal) ? 3 : -1;
            for (var i = 0; i < word.Length; i++)
            {
                var last = i == word.Length - 1;
                char? sound = word[i] switch
                {
                    'ا' or 'ٱ' => i == 0 || i == article ? 'a' : 'A',
                    'ى' => 'E',
                    'و' => 'W',
                    'ي' or 'ی' => 'Y',
                    'ة' or 'ء' or 'ع' => 'a',
                    'ه' => last && i > 0 ? 'H' : 'h',
                    'ب' or 'پ' => 'b',
                    'ت' or 'ط' => 't',
                    'ث' => 'θ',
                    'ج' or 'غ' or 'چ' or 'گ' => 'j',
                    'ح' => 'h',
                    'خ' or 'ق' or 'ك' or 'ک' => 'k',
                    'د' or 'ض' => 'd',
                    'ذ' => 'ð',
                    'ز' or 'ظ' => 'z',
                    'ر' => 'r',
                    'س' or 'ص' => 's',
                    'ش' => 'x',
                    'ف' or 'ڤ' => 'f',
                    'ل' => 'l',
                    'م' => 'm',
                    'ن' => 'n',
                    _ => null,
                };
                if (sound is { } s) Add(s);
            }
            return sb.ToString();
        }

        for (var i = 0; i < word.Length; i++)
        {
            var c = word[i];
            var next = i + 1 < word.Length ? word[i + 1] : '\0';
            var prev = i > 0 ? word[i - 1] : '\0';

            // Two letters for one sound
            char? pair = (c, next) switch
            {
                ('s', 'h') or ('c', 'h') => 'x',
                ('k', 'h') => 'k',
                ('g', 'h') => 'j',
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
                Add(two);
                i++;
                continue;
            }

            if (c == 'x')
            {
                Add('k');
                Add('s');
                continue;
            }
            char? sound = c switch
            {
                // "ai" and "ei" are a ya after a vowel: Hussein, Ismail
                'i' when prev is 'a' or 'e' => 'Y',
                'a' or 'e' or 'i' or 'o' or 'u' => c,
                'y' => 'Y',
                'w' => 'W',
                'h' => i == word.Length - 1 && i > 0 ? 'H' : 'h',
                'b' or 'p' => 'b',
                't' or '6' => 't',
                'j' or 'g' or '8' => 'j',
                'k' or 'q' or 'c' or '5' => 'k',
                'd' => 'd',
                'z' => 'z',
                'r' => 'r',
                's' or '9' => 's',
                'f' or 'v' => 'f',
                'l' => 'l',
                'm' => 'm',
                'n' => 'n',
                // Chat-Arabic digits: 7 is ح, 3 is ع, 2 is hamza
                '7' => 'h',
                '3' or '2' => 'a',
                _ => null,
            };
            if (sound is { } s) Add(s);
        }
        return sb.ToString();
    }

    /// <summary>
    /// What was said against one saved name: every word said must meet a word
    /// of the name (or words run together, on either side), each word of the
    /// name used once. Null when a word said meets nothing.
    /// </summary>
    public static Result? Compare(IReadOnlyList<Word> said, IReadOnlyList<Word> name)
    {
        if (said.Count is 0 or > 6 || name.Count is 0 or > 30) return null;
        var best = Best(said, 0, name, 0);
        if (best.Sum < 0) return null;
        return new(best.Sum / said.Count, (double)BitCount(best.Used) / name.Count, best.Weakest);
    }

    private static int BitCount(int mask) => System.Numerics.BitOperations.PopCount((uint)mask);

    /// <summary>The best pairing of the words said from <paramref name="from"/> on with the name's words not yet used.</summary>
    private static (double Sum, int Used, double Weakest) Best(IReadOnlyList<Word> said, int from, IReadOnlyList<Word> name, int used)
    {
        if (from == said.Count) return (0, used, 1);
        (double Sum, int Used, double Weakest) best = (-1, used, 0);
        for (var take = 1; take <= LongestRun && from + take <= said.Count; take++)
        {
            var (saidSounds, saidArabic) = Run(said, from, take);
            for (var start = 0; start < name.Count; start++)
            {
                for (var len = 1; len <= LongestRun && start + len <= name.Count; len++)
                {
                    // Words run together on one side only: two against two is each against each
                    if (take > 1 && len > 1) break;
                    var mask = ((1 << len) - 1) << start;
                    if ((used & mask) != 0) break;
                    var (nameSounds, nameArabic) = Run(name, start, len);
                    var alike = Alike(saidSounds, nameSounds, saidArabic != nameArabic);
                    if (alike <= 0 && take == 1 && len == 1)
                        alike = StartOf(said[from], name[start]);
                    if (alike <= 0) continue;
                    var rest = Best(said, from + take, name, used | mask);
                    if (rest.Sum < 0) continue;
                    // A run of words said counts as that many words
                    var sum = alike * take + rest.Sum;
                    if (sum > best.Sum + 1e-9) best = (sum, rest.Used, Math.Min(alike, rest.Weakest));
                }
            }
        }
        return best;
    }

    private static (string Sounds, bool Arabic) Run(IReadOnlyList<Word> words, int start, int count)
    {
        if (count == 1) return (words[start].Sounds, words[start].Arabic);
        var sb = new StringBuilder();
        for (var i = start; i < start + count; i++)
            foreach (var c in words[i].Sounds)
                if (sb.Length == 0 || sb[^1] != c) sb.Append(c);
        return (sb.ToString(), words[start].Arabic);
    }

    /// <summary>A name typed part-way ("moh" for Mohamed), in the script it is saved in: a weaker match than the word.</summary>
    private static double StartOf(Word said, Word name) =>
        said.Arabic == name.Arabic && said.Text.Length >= 3 && name.Text.Length > said.Text.Length && name.Text.StartsWith(said.Text, StringComparison.Ordinal)
            ? 0.7
            : 0;

    /// <summary>
    /// 0 when the two are different words, up to 1 for the same one. A short
    /// word must agree in every consonant; one of four sounds or more may
    /// have one wrong (a typo, a letter heard differently).
    /// </summary>
    public static double Alike(string said, string name, bool acrossScripts)
    {
        var solid = said.Count(c => !IsWeak(c));
        var allowed = solid <= 2 ? 0.3 : solid == 3 ? 0.6 : 1.25;
        var cost = Distance(said, name, acrossScripts);
        return cost > allowed ? 0 : 1 - cost / (solid + 1);
    }

    /// <summary>The cheapest way to turn one word's sounds into the other's.</summary>
    public static double Distance(string a, string b, bool acrossScripts)
    {
        var d = new double[a.Length + 1, b.Length + 1];
        for (var i = 1; i <= a.Length; i++) d[i, 0] = d[i - 1, 0] + Drop(a[i - 1], i - 1, acrossScripts);
        for (var j = 1; j <= b.Length; j++) d[0, j] = d[0, j - 1] + Drop(b[j - 1], j - 1, acrossScripts);
        for (var i = 1; i <= a.Length; i++)
        {
            for (var j = 1; j <= b.Length; j++)
            {
                var x = a[i - 1];
                var y = b[j - 1];
                var cost = Math.Min(
                    d[i - 1, j] + Drop(x, i - 1, acrossScripts),
                    d[i, j - 1] + Drop(y, j - 1, acrossScripts));
                cost = Math.Min(cost, d[i - 1, j - 1] + Swap(x, y, acrossScripts));
                // "th" read as one sound where the name has a t then an h (Fathy, فتحي), and "dh" (Medhat, مدحت)
                if (j > 1 && TwoSounds(x, b[j - 2], y)) cost = Math.Min(cost, d[i - 1, j - 2]);
                if (i > 1 && TwoSounds(y, a[i - 2], x)) cost = Math.Min(cost, d[i - 2, j - 1]);
                d[i, j] = cost;
            }
        }
        return d[a.Length, b.Length];
    }

    private static bool TwoSounds(char one, char first, char second) =>
        second is 'h' or 'H' && ((one == 'θ' && first == 't') || (one == 'ð' && first == 'd'));

    /// <summary>What a sound costs when the other word has nothing for it.</summary>
    private static double Drop(char c, int at, bool acrossScripts)
    {
        if (IsWeak(c))
        {
            if (!acrossScripts) return 0.2;
            // Arabic does not write short vowels. A Latin i or u away from the start is usually a long one
            return at == 0 ? 0 : c switch { 'i' => 0.25, 'u' => 0.15, _ => 0 };
        }
        // A long vowel is part of the name: محمود is not محمد
        if (IsLong(c)) return 0.75;
        return c == 'H' ? 0.1 : 1;
    }

    /// <summary>What one sound costs in place of another.</summary>
    private static double Swap(char x, char y, bool acrossScripts)
    {
        if (x == y) return 0;
        if (IsWeak(x) && IsWeak(y))
        {
            if (acrossScripts) return 0;
            return (x, y) switch
            {
                ('a', 'e') or ('e', 'a') or ('o', 'u') or ('u', 'o') => 0.1,
                ('i', 'e') or ('e', 'i') => 0.15,
                _ => 0.4,
            };
        }
        if (IsWeak(x) || IsWeak(y))
        {
            var (weak, other) = IsWeak(x) ? (x, y) : (y, x);
            return (weak, other) switch
            {
                ('a', 'A') or ('e', 'A') or ('o', 'W') or ('u', 'W') or ('i', 'Y') or ('a', 'E') or ('e', 'E') => 0,
                ('e', 'Y') => 0.1,
                (_, 'A') or (_, 'W') or (_, 'Y') or (_, 'E') => 0.75,
                _ => double.PositiveInfinity,
            };
        }
        if (IsLong(x) && IsLong(y))
            // ى is typed ي (على for علي) and written ا (منا for منى); ي and ا are different names (علي, علا)
            return (x, y) is ('E', 'Y') or ('Y', 'E') or ('E', 'A') or ('A', 'E') ? 0.1 : 0.8;
        if (IsLong(x) || IsLong(y)) return double.PositiveInfinity;
        return (x, y) switch
        {
            ('θ', 't') or ('t', 'θ') or ('θ', 's') or ('s', 'θ') => 0,
            ('ð', 'z') or ('z', 'ð') or ('ð', 'd') or ('d', 'ð') => 0,
            ('H', 'h') or ('h', 'H') => 0,
            _ => 1,
        };
    }

    /// <summary>A phone's digits without the country code or the leading zero, so +20 100 123 and 0100123 compare.</summary>
    public static string PhoneCore(string? phone)
    {
        if (string.IsNullOrEmpty(phone)) return "";
        var digits = new string([.. phone.Where(char.IsDigit).Select(c => (char)('0' + CharUnicodeInfo.GetDecimalDigitValue(c)))]);
        if (digits.StartsWith("00", StringComparison.Ordinal)) digits = digits[2..];
        if (digits.StartsWith("20", StringComparison.Ordinal) && digits.Length >= 12) digits = digits[2..];
        return digits.TrimStart('0');
    }
}
