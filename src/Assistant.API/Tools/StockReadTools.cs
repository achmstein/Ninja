using System.ComponentModel;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;
using static Ninja.Assistant.API.Tools.ToolSupport;

namespace Ninja.Assistant.API.Tools;

/// <summary>
/// The storeroom's paper trail: the ledger, what was received, what the
/// counts found, and what moved between branches. Each belongs to the branch
/// in X-Branch-Id, so every branch is read on its own.
/// </summary>
[McpServerToolType]
public sealed class StockReadTools(TenantContext tenant, NinjaApiClient api, TimeProvider clock)
{
    /// <summary>The words the owner may use for a movement, and the ledger's own name for it.</summary>
    private static readonly Dictionary<string, string> MovementTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["purchase"] = "Purchase", ["received"] = "Purchase",
        ["sale"] = "Sale", ["sold"] = "Sale",
        ["waste"] = "Waste", ["wasted"] = "Waste",
        ["count"] = "Count",
        ["adjustment"] = "Adjustment",
        ["transferout"] = "TransferOut", ["transfer_out"] = "TransferOut",
        ["transferin"] = "TransferIn", ["transfer_in"] = "TransferIn",
        ["salereversal"] = "SaleReversal",
    };

    [McpServerTool(Name = "get_stock_movements", Title = "Stock movements", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("The storeroom ledger in a period, newest first: each movement's stock item, type (purchase, sale, waste, count, adjustment, transfer in or out), quantity, cost, reason and who recorded it, optionally for one item or one type. Use for 'what was wasted today', 'who adjusted the milk', 'movements of coffee beans this week'.")]
    public async Task<CallToolResult> GetStockMovements(
        [Description("One stock item's name (English or Arabic) or id; omit for every item")] string? item = null,
        [Description("purchase, sale, waste, count, adjustment, transfer_in or transfer_out; omit for every type")] string? type = null,
        [Description(PeriodDescription)] string period = "today",
        [Description(FromDescription)] string? from = null,
        [Description(ToDescription)] string? to = null,
        [Description(BranchDescription)] string? branch = null,
        [Description(TopDescription)] int top = 20,
        CancellationToken ct = default)
    {
        string? kind = null;
        if (!string.IsNullOrWhiteSpace(type) && !MovementTypes.TryGetValue(type.Trim().Replace(" ", "_"), out kind))
            return ToolResults.Fail("type must be purchase, sale, waste, count, adjustment, transfer_in or transfer_out.");

        var (snap, branches, fail) = await ReadSupport.ResolveAsync(tenant, branch, ct);
        if (fail is not null) return fail;
        top = ToolResults.ClampTop(top);

        int? stockItemId = null;
        if (!string.IsNullOrWhiteSpace(item))
        {
            var stock = await api.GetAsync<List<StockItemDto>>("inventory-api", "/api/inventory/items", ReadSupport.Anchor(snap!, branches)?.Id, ct);
            if (!stock.IsOk) return ToolResults.Fail(stock.Error!);
            var (picked, error) = NameResolver.Pick(stock.Value!, item, s => s.Id, s => s.Name, "stock item");
            if (picked is null) return ToolResults.Fail(error!);
            stockItemId = picked.Id;
        }

        var query = (stockItemId is { } sid ? $"&stockItemId={sid}" : "") + (kind is not null ? $"&type={kind}" : "");
        var fan = await PerBranchWithPeriodAsync(snap!, branches!, period, from, to, clock.GetUtcNow(),
            (b, p) => api.GetAsync<PagedResult<MovementView>>("inventory-api",
                $"/api/inventory/movements?from={Utc(p.FromUtc)}&to={Utc(p.ToUtc)}{query}&pageIndex=0&pageSize={top}", b.Id, ct));
        if (!fan.AnyOk) return ToolResults.Fail(string.Join("\n", fan.Errors));

        var rows = fan.Ok.SelectMany(x => (x.Value.Value.Items ?? []).Select(m => (x.Branch, m))).ToList();
        var total = fan.Ok.Sum(x => x.Value.Value.TotalCount);
        return ToolResults.Ok(new
        {
            period = fan.Ok[0].Value.Period.Label,
            currency = snap!.Currency,
            movements = total,
            listedByType = rows.GroupBy(r => r.m.Type).Select(g => new { type = g.Key, count = g.Count(), value = Math.Round(g.Sum(r => r.m.Quantity * r.m.UnitCost), 2) }),
            rows = rows.OrderByDescending(r => r.m.RecordedAt).Take(top).Select(r => new
            {
                branch = r.Branch.DisplayName,
                branchAr = r.Branch.NameAr,
                at = ReadSupport.Local(snap, r.m.RecordedAt),
                item = r.m.StockItemName?.Display,
                itemAr = r.m.StockItemName?.Arabic,
                r.m.Type,
                r.m.Quantity,
                r.m.Unit,
                value = Math.Round(r.m.Quantity * r.m.UnitCost, 2),
                r.m.Reason,
                r.m.Reference,
                by = r.m.RecordedBy,
            }),
            note = total > rows.Count ? $"Only the newest {Math.Min(top, rows.Count)} of {total} are listed; raise top, narrow the period or name an item for more." : null,
            errors = ErrorsOrNull(fan.Errors),
        });
    }

    [McpServerTool(Name = "get_purchases", Title = "Stock purchases", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("Stock received from suppliers in a period: total spent, totals per supplier, and the receipts newest first with supplier, invoice number, who received it, total and its biggest lines. Use for 'what did we buy this month', 'how much did we pay the dairy', 'last delivery from the roaster'.")]
    public async Task<CallToolResult> GetPurchases(
        [Description(PeriodDescription)] string period = "this_month",
        [Description(FromDescription)] string? from = null,
        [Description(ToDescription)] string? to = null,
        [Description(BranchDescription)] string? branch = null,
        [Description(TopDescription)] int top = 10,
        CancellationToken ct = default)
    {
        var (snap, branches, fail) = await ReadSupport.ResolveAsync(tenant, branch, ct);
        if (fail is not null) return fail;
        top = ToolResults.ClampTop(top);

        // Receipts come newest first without a date filter: the newest hundred are kept to the period here
        const int Page = 100;
        var fan = await PerBranchWithPeriodAsync(snap!, branches!, period, from, to, clock.GetUtcNow(),
            (b, p) => api.GetAsync<PagedResult<PurchaseView>>("inventory-api", $"/api/inventory/purchases?pageIndex=0&pageSize={Page}", b.Id, ct));
        if (!fan.AnyOk) return ToolResults.Fail(string.Join("\n", fan.Errors));

        var rows = fan.Ok.SelectMany(x => (x.Value.Value.Items ?? [])
                .Where(r => r.ReceivedAt >= x.Value.Period.FromUtc && r.ReceivedAt < x.Value.Period.ToUtc)
                .Select(r => (x.Branch, r)))
            .ToList();
        var cut = fan.Ok.Any(x => x.Value.Value.TotalCount > Page && (x.Value.Value.Items ?? []).All(r => r.ReceivedAt >= x.Value.Period.FromUtc));

        return ToolResults.Ok(new
        {
            period = fan.Ok[0].Value.Period.Label,
            currency = snap!.Currency,
            receipts = rows.Count,
            total = rows.Sum(r => r.r.Total),
            bySupplier = rows.GroupBy(r => string.IsNullOrWhiteSpace(r.r.Supplier) ? "(no supplier)" : r.r.Supplier!)
                .Select(g => new { supplier = g.Key, receipts = g.Count(), total = g.Sum(r => r.r.Total) })
                .OrderByDescending(s => s.total),
            branches = fan.Ok.Count > 1
                ? fan.Ok.Select(x => new { id = x.Branch.Id, name = x.Branch.DisplayName, nameAr = x.Branch.NameAr, total = rows.Where(r => r.Branch.Id == x.Branch.Id).Sum(r => r.r.Total) })
                : null,
            latest = rows.OrderByDescending(r => r.r.ReceivedAt).Take(top).Select(r => new
            {
                branch = r.Branch.DisplayName,
                branchAr = r.Branch.NameAr,
                r.r.Id,
                receivedAt = ReadSupport.Local(snap, r.r.ReceivedAt),
                r.r.Supplier,
                invoice = r.r.InvoiceRef,
                r.r.ReceivedBy,
                r.r.Total,
                lines = (r.r.Lines ?? []).Count,
                biggestLines = (r.r.Lines ?? []).OrderByDescending(l => l.Total).Take(5).Select(l => new { item = l.Name?.Display, itemAr = l.Name?.Arabic, l.Quantity, l.Unit, l.UnitCost, l.Total }),
            }),
            note = cut ? "The period reaches past the newest 100 receipts of a branch; its totals cover those only. Ask a shorter period." : null,
            errors = ErrorsOrNull(fan.Errors),
        });
    }

    [McpServerTool(Name = "get_stock_counts", Title = "Stock counts", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("The latest physical stock counts: when, by whom, how many items were counted and how many were off, and the biggest differences between what the system expected and what was found. Use for 'when did we last count', 'what was missing at the count', 'how far off was the milk'.")]
    public async Task<CallToolResult> GetStockCounts(
        [Description(BranchDescription)] string? branch = null,
        [Description("How many of the latest counts to show per branch (1-50)")] int top = 3,
        CancellationToken ct = default)
    {
        var (snap, branches, fail) = await ReadSupport.ResolveAsync(tenant, branch, ct);
        if (fail is not null) return fail;
        top = ToolResults.ClampTop(top);

        var fan = await FanOut.PerBranchAsync(branches!,
            b => api.GetAsync<PagedResult<StockCountView>>("inventory-api", $"/api/inventory/counts?pageIndex=0&pageSize={top}", b.Id, ct));
        if (!fan.AnyOk) return ToolResults.Fail(string.Join("\n", fan.Errors));

        return ToolResults.Ok(new
        {
            branches = fan.Ok.Select(x => new
            {
                id = x.Branch.Id,
                name = x.Branch.DisplayName,
                nameAr = x.Branch.NameAr,
                countsEver = x.Value.TotalCount,
                counts = (x.Value.Items ?? []).OrderByDescending(c => c.CountedAt).Select(c => new
                {
                    c.Id,
                    countedAt = ReadSupport.Local(snap!, c.CountedAt),
                    c.CountedBy,
                    c.Note,
                    itemsCounted = c.LinesCounted,
                    itemsOff = c.LinesOff,
                    biggestDifferences = (c.Lines ?? []).Where(l => l.Variance != 0).OrderByDescending(l => Math.Abs(l.Variance)).Take(10)
                        .Select(l => new { item = l.Name?.Display, itemAr = l.Name?.Arabic, l.Unit, l.Expected, l.Counted, difference = l.Variance }),
                }),
            }),
            errors = ErrorsOrNull(fan.Errors),
        });
    }

    [McpServerTool(Name = "get_transfers", Title = "Stock transfers", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("Stock sent between branches, newest first: from which branch to which, when, who sent it, a note, and the items and quantities. Use for 'what did Maadi send Nasr City', 'last transfer of cups'.")]
    public async Task<CallToolResult> GetTransfers(
        [Description(BranchDescription)] string? branch = null,
        [Description(TopDescription)] int top = 10,
        CancellationToken ct = default)
    {
        var (snap, branches, fail) = await ReadSupport.ResolveAsync(tenant, branch, ct);
        if (fail is not null) return fail;
        top = ToolResults.ClampTop(top);

        var fan = await FanOut.PerBranchAsync(branches!,
            b => api.GetAsync<PagedResult<TransferView>>("inventory-api", $"/api/inventory/transfers?pageIndex=0&pageSize={top}", b.Id, ct));
        if (!fan.AnyOk) return ToolResults.Fail(string.Join("\n", fan.Errors));

        // A transfer is in both its branches' lists: each is told once
        var transfers = fan.Ok.SelectMany(x => x.Value.Items ?? []).GroupBy(t => t.Id).Select(g => g.First()).ToList();
        return ToolResults.Ok(new
        {
            transfers = transfers.OrderByDescending(t => t.SentAt).Take(top).Select(t =>
            {
                var (fromName, fromAr) = ReadSupport.BranchName(snap!, t.FromBranchId);
                var (toName, toAr) = ReadSupport.BranchName(snap!, t.ToBranchId);
                return new
                {
                    t.Id,
                    sentAt = ReadSupport.Local(snap!, t.SentAt),
                    from = fromName,
                    fromAr,
                    to = toName,
                    toAr,
                    t.SentBy,
                    t.Note,
                    items = (t.Lines ?? []).Select(l => new { item = l.Name?.Display, itemAr = l.Name?.Arabic, l.Quantity, l.Unit }),
                };
            }),
            errors = ErrorsOrNull(fan.Errors),
        });
    }
}
