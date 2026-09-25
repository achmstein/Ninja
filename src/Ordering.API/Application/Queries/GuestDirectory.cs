#nullable enable
namespace Ninja.Ordering.API.Application.Queries;

using System.Linq.Expressions;
using System.Security.Cryptography;
using System.Text;
using DomainOrder = Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order;

/// <summary>
/// One guest order as the guest list needs it: who left it, when, and what
/// it came to. Only orders no account has claimed are guest orders — a guest
/// who signed in took theirs with them.
/// </summary>
public record GuestOrderRow(
    int OrderId,
    string GuestId,
    string? GuestName,
    string? GuestPhone,
    DateTime OrderDate,
    bool IsCancelled,
    double Total);

/// <summary>
/// Someone who has ordered without an account, as the back office sees
/// them: one row per phone number, since the phone is what a guest leaves
/// at every checkout while the device (and so the guest id) can change.
/// </summary>
public record GuestSummary
{
    /// <summary>
    /// What names this guest to the API: the phone's digits, or an opaque
    /// token for an order with no phone. Never the guest id itself — that is
    /// the device's secret.
    /// </summary>
    public string Key { get; init; } = string.Empty;
    /// <summary>The name on their latest order.</summary>
    public string? Name { get; init; }
    /// <summary>The phone on their latest order, as they typed it.</summary>
    public string? Phone { get; init; }
    /// <summary>Orders that went ahead; a cancelled or turned-away order is not counted.</summary>
    public int OrderCount { get; init; }
    /// <summary>What those orders came to, the same total the order list shows.</summary>
    public double TotalSpent { get; init; }
    public DateTime FirstOrderAt { get; init; }
    public DateTime LastOrderAt { get; init; }
}

/// <summary>
/// Folds guest orders into guests. Kept apart from the query so the rules —
/// who is the same guest, what counts toward what they spent — can be tested
/// without a database.
/// </summary>
public static class GuestDirectory
{
    /// <summary>
    /// Still a guest's order: placed under a guest id, and not claimed — a
    /// guest who signs in takes their orders into the account, which gives
    /// them a buyer. A counter sale with a name on it was never a guest's.
    /// </summary>
    public static readonly Expression<Func<DomainOrder, bool>> IsUnclaimedGuestOrder =
        o => o.GuestId != null && o.BuyerId == null;

    /// <summary>
    /// A phone reduced to its digits, so "010 1234 5678" and "01012345678"
    /// are one guest. Arabic-Indic digits, as an Arabic keyboard types them
    /// into the search, read as their Western twins. Null when there are none.
    /// </summary>
    public static string? NormalizePhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return null;
        var digits = new string(phone
            .Where(char.IsDigit)
            .Select(c => (char)('0' + (int)char.GetNumericValue(c)))
            .ToArray());
        return digits.Length == 0 ? null : digits;
    }

    /// <summary>
    /// The phone's digits, or — for an order that somehow has none — a hash
    /// of the guest id, which names the device without handing its secret out.
    /// </summary>
    public static string KeyFor(string guestId, string? phone)
        => NormalizePhone(phone)
            ?? "d" + Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(guestId)))[..24];

    /// <summary>
    /// Every guest the orders add up to, the most recent first. Search
    /// matches any name they have ordered under, or the phone's digits.
    /// </summary>
    public static List<GuestSummary> Aggregate(IEnumerable<GuestOrderRow> rows, string? search = null)
        => rows
            .GroupBy(r => KeyFor(r.GuestId, r.GuestPhone))
            .Where(g => Matches(g, search))
            .Select(g =>
            {
                var latest = g.MaxBy(r => r.OrderDate)!;
                var counted = g.Where(r => !r.IsCancelled).ToList();
                return new GuestSummary
                {
                    Key = g.Key,
                    Name = latest.GuestName,
                    Phone = latest.GuestPhone?.Trim(),
                    OrderCount = counted.Count,
                    TotalSpent = counted.Sum(r => r.Total),
                    FirstOrderAt = g.Min(r => r.OrderDate),
                    LastOrderAt = latest.OrderDate,
                };
            })
            .OrderByDescending(g => g.LastOrderAt)
            .ToList();

    private static bool Matches(IEnumerable<GuestOrderRow> orders, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;

        var term = search.Trim();
        var digits = NormalizePhone(term);
        return orders.Any(r =>
            (r.GuestName?.Contains(term, StringComparison.OrdinalIgnoreCase) ?? false) ||
            (digits != null && (NormalizePhone(r.GuestPhone)?.Contains(digits) ?? false)));
    }
}
