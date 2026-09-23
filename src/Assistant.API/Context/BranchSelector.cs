using System.Globalization;
using Ninja.Assistant.API.Downstream;

namespace Ninja.Assistant.API.Context;

/// <summary>
/// The `branch` argument a chat app passes: nothing or "all" means every
/// active branch, a number is an id, anything else is a name in either
/// language. A miss answers with the names on offer.
/// </summary>
public static class BranchSelector
{
    public static ApiResult<IReadOnlyList<BranchResponse>> Select(IReadOnlyList<BranchResponse> all, string? branch)
    {
        var text = branch?.Trim();
        if (string.IsNullOrEmpty(text) || text.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            var active = all.Where(b => b.IsActive).OrderBy(b => b.DisplayOrder).ThenBy(b => b.Id).ToList();
            return active.Count > 0
                ? ApiResult<IReadOnlyList<BranchResponse>>.Ok(active)
                : ApiResult<IReadOnlyList<BranchResponse>>.Fail("This cafe has no active branch.", null);
        }

        var one = Find(all, text);
        return one is null
            ? ApiResult<IReadOnlyList<BranchResponse>>.Fail(NotFound(all, text), null)
            : ApiResult<IReadOnlyList<BranchResponse>>.Ok([one]);
    }

    /// <summary>For a write: exactly one branch. When the cafe has one active branch it needs no naming.</summary>
    public static ApiResult<BranchResponse> SelectOne(IReadOnlyList<BranchResponse> all, string? branch)
    {
        var text = branch?.Trim();
        if (string.IsNullOrEmpty(text) || text.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            var active = all.Where(b => b.IsActive).ToList();
            return active.Count switch
            {
                1 => ApiResult<BranchResponse>.Ok(active[0]),
                0 => ApiResult<BranchResponse>.Fail("This cafe has no active branch.", null),
                _ => ApiResult<BranchResponse>.Fail($"Say which branch: {Names(active)}.", null),
            };
        }

        var one = Find(all, text);
        return one is null
            ? ApiResult<BranchResponse>.Fail(NotFound(all, text), null)
            : ApiResult<BranchResponse>.Ok(one);
    }

    private static BranchResponse? Find(IReadOnlyList<BranchResponse> all, string text)
    {
        if (int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id))
            return all.FirstOrDefault(b => b.Id == id);

        static bool Matches(string? name, string text, Func<string, string, bool> how)
            => !string.IsNullOrEmpty(name) && how(name, text);

        foreach (var how in new Func<string, string, bool>[]
        {
            (n, t) => n.Equals(t, StringComparison.OrdinalIgnoreCase),
            (n, t) => n.StartsWith(t, StringComparison.OrdinalIgnoreCase),
            (n, t) => n.Contains(t, StringComparison.OrdinalIgnoreCase),
        })
        {
            var hits = all.Where(b => Matches(b.Name?.En, text, how) || Matches(b.Name?.Ar, text, how)).ToList();
            if (hits.Count == 1) return hits[0];
            if (hits.Count > 1) return hits.FirstOrDefault(b => b.IsActive) ?? hits[0];
        }
        return null;
    }

    private static string NotFound(IReadOnlyList<BranchResponse> all, string text)
        => all.Count == 0
            ? $"No branch matches '{text}'; this cafe has no branches yet."
            : $"No branch matches '{text}'. The branches are {Names(all)}.";

    private static string Names(IEnumerable<BranchResponse> branches)
        => string.Join(", ", branches.Select(b => $"{b.DisplayName} (id {b.Id}{(b.IsActive ? "" : ", inactive")})"));
}
