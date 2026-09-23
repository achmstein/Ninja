using System.ComponentModel;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;
using static Ninja.Assistant.API.Tools.ToolSupport;

namespace Ninja.Assistant.API.Tools;

[McpServerToolType]
public sealed class InventoryTools(TenantContext tenant, NinjaApiClient api, TimeProvider clock)
{
    [McpServerTool(Name = "get_stock_levels", Title = "Stock levels", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("Stock on hand per item with its reorder level, average unit cost and value, per branch. lowOnly=true lists only what is at or below its reorder level. Use for 'what should we reorder', 'are we low on milk', 'how much is our stock worth'.")]
    public async Task<CallToolResult> GetStockLevels(
        [Description("Only items at or below their reorder level")] bool lowOnly = false,
        [Description(BranchDescription)] string? branch = null,
        [Description(TopDescription)] int top = 20,
        CancellationToken ct = default)
    {
        var (snap, branches, fail) = await Resolve(branch, ct);
        if (fail is not null) return fail;
        top = ToolResults.ClampTop(top);

        var fan = await FanOut.PerBranchAsync(branches!,
            b => api.GetAsync<List<StockLevelView>>("inventory-api", $"/api/inventory/levels?low={(lowOnly ? "true" : "false")}", b.Id, ct));
        if (!fan.AnyOk) return ToolResults.Fail(string.Join("\n", fan.Errors));

        return ToolResults.Ok(new
        {
            currency = snap!.Currency,
            lowOnly,
            stockValue = fan.Ok.SelectMany(x => x.Value).Sum(l => l.Value),
            lowItems = fan.Ok.SelectMany(x => x.Value).Count(l => l.IsLow),
            branches = fan.Ok.Select(x => new
            {
                id = x.Branch.Id,
                name = x.Branch.DisplayName,
                items = x.Value.Count,
                low = x.Value.Count(l => l.IsLow),
                value = x.Value.Sum(l => l.Value),
                rows = x.Value
                    .OrderByDescending(l => l.IsLow).ThenByDescending(l => l.Value)
                    .Take(top)
                    .Select(l => new
                    {
                        item = l.Name?.Display,
                        itemAr = l.Name?.Ar,
                        l.Unit,
                        l.OnHand,
                        l.ReorderLevel,
                        l.IsLow,
                        l.AvgUnitCost,
                        l.Value,
                        l.LastCost,
                    }),
                more = x.Value.Count > top ? x.Value.Count - top : (int?)null,
            }),
            errors = ErrorsOrNull(fan.Errors),
        });
    }

    [McpServerTool(Name = "get_inventory_usage", Title = "Inventory usage and variance", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("What the storeroom used in a period: per ingredient what was bought, sold (through recipes), wasted and found different at a count, with the money value of each, plus the variance report (opening, received, theoretical use, waste, closing). Use for 'how much waste', 'what are we losing', 'usage of coffee beans'.")]
    public async Task<CallToolResult> GetInventoryUsage(
        [Description(PeriodDescription)] string period = "this_month",
        [Description(FromDescription)] string? from = null,
        [Description(ToDescription)] string? to = null,
        [Description(BranchDescription)] string? branch = null,
        [Description(TopDescription)] int top = ToolResults.DefaultTop,
        CancellationToken ct = default)
    {
        var (snap, branches, fail) = await Resolve(branch, ct);
        if (fail is not null) return fail;
        top = ToolResults.ClampTop(top);
        var now = clock.GetUtcNow();

        var usage = await PerBranchWithPeriodAsync(snap!, branches!, period, from, to, now,
            (b, p) => api.GetAsync<UsageReport>("inventory-api", $"/api/inventory/reports/usage?from={Utc(p.FromUtc)}&to={Utc(p.ToUtc)}", b.Id, ct));
        var variance = await PerBranchWithPeriodAsync(snap!, branches!, period, from, to, now,
            (b, p) => api.GetAsync<VarianceReport>("inventory-api", $"/api/inventory/reports/variance?from={Utc(p.FromUtc)}&to={Utc(p.ToUtc)}", b.Id, ct));
        if (!usage.AnyOk && !variance.AnyOk) return ToolResults.Fail(string.Join("\n", usage.Errors.Concat(variance.Errors)));

        return ToolResults.Ok(new
        {
            period = usage.Ok.Count > 0 ? usage.Ok[0].Value.Period.Label : variance.Ok[0].Value.Period.Label,
            currency = snap!.Currency,
            usage = new
            {
                purchasedValue = usage.Ok.Sum(x => x.Value.Value.PurchasedValue),
                soldValue = usage.Ok.Sum(x => x.Value.Value.SoldValue),
                wastedValue = usage.Ok.Sum(x => x.Value.Value.WastedValue),
                countVarianceValue = usage.Ok.Sum(x => x.Value.Value.CountVarianceValue),
                stockValue = usage.Ok.Sum(x => x.Value.Value.StockValue),
                mostUsed = usage.Ok.SelectMany(x => (x.Value.Value.Rows ?? []).Select(r => new { branch = x.Branch.DisplayName, item = r.Name?.Display, r.Unit, r.Sold, r.SoldValue, r.Purchased, r.PurchasedValue }))
                    .OrderByDescending(r => r.SoldValue).Take(top),
                mostWasted = usage.Ok.SelectMany(x => (x.Value.Value.Rows ?? []).Where(r => r.Wasted != 0).Select(r => new { branch = x.Branch.DisplayName, item = r.Name?.Display, r.Unit, r.Wasted, r.WastedValue }))
                    .OrderByDescending(r => Math.Abs(r.WastedValue)).Take(top),
                countDifferences = usage.Ok.SelectMany(x => (x.Value.Value.Rows ?? []).Where(r => r.CountVariance != 0).Select(r => new { branch = x.Branch.DisplayName, item = r.Name?.Display, r.Unit, r.CountVariance, r.CountVarianceValue }))
                    .OrderByDescending(r => Math.Abs(r.CountVarianceValue)).Take(top),
            },
            variance = new
            {
                openingValue = variance.Ok.Sum(x => x.Value.Value.OpeningValue),
                receivedValue = variance.Ok.Sum(x => x.Value.Value.ReceivedValue),
                theoreticalValue = variance.Ok.Sum(x => x.Value.Value.TheoreticalValue),
                wastedValue = variance.Ok.Sum(x => x.Value.Value.WastedValue),
                closingValue = variance.Ok.Sum(x => x.Value.Value.ClosingValue),
                biggestVariance = variance.Ok.SelectMany(x => (x.Value.Value.Rows ?? []).Where(r => r.VariancePercent is not null).Select(r => new { branch = x.Branch.DisplayName, item = r.Name?.Display, r.Unit, r.Opening, r.Received, r.Theoretical, r.Closing, r.VariancePercent }))
                    .OrderByDescending(r => Math.Abs(r.VariancePercent ?? 0)).Take(top),
            },
            errors = ErrorsOrNull(usage.Errors.Concat(variance.Errors).ToList()),
        });
    }

    private async Task<(TenantSnapshot? Snapshot, IReadOnlyList<BranchResponse>? Branches, CallToolResult? Fail)> Resolve(string? branch, CancellationToken ct)
    {
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return (null, null, ToolResults.Fail(snapshot.Error!));
        var branches = BranchSelector.Select(snapshot.Value!.Branches, branch);
        if (!branches.IsOk) return (null, null, ToolResults.Fail(branches.Error!));
        return (snapshot.Value, branches.Value, null);
    }
}
