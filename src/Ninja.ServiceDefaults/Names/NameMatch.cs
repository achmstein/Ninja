using System.Numerics;
using System.Text;

namespace Ninja.ServiceDefaults.Names;

/// <summary>
/// A name made ready to be compared: its words as sounds, and every run of
/// neighbouring words said as one (Abd El Rahman, AbdEl, ElRahman,
/// AbdElRahman). Built once per saved name, when the list is loaded, and
/// once per search for what was typed; comparing two of them allocates
/// nothing.
/// </summary>
public sealed class PreparedName
{
    /// <summary>How many words may be run together into one.</summary>
    internal const int LongestRun = 3;

    /// <summary>A name longer than this is not compared: the pairing keeps the words used in one int.</summary>
    internal const int MostWords = 30;

    public static readonly PreparedName Empty = new([]);

    private readonly (string Sounds, bool Arabic)[][] _runs;

    private PreparedName(NameWord[] words)
    {
        Words = words;
        _runs = new (string, bool)[words.Length][];
        var sb = new StringBuilder();
        for (var start = 0; start < words.Length; start++)
        {
            var longest = Math.Min(LongestRun, words.Length - start);
            _runs[start] = new (string, bool)[longest];
            sb.Clear();
            for (var len = 1; len <= longest; len++)
            {
                // Where two words meet on the same sound it is said once, as inside a word
                foreach (var c in words[start + len - 1].Sounds)
                    if (sb.Length == 0 || sb[^1] != c) sb.Append(c);
                _runs[start][len - 1] = (len == 1 ? words[start].Sounds : sb.ToString(), words[start].Arabic);
            }
        }
    }

    public IReadOnlyList<NameWord> Words { get; }

    public int Count => Words.Count;

    public static PreparedName Of(string? name) => NameSounds.Words(name) is { Length: > 0 and <= MostWords } words ? new(words) : Empty;

    /// <summary>The words from <paramref name="start"/>, <paramref name="length"/> of them, said as one.</summary>
    internal (string Sounds, bool Arabic) Run(int start, int length) => _runs[start][length - 1];
}

/// <summary>
/// How close a name as it was said or typed is to a name as it is saved,
/// whichever script and spelling each is in. The one matcher behind the
/// till's customer search (Identity) and Ninja AI's (Assistant).
///
/// Words are compared by sound (<see cref="NameSounds"/>,
/// <see cref="SoundDistance"/>), so محمد is Mohamed, Mohammed and Muhammad
/// and is not Mahmoud. Words written apart or together are one name: "El
/// Ameen", "ElAmeen", "Al-Amin" and الأمين; "Abd El Rahman" and عبدالرحمن.
/// Word order does not matter, and each word of the saved name is used once.
/// </summary>
public static class NameMatch
{
    /// <summary>How well one saved name answers what was said.</summary>
    /// <param name="Closeness">0 to 1: how alike the words said are to the words they met; 1 is the same name.</param>
    /// <param name="Covered">The share of the saved name's words that were said.</param>
    /// <param name="Weakest">The least alike of the words said: one wrong word is not hidden by the right ones.</param>
    /// <param name="Leading">The saved name's first word was among those met.</param>
    public readonly record struct Result(double Closeness, double Covered, double Weakest, bool Leading = true)
    {
        /// <summary>For ranking: the whole name said beats the same words inside a longer name.</summary>
        public double Score => Closeness * (0.85 + 0.15 * Covered);

        /// <summary>Close enough to act on without asking: spelling and script differ, the name does not.</summary>
        public bool Sure => Weakest >= 0.9;

        /// <summary>The whole name, said as it is saved (spelling and script aside).</summary>
        public bool WholeName => Covered >= 1 && Sure;
    }

    /// <summary>More words than this is a sentence, not a name.</summary>
    private const int MostWordsSaid = 6;

    /// <summary>
    /// What was said against one saved name. Every word said must meet a word
    /// of the name, or words run together on either side. Null when a word
    /// said meets nothing.
    /// </summary>
    /// <param name="typing">
    /// The words are being typed into a search box: each may be only the
    /// start of a word ("moh sa" for Mohamed Samir).
    /// </param>
    public static Result? Compare(PreparedName said, PreparedName name, bool typing = false)
    {
        if (said.Count is 0 or > MostWordsSaid || name.Count == 0) return null;
        var best = Best(said, 0, name, 0, typing);
        if (best.Sum < 0) return null;
        return new(best.Sum / said.Count, (double)BitOperations.PopCount((uint)best.Used) / name.Count, best.Weakest, (best.Used & 1) != 0);
    }

    /// <summary>The same, from the names as text: for one comparison, not for a list.</summary>
    public static Result? Compare(string? said, string? name, bool typing = false) =>
        Compare(PreparedName.Of(said), PreparedName.Of(name), typing);

    /// <summary>The best pairing of the words said from <paramref name="from"/> on with the name's words not yet used.</summary>
    private static (double Sum, int Used, double Weakest) Best(PreparedName said, int from, PreparedName name, int used, bool typing)
    {
        if (from == said.Count) return (0, used, 1);
        (double Sum, int Used, double Weakest) best = (-1, used, 0);
        for (var take = 1; take <= PreparedName.LongestRun && from + take <= said.Count; take++)
        {
            var (saidSounds, saidArabic) = said.Run(from, take);
            for (var start = 0; start < name.Count; start++)
            {
                for (var len = 1; len <= PreparedName.LongestRun && start + len <= name.Count; len++)
                {
                    // Words run together on one side only: two against two is each against each
                    if (take > 1 && len > 1) break;
                    var mask = ((1 << len) - 1) << start;
                    if ((used & mask) != 0) break;
                    var (nameSounds, nameArabic) = name.Run(start, len);
                    var across = saidArabic != nameArabic;
                    var alike = typing
                        ? SoundDistance.AlikeTyping(saidSounds, nameSounds, across)
                        : SoundDistance.Alike(saidSounds, nameSounds, across);
                    if (alike <= 0 && !typing && take == 1 && len == 1)
                        alike = StartOf(said.Words[from], name.Words[start]);
                    if (alike <= 0) continue;
                    var rest = Best(said, from + take, name, used | mask, typing);
                    if (rest.Sum < 0) continue;
                    // A run of words said counts as that many words
                    var sum = alike * take + rest.Sum;
                    if (sum > best.Sum + 1e-9) best = (sum, rest.Used, Math.Min(alike, rest.Weakest));
                }
            }
        }
        return best;
    }

    /// <summary>
    /// A name said part-way ("moh" for Mohamed), in the script it is saved
    /// in: a weak match, to ask about and not to act on.
    /// </summary>
    private static double StartOf(NameWord said, NameWord name) =>
        said.Arabic == name.Arabic && said.Text.Length >= 3 && name.Text.Length > said.Text.Length && name.Text.StartsWith(said.Text, StringComparison.Ordinal)
            ? 0.7
            : 0;
}
