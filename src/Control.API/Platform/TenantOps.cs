using System.Diagnostics;
using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>One container of a tenant's stack, as docker compose ps reports it.</summary>
public sealed record ContainerInfo(string Service, string Name, string State, string? Health, string Status, string? Image, int? ExitCode);

/// <summary>One service's answer to its /health probe through the gateway.</summary>
public sealed record ServiceHealth(string Service, bool Ok, int Ms, string Detail);

/// <summary>What the pure parts of the ops view do to docker's output; testable without docker.</summary>
public static class ComposePs
{
    /// <summary>
    /// <c>docker compose ps -a --format json</c>: one JSON array on newer
    /// compose, one object per line on older; either way, every container.
    /// </summary>
    public static IReadOnlyList<ContainerInfo> Parse(string stdout)
    {
        var text = stdout.Trim();
        if (text.Length == 0) return [];

        var items = new List<JsonElement>();
        if (text.StartsWith('['))
        {
            using var doc = JsonDocument.Parse(text);
            items.AddRange(doc.RootElement.EnumerateArray().Select(e => e.Clone()));
        }
        else
        {
            foreach (var line in text.Split('\n', StringSplitOptions.RemoveEmptyEntries))
            {
                try
                {
                    using var doc = JsonDocument.Parse(line);
                    items.Add(doc.RootElement.Clone());
                }
                catch (JsonException) { }
            }
        }

        return items.Select(e => new ContainerInfo(
                Str(e, "Service"),
                Str(e, "Name"),
                Str(e, "State"),
                e.TryGetProperty("Health", out var h) && h.ValueKind == JsonValueKind.String && h.GetString() is { Length: > 0 } health ? health : null,
                Str(e, "Status"),
                e.TryGetProperty("Image", out var i) && i.ValueKind == JsonValueKind.String ? i.GetString() : null,
                e.TryGetProperty("ExitCode", out var x) && x.ValueKind == JsonValueKind.Number ? x.GetInt32() : null))
            .OrderBy(c => c.Service, StringComparer.Ordinal)
            .ToList();
    }

    private static string Str(JsonElement e, string name)
        => e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";
}

/// <summary>Runs docker compose against one tenant's project and probes its services through the gateway.</summary>
public sealed class TenantOps(IShell shell, IStackProxy proxy)
{
    /// <summary>What has a log on this stack: the services the plan stamps, and the gateway.</summary>
    public static string[] LogSources(Tenant tenant) => [.. PlanCatalog.Services(tenant), "gateway"];

    public async Task<IReadOnlyList<ContainerInfo>> ContainersAsync(Tenant tenant, CancellationToken ct)
    {
        var result = await shell.RunAsync("docker", ["compose", "-p", TenantNaming.Project(tenant.Slug), "ps", "-a", "--format", "json"], null, ct);
        if (!result.Ok) throw new InvalidOperationException(result.Output);
        return ComposePs.Parse(result.Stdout);
    }

    /// <summary>The last lines of one service's log, or of the whole stack's when none is named.</summary>
    public async Task<string> LogsAsync(Tenant tenant, string? service, int tail, CancellationToken ct)
    {
        var args = new List<string> { "compose", "-p", TenantNaming.Project(tenant.Slug), "logs", "--no-color", "--timestamps", "--tail", tail.ToString(CultureInfo.InvariantCulture) };
        if (service is not null)
            args.Add(service == "gateway" ? TenantNaming.Gateway(tenant.Slug) : TenantNaming.Service(tenant.Slug, service));
        var result = await shell.RunAsync("docker", args, null, ct);
        if (!result.Ok) throw new InvalidOperationException(result.Output);
        return result.Output;
    }

