using System.Globalization;
using ModelContextProtocol.Protocol;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;

namespace Ninja.Assistant.API.Tools;

/// <summary>What the read tools share beyond <see cref="ToolSupport"/>: the tenant and branches, local times, and a few names.</summary>
internal static class ReadSupport
{
    /// <summary>The tenant and the branches the owner asked about, or the sentence that says why not.</summary>
    public static async Task<(TenantSnapshot? Snapshot, IReadOnlyList<BranchResponse>? Branches, CallToolResult? Fail)> ResolveAsync(TenantContext tenant, string? branch, CancellationToken ct)
    {
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return (null, null, ToolResults.Fail(snapshot.Error!));
        var branches = BranchSelector.Select(snapshot.Value!.Branches, branch);
        if (!branches.IsOk) return (null, null, ToolResults.Fail(branches.Error!));
        return (snapshot.Value, branches.Value, null);
    }

    /// <summary>
    /// The branch a chain-wide read goes out with: the one asked about, else
    /// the first active one. The menu needs a branch to answer at all, and the
    /// staff policies check whichever is named.
    /// </summary>
    public static BranchResponse? Anchor(TenantSnapshot snapshot, IReadOnlyList<BranchResponse>? asked)
        => asked is { Count: 1 } ? asked[0] : snapshot.Branches.Where(b => b.IsActive).OrderBy(b => b.DisplayOrder).ThenBy(b => b.Id).FirstOrDefault();

    /// <summary>A service's UTC time as the business's clock shows it.</summary>
    public static string Local(TenantSnapshot snapshot, DateTime utc)
        => TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), snapshot.Zone).ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);

    public static string? Local(TenantSnapshot snapshot, DateTime? utc) => utc is { } u ? Local(snapshot, u) : null;

    /// <summary>
    /// JavaScript's getTimezoneOffset for the business right now (UTC minus
    /// local, so Cairo is -180): the sign the stays and riders endpoints take.
    /// </summary>
    public static int JsOffsetMinutes(TenantSnapshot snapshot, DateTimeOffset nowUtc)
        => -(int)snapshot.Zone.GetUtcOffset(nowUtc).TotalMinutes;

    public static string Percent(decimal fraction) => ToolResults.Money(fraction * 100) + "%";

    /// <summary>The branch's name for an id, for a transfer's other end; "branch 7" for one no longer listed.</summary>
    public static (string Name, string? NameAr) BranchName(TenantSnapshot snapshot, int id)
    {
        var b = snapshot.Branches.FirstOrDefault(x => x.Id == id);
        return b is null ? ($"Branch {id}", null) : (b.DisplayName, b.NameAr);
    }

    /// <summary>The offer's days as names ("Fri, Sat"); null for every day. One bit per DayOfWeek, Sunday the lowest.</summary>
    public static string? Weekdays(int? bits)
    {
        if (bits is not { } b || b == 0 || b == 0x7F) return null;
        return string.Join(", ", Enum.GetValues<DayOfWeek>().Where(d => (b & (1 << (int)d)) != 0).Select(d => d.ToString()[..3]));
    }

    /// <summary>Errors from several fan-outs as one list, or nothing.</summary>
    public static List<string>? Errors(params IEnumerable<string>[] lists)
    {
        var all = lists.SelectMany(l => l).ToList();
        return all.Count == 0 ? null : all;
    }
}
