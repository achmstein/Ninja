namespace Ninja.ServiceDefaults.Names;

/// <summary>
/// How far apart two words are, sound by sound (<see cref="NameSounds"/>).
/// A consonant apart costs a whole point. A long vowel costs most of one:
/// it is part of the name (محمود is not محمد, Hussein is not Hassan). A
/// short vowel costs little in one script (Ahmed, Ahmad) and nothing across
/// scripts, where Arabic never wrote it.
///
/// Called for every saved name on every keystroke of a search, so it works
/// on the stack: no allocation per comparison.
/// </summary>
public static class SoundDistance
{
    /// <summary>A word matched across scripts is a hair behind the same word in the script it was typed in.</summary>
    private const double AcrossScripts = 0.98;

    /// <summary>A word typed part-way is a hair behind the whole word.</summary>
    private const double PartWay = 0.97;

    /// <summary>Words longer than this are not names; they are compared on the heap.</summary>
    private const int OnStack = 64;

    /// <summary>
    /// 0 when the two are different words, up to 1 for the same one. A short
    /// word must agree in every consonant; one of four sounds or more may
    /// have one wrong (a typo, a letter heard differently).
    /// </summary>
    public static double Alike(ReadOnlySpan<char> said, ReadOnlySpan<char> name, bool acrossScripts)
    {
        var solid = Solid(said);
        var allowed = Allowed(solid);
        // Too different in length to be within what is allowed: not worth the table
        if (Solid(name) - solid > allowed + 2) return 0;

        Span<double> row = name.Length < OnStack ? stackalloc double[name.Length + 1] : new double[name.Length + 1];
        LastRow(said, name, acrossScripts, row);
        var cost = row[name.Length];
        return cost > allowed ? 0 : (acrossScripts ? AcrossScripts : 1) * (1 - cost / (solid + 1));
    }

    /// <summary>
    /// As <see cref="Alike"/>, for a word still being typed: it may also be
    /// the start of the name's word ("moh", "مح" for Mohamed).
    /// </summary>
    public static double AlikeTyping(ReadOnlySpan<char> said, ReadOnlySpan<char> name, bool acrossScripts)
    {
        var solid = Solid(said);
        // Vowels alone say nothing across scripts: "a" is not the start of every Arabic name
        if (solid == 0 && acrossScripts) return 0;

        Span<double> row = name.Length < OnStack ? stackalloc double[name.Length + 1] : new double[name.Length + 1];
        LastRow(said, name, acrossScripts, row);
        var allowed = Allowed(solid);
        var scale = acrossScripts ? AcrossScripts : 1;

        var whole = row[name.Length];
        var best = whole > allowed ? 0 : scale * (1 - whole / (solid + 1));

        var start = double.PositiveInfinity;
        for (var j = 1; j < name.Length; j++) start = Math.Min(start, row[j]);
        if (start <= allowed) best = Math.Max(best, scale * (PartWay - start / (solid + 1)));
        return best;
    }

    /// <summary>The cheapest way to turn one word's sounds into the other's.</summary>
    public static double Distance(ReadOnlySpan<char> a, ReadOnlySpan<char> b, bool acrossScripts)
    {
        Span<double> row = b.Length < OnStack ? stackalloc double[b.Length + 1] : new double[b.Length + 1];
        LastRow(a, b, acrossScripts, row);
        return row[b.Length];
    }

    private static int Solid(ReadOnlySpan<char> sounds)
    {
        var count = 0;
        foreach (var c in sounds)
            if (!NameSounds.IsShort(c)) count++;
        return count;
    }

    private static double Allowed(int solid) => solid <= 2 ? 0.3 : solid == 3 ? 0.6 : 1.25;