    public async Task<IReadOnlyList<ServiceHealth>> HealthAsync(Tenant tenant, CancellationToken ct)
    {
        // The services the plan stamps: a module's service that is not there is not unhealthy, it is absent
        var probes = PlanCatalog.Services(tenant).Select(async service =>
        {
            var watch = Stopwatch.StartNew();
            try
            {
                using var response = await proxy.SendAsync(tenant, HttpMethod.Get, $"/health/{service}", null, StackAuth.Anonymous, ct);
                var body = await response.Content.ReadAsStringAsync(ct);
                return new ServiceHealth(service, response.IsSuccessStatusCode, (int)watch.ElapsedMilliseconds, body.Trim());
            }
            catch (HttpRequestException ex)
            {
                return new ServiceHealth(service, false, (int)watch.ElapsedMilliseconds, ex.Message);
            }
        });
        return await Task.WhenAll(probes);
    }
}

/// <summary>A day of a tenant's trade, as its own services count it.</summary>
public sealed record MetricsDay(DateOnly Date, int Orders, decimal Revenue);

public sealed record MetricsTopItem(string Name, int Units, decimal Revenue);

/// <param name="Days">The window that was asked for, ending today.</param>
/// <param name="Orders">Customer and till orders confirmed in the window, every branch.</param>
/// <param name="Revenue">What those orders came to.</param>
/// <param name="TicketsSettled">Bills settled at the tills in the window.</param>
/// <param name="NetSales">What customers actually paid on those bills.</param>
/// <param name="MonthProfit">Finance's profit for the current month, or null when Finance did not answer.</param>
/// <param name="LoyaltyAccounts">Customers with a points account.</param>
/// <param name="Warnings">Services that did not answer; the numbers stand without them.</param>
public sealed record TenantMetrics(
    int Days,
    int Branches,
    int Orders,
    decimal Revenue,
    int TicketsSettled,
    decimal NetSales,
    decimal? MonthProfit,
    int LoyaltyAccounts,
    IReadOnlyList<MetricsDay> Series,
    IReadOnlyList<MetricsTopItem> TopItems,
    IReadOnlyList<string> Warnings);

/// <summary>Adds the branches' figures up; pure, so it is testable from canned answers.</summary>
public static class TenantMetricsMath
{
    /// <param name="orderStats">One Ordering stats answer per branch (Days[], TopItems[]).</param>
    /// <param name="rangeReports">One Sales range report per branch (TicketsSettled, Net).</param>
    public static TenantMetrics Merge(
        int days,
        int branches,
        IEnumerable<JsonObject> orderStats,
        IEnumerable<JsonObject> rangeReports,
        JsonObject? profit,
        JsonObject? loyalty,
        IReadOnlyList<string> warnings)
    {
        var byDay = new SortedDictionary<DateOnly, (int Orders, decimal Revenue)>();
        var items = new Dictionary<string, (int Units, decimal Revenue)>(StringComparer.Ordinal);
        foreach (var stats in orderStats)
        {
            foreach (var day in stats["days"]?.AsArray() ?? [])
            {
                if (day is null || !DateOnly.TryParse(day["date"]?.GetValue<string>(), CultureInfo.InvariantCulture, out var date)) continue;
                var acc = byDay.GetValueOrDefault(date);
                byDay[date] = (acc.Orders + Int(day["orders"]), acc.Revenue + Dec(day["revenue"]));
            }
            foreach (var item in stats["topItems"]?.AsArray() ?? [])
            {
                if (item is null) continue;
                var name = item["productName"]?["en"]?.GetValue<string>() ?? item["productName"]?["ar"]?.GetValue<string>() ?? "?";
                var acc = items.GetValueOrDefault(name);
                items[name] = (acc.Units + Int(item["units"]), acc.Revenue + Dec(item["revenue"]));
            }
        }

        int tickets = 0;
        decimal net = 0;
        foreach (var report in rangeReports)
        {
            tickets += Int(report["ticketsSettled"]);
            net += Dec(report["net"]);
        }

        return new TenantMetrics(
            days,
            branches,
            byDay.Values.Sum(d => d.Orders),
            byDay.Values.Sum(d => d.Revenue),
            tickets,
            net,
            profit is null ? null : Dec(profit["profit"]),
            loyalty is null ? 0 : Int(loyalty["totalAccounts"]),
            byDay.Select(kv => new MetricsDay(kv.Key, kv.Value.Orders, kv.Value.Revenue)).ToList(),
            items.OrderByDescending(kv => kv.Value.Units).Take(5).Select(kv => new MetricsTopItem(kv.Key, kv.Value.Units, kv.Value.Revenue)).ToList(),
            warnings);
    }

