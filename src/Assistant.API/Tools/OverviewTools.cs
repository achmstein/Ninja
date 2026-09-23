using System.ComponentModel;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;
using static Ninja.Assistant.API.Tools.ToolSupport;

namespace Ninja.Assistant.API.Tools;

[McpServerToolType]
public sealed class OverviewTools(TenantContext tenant, NinjaApiClient api, TimeProvider clock)
{
    [McpServerTool(Name = "get_business_overview", Title = "Business overview", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("Start here, before any other tool. Returns the cafe's branches (id, name, whether active, when its business day starts, whether online ordering is on), the currency, the time zone and the local time, and today so far: settled tickets and net sales per branch. Use the branch ids and names it returns in the other tools.")]
    public async Task<CallToolResult> GetBusinessOverview(CancellationToken ct = default)
    {
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;
        var now = clock.GetUtcNow();

        var active = snap.Branches.Where(b => b.IsActive).OrderBy(b => b.DisplayOrder).ThenBy(b => b.Id).ToList();
        var today = await PerBranchWithPeriodAsync(snap, active, "today", null, null, now,
            (b, p) => api.GetAsync<RangeReport>("sales-api", $"/api/tickets/reports/range?from={Utc(p.FromUtc)}&to={Utc(p.ToUtc)}", b.Id, ct));

        return ToolResults.Ok(new
        {
            tenant = new
            {
                currency = snap.Currency,
                timeZone = snap.Zone.Id,
                localNow = TimeZoneInfo.ConvertTime(now, snap.Zone).ToString("yyyy-MM-dd HH:mm", System.Globalization.CultureInfo.InvariantCulture),
                weekStartsOn = snap.WeekStart.ToString(),
                language = snap.Locale.Language,
            },
            branches = snap.Branches.OrderBy(b => b.DisplayOrder).ThenBy(b => b.Id).Select(b => new
            {
                id = b.Id,
                name = b.DisplayName,
                nameAr = b.Name?.Ar,
                isActive = b.IsActive,
                businessDayStartsAt = b.DayStartTime,
                onlineOrdering = b.IsOrderingEnabled ? "on" : "paused",
            }),
            today = new
            {
                businessDay = today.Ok.Count > 0 ? Day(today.Ok[0].Value.Period.FromDate) : null,
                netSales = today.Ok.Sum(x => x.Value.Value.Net),
                ticketsSettled = today.Ok.Sum(x => x.Value.Value.TicketsSettled),
                branches = today.Ok.Select(x => new
                {
                    id = x.Branch.Id,
                    name = x.Branch.DisplayName,
                    businessDay = Day(x.Value.Period.FromDate),
                    netSales = x.Value.Value.Net,
                    ticketsSettled = x.Value.Value.TicketsSettled,
                    refunds = x.Value.Value.Refunds,
                }),
                errors = ErrorsOrNull(today.Errors),
            },
            hint = "Amounts are in " + snap.Currency + ". Ask get_sales_summary, get_profit, get_expenses, get_stock_levels or get_staff next.",
        });
    }
}
