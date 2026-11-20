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
    /// <summary>Nobody was picked, and there is someone to ask about: several alike, or one that is only close.</summary>
    public bool Ambiguous => Match is null && Candidates.Count > 0;
}

/// <summary>
/// Finds the customer the owner named. Every customer account is read and
/// each name is scored against what was said by <see cref="NameMatch"/>:
/// by sound, so the script it was said in, the spelling (Mohamed, Mohammed,
/// Muhammad) and words written together or apart (ElAmeen, El Ameen,
/// الأمين) do not matter, while a different name (Mahmoud) does. Every
/// spelling given is tried ("Ahmed Hassan / أحمد حسن") and the best counts.
/// A phone's digits, an email or an id from find_customer find the account
/// directly. The whole name wins over the same words inside a longer name;
/// among several alike, the one person who is here right now (on an open
/// bill or in a room); otherwise the owner is asked, with phones to tell
/// them apart. A name that is only close (a letter wrong) is asked about,
/// never acted on. Staff and switched-off accounts are not customers here.
/// </summary>
public static class CustomerFinder
{
    public const string Identity = "identity-api";
    private const string NotCustomers = "Admin,Owner,Cashier";
    private const int Listed = 8;

    /// <summary>Names this close to the best are the same answer: one is not picked over the other.</summary>
    private const double Tie = 0.07;

    public const string SpellingDescription =
        "The customer as the owner said it: a name, a phone number, or an id from find_customer. Give the name exactly as said, in the script it was said in; it is matched by sound against accounts saved in Arabic or English, so do not translate or respell it. Give the full name when it was said: the more of it, the surer the match.";

    public static string[] Spellings(string text) =>
        [.. text.Split(['/', '|', '،'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Where(s => s.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase)];

    public static async Task<CustomerSearch> FindAsync(NinjaApiClient api, int branchId, string? text, CustomerWhereabouts here, CancellationToken ct)
    {
        text = text?.Trim();
        if (string.IsNullOrEmpty(text)) return new(null, [], "Say which customer.");

        // The till's own list, whole: a few thousand names are scored here faster than they are searched for twice
        var listed = await api.GetAsync<List<DirectoryUserView>>(Identity, $"/api/identity/users?max=20000&excludeRole={NotCustomers}&enabled=true", branchId, ct);
        if (!listed.IsOk) return new(null, [], listed.Error);
        var everyone = listed.Value ?? [];

        if (Guid.TryParse(text, out _))
        {
            return everyone.FirstOrDefault(u => u.Id.Equals(text, StringComparison.OrdinalIgnoreCase)) is { } user
                ? new(user, [user], null)
                : new(null, [], $"No customer has id {text}.");
        }

        return Pick(everyone, Spellings(text), here, text);
    }

    private static bool LooksLikePhone(string s) => s.Count(char.IsDigit) >= 3 && !s.Any(char.IsLetter);

    /// <summary>The accounts that answer what was said, the closest first.</summary>
    public static List<(DirectoryUserView User, NameMatch.Result How)> Rank(IEnumerable<DirectoryUserView> users, IReadOnlyList<string> spellings)
    {
        var phones = spellings.Where(LooksLikePhone).Select(NameMatch.PhoneCore).Where(p => p.Length >= 3).ToList();
        var emails = spellings.Where(s => s.Contains('@')).ToList();
        var names = spellings.Where(s => !LooksLikePhone(s) && !s.Contains('@')).Select(NameMatch.Words).Where(w => w.Length > 0).ToList();

        var ranked = new List<(DirectoryUserView User, NameMatch.Result How)>();
        foreach (var user in users)
        {
            NameMatch.Result? best = null;
            void Offer(NameMatch.Result? how)
            {
                if (how is { } h && (best is not { } b || h.Score > b.Score)) best = h;
            }

            if (names.Count > 0)
            {
                var saved = NameMatch.Words(user.Name);
                foreach (var said in names) Offer(NameMatch.Compare(said, saved));
            }
            if (phones.Count > 0 && NameMatch.PhoneCore(user.PhoneNumber) is { Length: > 0 } phone)
            {
                foreach (var said in phones)
                    Offer(phone == said ? new(1, 1, 1) : phone.EndsWith(said, StringComparison.Ordinal) ? new(0.97, 0.6, 0.97) : phone.Contains(said, StringComparison.Ordinal) ? new(0.95, 0.5, 0.95) : null);
            }
            if (emails.Any(e => e.Equals(user.Email, StringComparison.OrdinalIgnoreCase))) Offer(new(1, 1, 1));

            if (best is { } found) ranked.Add((user, found));
        }
        return [.. ranked.OrderByDescending(x => x.How.Score).ThenBy(x => x.User.Name, StringComparer.OrdinalIgnoreCase)];
    }

    /// <summary>The one meant among <paramref name="users"/>, or those to ask about.</summary>
    public static CustomerSearch Pick(IReadOnlyList<DirectoryUserView> users, IReadOnlyList<string> spellings, CustomerWhereabouts here, string said)
    {
        var ranked = Rank(users, spellings);
        if (ranked.Count == 0) return new(null, [], $"No customer matches \"{said}\".");

        var top = ranked[0].How.Score;
        // What the owner is shown: the best, and those not far behind it
        List<DirectoryUserView> shown = [.. ranked.Where(x => x.How.Score >= top - 0.25).Take(Listed).Select(x => x.User)];

        // The whole name, as saved: it is that account, whoever else shares part of the name
        var whole = ranked.Where(x => x.How.WholeName).ToList();
        if (whole.Count == 1) return new(whole[0].User, shown, null);

        var alike = whole.Count > 1 ? whole : [.. ranked.Where(x => x.How.Score >= top - Tie)];
        if (alike.Count == 1)
        {
            return alike[0].How.Sure
                ? new(alike[0].User, shown, null)
                : new(null, shown, $"No customer is called exactly \"{said}\". The closest is listed: ask if that is who is meant, and never assume it.");
        }

        var hereNow = alike.Where(x => x.How.Sure && here.IsHere(x.User)).ToList();
        if (hereNow.Count == 1) return new(hereNow[0].User, shown, null);

        List<DirectoryUserView> ask = [.. alike.Take(Listed).Select(x => x.User)];
        return new(null, ask, $"Several customers match \"{said}\". Ask which one; their phones tell them apart.");
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
