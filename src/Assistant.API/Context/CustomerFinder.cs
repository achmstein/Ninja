using System.Globalization;
using System.Text;
using Ninja.Assistant.API.Downstream;

namespace Ninja.Assistant.API.Context;

/// <summary>Where a customer is in the business right now: on an open bill, in a running room.</summary>
public sealed record CustomerWhereabouts(IReadOnlyList<OpenBillView> Bills, IReadOnlyList<RunningStayView> Stays)
{
    public static readonly CustomerWhereabouts None = new([], []);

    public IReadOnlyList<OpenBillView> BillsOf(DirectoryUserView user) =>
        [.. Bills.Where(b => (b.CustomerIds ?? []).Contains(user.Id) || Stays.Any(s => s.Has(user.Id) && (s.TicketId == b.Id || s.Id == b.SessionId)))];

    public IReadOnlyList<RunningStayView> StaysOf(DirectoryUserView user) => [.. Stays.Where(s => s.Has(user.Id))];

    public bool IsHere(DirectoryUserView user) => BillsOf(user).Count > 0 || StaysOf(user).Count > 0;

    /// <summary>"on Room 2's bill, in Room 2": for a list the owner picks from.</summary>
    public string? Describe(DirectoryUserView user)
    {
        var parts = BillsOf(user).Select(b => $"on the bill at {b.Where}")
            .Concat(StaysOf(user).Where(s => BillsOf(user).All(b => b.SessionId != s.Id && b.Id != s.TicketId)).Select(s => $"in {s.PlaceName?.Both ?? "a room"}"))
            .ToList();
        return parts.Count == 0 ? null : string.Join(", ", parts);
    }
}

/// <summary>What a customer search came to: one account, several to pick from, or none.</summary>
public sealed record CustomerSearch(DirectoryUserView? Match, IReadOnlyList<DirectoryUserView> Candidates, string? Why)
{
    public bool Ambiguous => Match is null && Candidates.Count > 1;
}

/// <summary>
/// Finds the customer the owner named, the way the till's customer search
/// does (Identity's directory: any word of the name, a typo, Arabic letter
/// variants, a phone's digits), in every spelling given at once: "Ahmed
/// Hassan / أحمد حسن" searches both, and a name said in one script is also
/// matched by sound against every account (أحمد finds the Ahmed saved in
/// English). Among several, an exact full name wins,
/// then the one person who is here right now (on an open bill or in a
/// room); otherwise the owner is asked, with phones to tell them apart.
/// Staff and switched-off accounts are not customers here.
/// </summary>
public static class CustomerFinder
{
    public const string Identity = "identity-api";
    private const string NotCustomers = "Admin,Owner,Cashier";
    private const int PerSpelling = 10;

    public const string SpellingDescription =
        "The customer as the owner said it: a name, a phone number, or an id from find_customer. For a name, also give its spelling in the other script after a slash, e.g. \"Ahmed Hassan / أحمد حسن\" or \"منى / Mona\", since an account may be saved in either.";