    /// <summary>
    /// The edit table's last row: <paramref name="last"/>[j] is the cost of
    /// turning all of <paramref name="a"/> into the first j sounds of
    /// <paramref name="b"/>. Three rows are kept, the third for a pair of
    /// sounds read as one.
    /// </summary>
    private static void LastRow(ReadOnlySpan<char> a, ReadOnlySpan<char> b, bool acrossScripts, Span<double> last)
    {
        var width = b.Length + 1;
        Span<double> rows = width <= OnStack ? stackalloc double[width * 3] : new double[width * 3];
        var before = rows[..width];
        var above = rows.Slice(width, width);
        var row = rows.Slice(width * 2, width);

        above[0] = 0;
        for (var j = 1; j < width; j++) above[j] = above[j - 1] + Drop(b[j - 1], j - 1, acrossScripts);

        for (var i = 1; i <= a.Length; i++)
        {
            var x = a[i - 1];
            row[0] = above[0] + Drop(x, i - 1, acrossScripts);
            for (var j = 1; j < width; j++)
            {
                var y = b[j - 1];
                var cost = Math.Min(above[j] + Drop(x, i - 1, acrossScripts), row[j - 1] + Drop(y, j - 1, acrossScripts));
                cost = Math.Min(cost, above[j - 1] + Swap(x, y, acrossScripts));
                // "th" read as one sound where the name has a t then an h (Fathy, فتحي), and "dh" (Medhat, مدحت)
                if (j > 1 && TwoSounds(x, b[j - 2], y)) cost = Math.Min(cost, above[j - 2]);
                if (i > 1 && TwoSounds(y, a[i - 2], x)) cost = Math.Min(cost, before[j - 1]);
                row[j] = cost;
            }
            // The row just filled becomes the one above; the oldest is written over next
            var free = before;
            before = above;
            above = row;
            row = free;
        }
        above.CopyTo(last);
    }

    private static bool TwoSounds(char one, char first, char second) =>
        second is 'h' or 'H' && ((one == 'θ' && first == 't') || (one == 'ð' && first == 'd'));

    /// <summary>What a sound costs when the other word has nothing for it.</summary>
    private static double Drop(char c, int at, bool acrossScripts)
    {
        if (NameSounds.IsShort(c))
        {
            if (!acrossScripts) return 0.2;
            // Arabic does not write short vowels. A Latin i or u away from the start is usually a long one
            return at == 0 ? 0 : c switch { 'i' => 0.25, 'u' => 0.15, _ => 0 };
        }
        if (NameSounds.IsLong(c)) return 0.75;
        return c == 'H' ? 0.1 : 1;
    }

    /// <summary>What one sound costs in place of another.</summary>
    private static double Swap(char x, char y, bool acrossScripts)
    {
        if (x == y) return 0;
        var (shortX, shortY) = (NameSounds.IsShort(x), NameSounds.IsShort(y));
        if (shortX && shortY)
        {
            if (acrossScripts) return 0;
            return (x, y) switch
            {
                ('a', 'e') or ('e', 'a') or ('o', 'u') or ('u', 'o') => 0.1,
                ('i', 'e') or ('e', 'i') => 0.15,
                _ => 0.4,
            };
        }
        if (shortX || shortY)
        {
            // A short vowel where the other has a long one: the same vowel, or a different name
            return (shortX ? (x, y) : (y, x)) switch
            {
                ('a', 'A') or ('e', 'A') or ('o', 'W') or ('u', 'W') or ('i', 'Y') or ('a', 'E') or ('e', 'E') => 0,
                ('e', 'Y') => 0.1,
                (_, 'A') or (_, 'W') or (_, 'Y') or (_, 'E') => 0.75,
                _ => double.PositiveInfinity,
            };
        }
        var (longX, longY) = (NameSounds.IsLong(x), NameSounds.IsLong(y));
        if (longX && longY)
            // ى is typed ي (على for علي) and written ا (منا for منى); ي and ا are different names (علي, علا)
            return (x, y) is ('E', 'Y') or ('Y', 'E') or ('E', 'A') or ('A', 'E') ? 0.1 : 0.8;
        if (longX || longY) return double.PositiveInfinity;

        return Pair(x, y, acrossScripts) ?? Pair(y, x, acrossScripts) ?? 1;
    }

    /// <summary>Letters that stand for one another from country to country.</summary>
    private static double? Pair(char p, char q, bool acrossScripts) => (p, q) switch
    {
        ('θ', 't') or ('θ', 's') or ('ð', 'z') or ('ð', 'd') or ('H', 'h') => 0,
        // ق is q, k, and g in the Gulf and Upper Egypt
        ('q', 'k') => acrossScripts ? 0 : 0.1,
        ('q', 'j') => 0.25,
        // Arabic has no p or v: Paula is بولا, Victor فيكتور. In one script they are different letters
        ('p', 'b') or ('v', 'f') => acrossScripts ? 0 : 0.5,
        _ => null,
    };
}