    private static int Int(JsonNode? node) => node is null ? 0 : node.GetValueKind() == JsonValueKind.Number ? node.GetValue<int>() : 0;

    private static decimal Dec(JsonNode? node)
    {
        if (node is null || node.GetValueKind() != JsonValueKind.Number) return 0;
        return node.GetValue<decimal>();
    }
}

/// <summary>Reads a tenant's figures through its own APIs, as the platform's service account, one branch at a time.</summary>
public sealed class TenantMetricsCollector(IStackProxy proxy, ILogger<TenantMetricsCollector> logger)
{
    public async Task<TenantMetrics> CollectAsync(Tenant tenant, int days, CancellationToken ct)
    {
        var warnings = new List<string>();
        var to = DateTime.UtcNow;
        var from = to.Date.AddDays(-(days - 1));

        var branches = await GetAsync(tenant, "/api/branches/all", null, warnings, ct);
        var branchIds = (branches?.AsArray() ?? [])
            .Where(b => b?["isActive"]?.GetValue<bool>() ?? true)
            .Select(b => b!["id"]!.GetValue<int>())
            .ToList();

        var orderStats = new List<JsonObject>();
        var rangeReports = new List<JsonObject>();
        foreach (var branchId in branchIds)
        {
            if (await GetAsync(tenant, $"/api/orders/stats?fromDate={Iso(from)}&toDate={Iso(to)}&tzOffsetMinutes=0&api-version=1.0", branchId, warnings, ct) is JsonObject stats)
                orderStats.Add(stats);
            if (await GetAsync(tenant, $"/api/tickets/reports/range?from={Iso(from)}&to={Iso(to)}&api-version=1.0", branchId, warnings, ct) is JsonObject report)
                rangeReports.Add(report);
        }

        // Finance and Loyalty only where the plan has them: their services are not stamped otherwise, and a 402 is not a warning
        var entitled = PlanCatalog.Entitlements(tenant);
        JsonObject? profit = null;
        if (branchIds.Count > 0 && entitled.Contains(Module.Finance))
            profit = await GetAsync(tenant, $"/api/finance/profit?year={to.Year}&month={to.Month}&api-version=1.0", branchIds[0], warnings, ct) as JsonObject;
        var loyalty = entitled.Contains(Module.Loyalty)
            ? await GetAsync(tenant, "/api/loyalty/stats?api-version=1.0", branchIds.FirstOrDefault(), warnings, ct) as JsonObject
            : null;

        return TenantMetricsMath.Merge(days, branchIds.Count, orderStats, rangeReports, profit, loyalty, warnings.Distinct().ToList());
    }

    private async Task<JsonNode?> GetAsync(Tenant tenant, string path, int? branchId, List<string> warnings, CancellationToken ct)
    {
        try
        {
            using var response = await proxy.SendAsync(tenant, HttpMethod.Get, path, null, StackAuth.Control, ct, branchId);
            if (!response.IsSuccessStatusCode)
            {
                warnings.Add($"{path.Split('?')[0]} answered {(int)response.StatusCode}");
                return null;
            }
            return await response.Content.ReadFromJsonAsync<JsonNode>(ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or TaskCanceledException)
        {
            logger.LogWarning(ex, "{Slug}: {Path} did not answer", tenant.Slug, path);
            warnings.Add($"{path.Split('?')[0]} did not answer");
            return null;
        }
    }

    private static string Iso(DateTime utc) => utc.ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture);
}