    public static string[] Spellings(string text) =>
        [.. text.Split(['/', '|', '،'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Where(s => s.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase)];

    public static async Task<CustomerSearch> FindAsync(NinjaApiClient api, int branchId, string? text, CustomerWhereabouts here, CancellationToken ct)
    {
        text = text?.Trim();
        if (string.IsNullOrEmpty(text)) return new(null, [], "Say which customer.");

        if (Guid.TryParse(text, out _))
        {
            // The till's own list (the by-id read is the admin's): the id from find_customer
            var listed = await api.GetAsync<List<DirectoryUserView>>(Identity, $"/api/identity/users?max=20000&excludeRole={NotCustomers}&enabled=true", branchId, ct);
            if (!listed.IsOk) return new(null, [], listed.Error);
            return (listed.Value ?? []).FirstOrDefault(u => u.Id.Equals(text, StringComparison.OrdinalIgnoreCase)) is { } user
                ? new(user, [user], null)
                : new(null, [], $"No customer has id {text}.");
        }

        var spellings = Spellings(text);
        var found = new List<DirectoryUserView>();
        foreach (var spelling in spellings)
        {
            var result = await api.GetAsync<List<DirectoryUserView>>(Identity,
                $"/api/identity/users?search={Uri.EscapeDataString(spelling)}&max={PerSpelling}&excludeRole={NotCustomers}&enabled=true", branchId, ct);
            if (!result.IsOk) return new(null, [], result.Error);
            foreach (var u in result.Value ?? [])
                if (found.All(f => f.Id != u.Id)) found.Add(u);
        }

        // Said in one script only: the account may be saved in the other ("أحمد" for
        // Ahmed). The whole directory is matched by how the name sounds
        if (!Mixed(spellings) && !spellings.All(LooksLikePhone))
        {
            var everyone = await api.GetAsync<List<DirectoryUserView>>(Identity, $"/api/identity/users?max=20000&excludeRole={NotCustomers}&enabled=true", branchId, ct);
            if (everyone.IsOk)
                foreach (var u in SoundsLike(everyone.Value ?? [], spellings))
                    if (found.All(f => f.Id != u.Id)) found.Add(u);
        }

        return Pick(found, spellings, here, text);
    }

    private static bool IsArabic(char c) => c is >= '\u0600' and <= '\u06FF';

    private static bool Mixed(IEnumerable<string> spellings) =>
        spellings.Any(s => s.Any(IsArabic)) && spellings.Any(s => s.Any(char.IsAsciiLetter));

    private static bool LooksLikePhone(string s) => s.Count(char.IsDigit) >= 3 && !s.Any(char.IsLetter);

    /// <summary>
    /// The accounts whose name sounds like what was said, in either script:
    /// every word said is the start of one of the name's words, by sound
    /// (<see cref="Sound"/>), whole words first.
    /// </summary>
    public static IEnumerable<DirectoryUserView> SoundsLike(IEnumerable<DirectoryUserView> users, IEnumerable<string> spellings)
    {
        var queries = spellings.Select(s => s.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(Sound).Where(w => w.Length >= 2).ToArray())
            .Where(q => q.Length > 0).ToList();
        if (queries.Count == 0) return [];

        return users
            .Select(u =>
            {
                var words = u.Name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(Sound).Where(w => w.Length > 0).ToArray();
                var best = 0;
                foreach (var q in queries)
                {
                    var score = 0;
                    foreach (var w in q)
                    {
                        var hit = words.Any(n => n == w) ? 2 : words.Any(n => n.StartsWith(w, StringComparison.Ordinal)) ? 1 : 0;
                        if (hit == 0) { score = 0; break; }
                        score += hit;
                    }
                    best = Math.Max(best, score);
                }
                return (User: u, Score: best);
            })
            .Where(x => x.Score > 0)
            .OrderByDescending(x => x.Score)
            .Take(PerSpelling)
            .Select(x => x.User);
    }

    /// <summary>
    /// A name word as it sounds, the same in Arabic and in English letters:
    /// its consonants, with the vowels, alef, waw and ya, hamza and ain left
    /// out and a doubled sound said once. "أحمد" and "Ahmed" are both hmd,
    /// "محمد" and "Mohammed" mhmd, "شريف" and "Sherif" xrf.
    /// </summary>
    public static string Sound(string word)
    {
        // Ta marbuta is said "a" in a name (فاطمة, Fatma): gone before it is read as ه
        var w = Normalize(word.Replace("ة", ""));
        var sb = new StringBuilder(w.Length);
        void Add(char c)
        {
            if (sb.Length == 0 || sb[^1] != c) sb.Append(c);
        }
        for (var i = 0; i < w.Length; i++)
        {
            var c = w[i];
            var next = i + 1 < w.Length ? w[i + 1] : '\0';
            // Two Latin letters for one Arabic sound
            if (next == 'h' && c is 's' or 'c' or 'k' or 't' or 'd' or 'g' or 'z')
            {
                Add(c switch { 's' or 'c' => 'x', 'k' => 'k', 't' => 't', 'd' => 'z', 'g' => 'j', _ => 'z' });
                i++;
                continue;
            }
            char? sound = c switch
            {
                'b' or 'p' or 'ب' => 'b',
                't' or 'ت' or 'ط' or 'ث' => 't',
                'j' or 'g' or 'ج' or 'غ' => 'j',
                'h' or 'ح' or 'ه' => 'h',
                'k' or 'q' or 'c' or 'خ' or 'ق' or 'ك' => 'k',
                'd' or 'د' or 'ض' => 'd',
                'z' or 'ذ' or 'ز' or 'ظ' => 'z',
                'r' or 'ر' => 'r',
                's' or 'س' or 'ص' => 's',
                'x' or 'ش' => 'x',
                'f' or 'v' or 'ف' => 'f',
                'l' or 'ل' => 'l',
                'm' or 'م' => 'm',
                'n' or 'ن' => 'n',
                _ => null, // vowels, alef, waw, ya, hamza, ain, ta marbuta
            };
            if (sound is { } s) Add(s);
        }
        return sb.ToString();
    }

    /// <summary>The choice among what the directory found, ranked as it ranked them.</summary>
    public static CustomerSearch Pick(IReadOnlyList<DirectoryUserView> found, IReadOnlyList<string> spellings, CustomerWhereabouts here, string said)
    {
        if (found.Count == 0) return new(null, [], $"No customer matches \"{said}\".");
        if (found.Count == 1) return new(found[0], found, null);

        var wanted = spellings.Select(Normalize).ToHashSet();
        var exact = found.Where(u => wanted.Contains(Normalize(u.Name))).ToList();
        if (exact.Count == 0)
        {
            static string Sounds(string name) => string.Join(' ', name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(Sound));
            var heard = spellings.Select(Sounds).ToHashSet();
            exact = [.. found.Where(u => heard.Contains(Sounds(u.Name)))];
        }
        if (exact.Count == 1) return new(exact[0], found, null);

        var pool = exact.Count > 1 ? exact : found;
        var hereNow = pool.Where(here.IsHere).ToList();
        if (hereNow.Count == 1) return new(hereNow[0], found, null);

        return new(null, pool, $"Several customers match \"{said}\". Ask which one; their phones tell them apart.");
    }

    /// <summary>"Ahmed Hassan · 0100 123 4567 · on the bill at Room 2": a candidate as the owner reads it.</summary>
    public static object Row(DirectoryUserView u, CustomerWhereabouts here, TenantSnapshot? snap = null) => new
    {
        id = u.Id,
        name = u.Name,
        phone = u.PhoneNumber,
        email = u.Email is { } e && !e.EndsWith(".local", StringComparison.OrdinalIgnoreCase) ? e : null,
        since = u.CreatedTimestamp is { } ms && snap is not null
            ? TimeZoneInfo.ConvertTimeFromUtc(DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime, snap.Zone).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
            : null,
        addedAtCounter = u.AddedAtCounter ? true : (bool?)null,
        hereNow = here.Describe(u),
    };

    /// <summary>Lower case, accents and Arabic diacritics off, Arabic letter variants as one (as Identity's search reads names).</summary>
    public static string Normalize(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return "";
        var sb = new StringBuilder(text.Length);
        var space = true;
        foreach (var ch in text.Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark) continue;
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
                if (!space) sb.Append(' ');
                space = true;
                continue;
            }
            sb.Append(c);
            space = false;
        }
        return sb.ToString().Trim();
    }
}
