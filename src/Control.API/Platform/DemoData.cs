using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>
/// Fills a new demo with a month of a café's life, so every screen has
/// something true to show: suppliers and what they delivered, stock and the
/// recipes that tie the menu to it, staff with their attendance and pay,
/// running costs, regulars with points, and thirty days of sales at its
/// tables. Everything goes in through the stack's own APIs, signed as the
/// owner, so it is made by the same rules as real data and links the way
/// real data does: a sale is a till order replayed at its time, which puts
/// it on a bill, takes its ingredients off the stock and counts in the
/// reports; the bill is then settled at that time too.
///
/// What the stack cannot date in the past is done today (deliveries, stock
/// movements, points), before the sales, so the month's sales have stock to
/// draw on. A module the plan leaves out answers 402 and is skipped. Each
/// part is tried on its own; the summary says what landed and what did not.
/// </summary>
public sealed class DemoData(IStackProxy stack, ILogger<DemoData> logger)
{
    /// <summary>How far back sales go: the till takes a replayed sale up to 31 days old.</summary>
    public const int Days = 29;

    private const string V = "api-version=1.0";

    private sealed class ModuleOffException(string module) : Exception($"{module} is not in the plan");

    public async Task<string> FillAsync(Tenant tenant, CancellationToken ct)
    {
        var profile = DemoProfile.For(tenant.BusinessType);
        // The same month every time for a slug, so a re-run looks the same
        var rng = new Random(tenant.Slug.Aggregate(17, (h, c) => h * 31 + c));
        var zone = TimeZoneInfo.TryFindSystemTimeZoneById(tenant.TimeZone, out var z) ? z : TimeZoneInfo.Utc;
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, zone).DateTime);
        var said = new List<string>();

        var branches = await CallAsync(tenant, HttpMethod.Get, "/api/branches/all", null, null, ct) as JsonArray;
        var branch = branches?.OfType<JsonObject>().Select(b => (int?)b["id"]!.GetValue<int>()).FirstOrDefault()
            ?? throw new InvalidOperationException("The stack has no branch to fill.");

        var menu = (await CallAsync(tenant, HttpMethod.Get, $"/api/catalog/items?{V}", null, branch, ct) as JsonArray)?
            .OfType<JsonObject>()
            .Where(i => i["isAvailable"]?.GetValue<bool>() != false)
            .GroupBy(i => i["name"]?["en"]?.GetValue<string>() ?? "")
            .ToDictionary(g => g.Key, g => g.First()) ?? [];

        // Suppliers first: the deliveries name them
        var suppliers = new Dictionary<string, int>();
        await PartAsync(said, "suppliers", async () =>
        {
            foreach (var s in profile.Suppliers)
            {
                var id = await CreateAsync(tenant, $"/api/finance/suppliers?{V}", new { id = (int?)null, name = s.Name, phone = s.Phone, notes = (string?)null }, null, ct);
                suppliers[s.Key] = id;
            }
            return $"{suppliers.Count} suppliers";
        });

        var stock = new Dictionary<string, int>();
        await PartAsync(said, "stock", async () =>
        {
            foreach (var s in profile.Stock)
            {
                var id = await CreateAsync(tenant, $"/api/inventory/items?{V}", new
                {
                    name = new { en = s.En, ar = s.Ar },
                    unit = s.Unit,
                    packSize = (decimal?)null,
                    packName = (string?)null,
                    autoSoldOut = false,
                    isActive = true,
                }, null, ct);
                stock[s.Key] = id;
                await CallAsync(tenant, HttpMethod.Put, $"/api/inventory/items/{id}/reorder-level?{V}", new { reorderLevel = s.Reorder }, branch, ct);
            }

            // One delivery per supplier, each posting its invoice to the supplier's account
            var deliveries = 0;
            foreach (var group in profile.Stock.GroupBy(s => s.Supplier))
            {
                await CallAsync(tenant, HttpMethod.Post, $"/api/inventory/purchases?{V}", new
                {
                    supplier = profile.Suppliers.FirstOrDefault(s => s.Key == group.Key)?.Name,
                    invoiceRef = $"INV-{1000 + deliveries}",
                    supplierId = suppliers.TryGetValue(group.Key, out var sid) ? sid : (int?)null,
                    lines = group.Select(s => new { stockItemId = stock[s.Key], quantity = s.Delivered, unitCost = s.UnitCost }).ToArray(),
                }, branch, ct, idempotent: true);
                deliveries++;
            }

            var recipes = 0;
            foreach (var recipe in profile.Recipes)
            {
                if (!menu.TryGetValue(recipe.MenuItem, out var item)) continue;
                var lines = recipe.Lines.Where(l => stock.ContainsKey(l.Stock)).Select(l => new
                {
                    stockItemId = stock[l.Stock],
                    quantity = l.Quantity,
                    optionIds = Array.Empty<int>(),
                    slot = 0,
                    none = false,
                }).ToArray();
                if (lines.Length == 0) continue;
                await CallAsync(tenant, HttpMethod.Put, $"/api/inventory/recipes/{item["id"]!.GetValue<int>()}?{V}", new { lines }, null, ct);
                recipes++;
            }
            return $"{stock.Count} stock items, {deliveries} deliveries, {recipes} recipes";
        });

        // Earlier deliveries on the suppliers' accounts, most of them paid
        await PartAsync(said, "supplier accounts", async () =>
        {
            if (suppliers.Count == 0) return "no suppliers";
            var entries = 0;
            foreach (var (key, id) in suppliers)
            {
                foreach (var daysAgo in new[] { 26, 12 })
                {
                    var amount = Math.Round((decimal)(rng.Next(15, 60) * 100), 0);
                    await LedgerAsync(tenant, id, 0, amount, today.AddDays(-daysAgo), "Delivery", branch, ct);
                    await LedgerAsync(tenant, id, 1, amount, today.AddDays(-daysAgo + 3), "Paid", branch, ct);
                    entries += 2;
                }
            }
            return $"{entries} supplier entries";
        });

        await PartAsync(said, "expenses", async () =>
        {
            var categories = (await CallAsync(tenant, HttpMethod.Get, $"/api/finance/categories?{V}", null, branch, ct) as JsonArray)?
                .OfType<JsonObject>()
                .ToDictionary(c => c["name"]?["en"]?.GetValue<string>() ?? "", c => c["id"]!.GetValue<int>()) ?? [];
            var count = 0;
            foreach (var e in profile.Expenses)
            {
                if (!categories.TryGetValue(e.Category, out var category) && !categories.TryGetValue("Other", out category)) continue;
                foreach (var daysAgo in e.DaysAgo)
                {
                    await CreateAsync(tenant, $"/api/finance/expenses?{V}", new
                    {
                        date = today.AddDays(-daysAgo).ToString("yyyy-MM-dd"),
                        categoryId = category,
                        amount = e.Amount,
                        paidFrom = e.PaidFrom,
                        partnerId = (int?)null,
                        vendor = e.Vendor,
                        note = (string?)null,
                    }, branch, ct);
                    count++;
                }
            }
            return $"{count} expenses";
        });

        await PartAsync(said, "staff", async () =>
        {
            var started = today.AddDays(-(Days + 20));
            var ids = new List<int>();
            foreach (var e in profile.Employees)
            {
                ids.Add(await CreateAsync(tenant, $"/api/payroll/employees?{V}", new
                {
                    name = e.Name,
                    jobTitle = e.JobTitle,
                    phone = (string?)null,
                    branchId = branch,
                    userId = (string?)null,
                    startedOn = started.ToString("yyyy-MM-dd"),
                    scheme = e.Scheme,
                    rate = e.Rate,
                    paidDaysOff = 4,
                }, null, ct));
            }
            // Present most days, a day off a week each, now and then half a day or some overtime
            for (var d = Days; d >= 1; d--)
            {
                var day = today.AddDays(-d);
                var marks = ids.Select((id, i) =>
                {
                    var off = ((int)day.DayOfWeek + i) % 7 == 0;
                    var roll = rng.Next(100);
                    return new
                    {
                        employeeId = id,
                        status = off ? 3 : roll < 4 ? 2 : roll < 10 ? 1 : 0,
                        note = (string?)null,
                        overtimeHours = !off && roll > 90 ? 2m : 0m,
                    };
                }).ToArray();
                await CallAsync(tenant, HttpMethod.Put, $"/api/payroll/attendance/{day:yyyy-MM-dd}?{V}", new { marks }, branch, ct);
            }
            // Last month's payslips, paid
            var lastMonth = new DateOnly(today.Year, today.Month, 1).AddMonths(-1);
            var payslips = await CallAsync(tenant, HttpMethod.Post, $"/api/payroll/payslips?{V}", new
            {
                employeeId = (int?)null,
                periodStart = lastMonth.ToString("yyyy-MM-dd"),
                periodEnd = lastMonth.AddMonths(1).AddDays(-1).ToString("yyyy-MM-dd"),
            }, branch, ct) as JsonObject;
            var paid = 0;
            foreach (var id in payslips?["ids"]?.AsArray().Select(n => n!.GetValue<int>()) ?? [])
            {
                await CallAsync(tenant, HttpMethod.Post, $"/api/payroll/payslips/{id}/pay?{V}", new { amount = (decimal?)null, note = "Paid in cash" }, branch, ct);
                paid++;
            }
            return $"{ids.Count} employees, {Days} days of attendance, {paid} payslips paid";
        });

        await PartAsync(said, "regulars", async () =>
        {
            var i = 0;
            foreach (var name in DemoProfile.Regulars)
            {
                await CallAsync(tenant, HttpMethod.Post, $"/api/loyalty/transactions/earn?{V}", new
                {
                    userId = $"demo-regular-{++i}",
                    points = rng.Next(4, 40) * 10,
                    type = "Purchase",
                    referenceId = (string?)null,
                    description = "Visits this month",
                    userDisplayName = name,
                }, null, ct);
            }
            return $"{i} regulars with points";
        });

        await PartAsync(said, "sales", async () => await SalesAsync(tenant, profile, menu, branch, zone, today, rng, ct));

        return string.Join("; ", said);
    }

    /// <summary>
    /// A month of visits, one at a time: a table's order (or the counter's,
    /// where there are no tables) replayed at its hour, which Sales puts on
    /// a bill and Inventory takes off the stock, then the bill settled a
    /// while later in cash, by card or by InstaPay.
    /// </summary>
    private async Task<string> SalesAsync(Tenant tenant, DemoProfile profile, Dictionary<string, JsonObject> menu, int branch, TimeZoneInfo zone, DateOnly today, Random rng, CancellationToken ct)
    {
        if (menu.Count == 0) return "no menu to sell from";
        var places = (await CallAsync(tenant, HttpMethod.Get, $"/api/places/?{V}", null, branch, ct) as JsonArray)?
            .OfType<JsonObject>()
            .Where(p => p["kind"]?.GetValue<int>() == 2)
            .ToList() ?? [];

        // Favourites come up more often
        var pool = menu.Keys.SelectMany(name => Enumerable.Repeat(name, profile.Favourites.GetValueOrDefault(name, 1))).ToList();
        var now = DateTimeOffset.UtcNow;
        int visits = 0, failed = 0;
        decimal takings = 0;

        for (var d = Days; d >= 0; d--)
        {
            var day = today.AddDays(-d);
            var busy = day.DayOfWeek is DayOfWeek.Thursday or DayOfWeek.Friday;
            var count = rng.Next(busy ? profile.Visits.Busy - 2 : profile.Visits.Quiet - 2, busy ? profile.Visits.Busy + 1 : profile.Visits.Quiet + 1);
            for (var v = 0; v < count; v++)
            {
                // Between ten in the morning and eleven at night, the café's time
                var local = day.ToDateTime(new TimeOnly(10, 0)).AddMinutes(rng.Next(0, 13 * 60));
                var placedAt = new DateTimeOffset(local, zone.GetUtcOffset(local)).ToUniversalTime();
                var settledAt = placedAt.AddMinutes(rng.Next(25, 80));
                // Today only as far as the last hour; the rest of today is still to come
                if (settledAt > now.AddMinutes(-10)) continue;
                try
                {
                    takings += await VisitAsync(tenant, menu, pool, places, branch, placedAt, settledAt, rng, ct);
                    visits++;
                }
                catch (Exception ex) when (ex is not OperationCanceledException && ex is not ModuleOffException)
                {
                    failed++;
                    logger.LogWarning(ex, "{Slug}: a demo visit on {Day} did not land", tenant.Slug, day);
                    if (failed > 10 && visits == 0) throw;
                }
            }
        }
        return $"{visits} bills over {Days + 1} days, {takings:0} taken{(failed > 0 ? $", {failed} skipped" : "")}";
    }

    private async Task<decimal> VisitAsync(Tenant tenant, Dictionary<string, JsonObject> menu, List<string> pool, List<JsonObject> places, int branch, DateTimeOffset placedAt, DateTimeOffset settledAt, Random rng, CancellationToken ct)
    {
        var items = Enumerable.Range(0, rng.Next(1, 5))
            .Select(_ => pool[rng.Next(pool.Count)])
            .GroupBy(n => n)
            .Select(g => BasketItem(menu[g.Key], g.Count()))
            .ToArray();
        var place = places.Count > 0 ? places[rng.Next(places.Count)] : null;

        var order = await CallAsync(tenant, HttpMethod.Post, $"/api/orders/pos?{V}", new
        {
            items,
            customerNote = (string?)null,
            pointsToRedeem = 0,
            placedAt,
            placeId = place?["id"]?.GetValue<int>(),
            placeKind = place is null ? null : "Table",
            placeName = place?["name"]?.DeepClone(),
            replay = true,
        }, branch, ct, idempotent: true) as JsonObject;
        var orderId = order?["orderId"]?.GetValue<int>() ?? 0;
        if (orderId == 0) throw new InvalidOperationException("The till took no order.");

        // Sales puts it on a bill off its own copy of the event, a moment later
        int? ticketId = null;
        for (var attempt = 0; attempt < 40 && ticketId is null; attempt++)
        {
            using var response = await stack.SendAsync(tenant, HttpMethod.Get, $"/api/tickets/by-order/{orderId}?{V}", null, StackAuth.Control, ct, branch);
            if (response.IsSuccessStatusCode)
                ticketId = (await response.Content.ReadFromJsonAsync<JsonObject>(ct))?["ticketId"]?.GetValue<int>();
            else
                await Task.Delay(250, ct);
        }
        if (ticketId is null) throw new InvalidOperationException($"Order {orderId} reached no bill.");

        var ticket = await CallAsync(tenant, HttpMethod.Get, $"/api/tickets/{ticketId}?{V}", null, branch, ct) as JsonObject;
        var total = ticket?["total"]?.GetValue<decimal>() ?? 0m;
        if (total <= 0) return 0;
        var roll = rng.Next(100);
        var tender = roll < 55 ? 0 : roll < 90 ? 1 : 2;
        await CallAsync(tenant, HttpMethod.Post, $"/api/tickets/{ticketId}/settle?{V}", new
        {
            payments = new[] { new { tender, amount = total } },
            settledAt,
        }, branch, ct, idempotent: true);
        return total;
    }

    /// <summary>A menu item as the till's basket carries it, with the first choice of every required option.</summary>
    private static object BasketItem(JsonObject item, int quantity)
    {
        var chosen = item["customizations"]?.AsArray().OfType<JsonObject>()
            .Where(c => c["isRequired"]?.GetValue<bool>() == true)
            .Select(c =>
            {
                var options = c["options"]!.AsArray().OfType<JsonObject>().ToList();
                var option = options.FirstOrDefault(o => o["isDefault"]?.GetValue<bool>() == true) ?? options[0];
                return new
                {
                    customizationId = c["id"]!.GetValue<int>(),
                    customizationName = c["name"]?.DeepClone(),
                    optionId = option["id"]!.GetValue<int>(),
                    optionName = option["name"]?.DeepClone(),
                    priceAdjustment = option["priceAdjustment"]?.GetValue<decimal>() ?? 0m,
                };
            })
            .ToArray() ?? [];
        var price = item["effectivePrice"]?.GetValue<decimal>() ?? item["price"]!.GetValue<decimal>();
        return new
        {
            id = "",
            productId = item["id"]!.GetValue<int>(),
            productName = item["name"]?.DeepClone(),
            unitPrice = price + chosen.Sum(c => c.priceAdjustment),
            oldUnitPrice = 0m,
            quantity,
            pictureUrl = (string?)null,
            specialInstructions = (string?)null,
            selectedCustomizations = chosen,
        };
    }

    private Task LedgerAsync(Tenant tenant, int supplier, int type, decimal amount, DateOnly date, string note, int branch, CancellationToken ct)
        => CallAsync(tenant, HttpMethod.Post, $"/api/finance/suppliers/{supplier}/ledger?{V}", new
        {
            type,
            amount,
            date = date.ToString("yyyy-MM-dd"),
            note,
        }, branch, ct);

    /// <summary>A part of the month, on its own: a module outside the plan is skipped, a failure is said and the rest go on.</summary>
    private async Task PartAsync(List<string> said, string part, Func<Task<string>> work)
    {
        try
        {
            said.Add(await work());
        }
        catch (ModuleOffException ex)
        {
            said.Add($"{part}: {ex.Message}");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Demo data: {Part} failed", part);
            said.Add($"{part} failed: {ex.Message}");
        }
    }

    private async Task<int> CreateAsync(Tenant tenant, string path, object body, int? branch, CancellationToken ct)
        => (await CallAsync(tenant, HttpMethod.Post, path, body, branch, ct, idempotent: true))?["id"]?.GetValue<int>()
           ?? throw new InvalidOperationException($"{path} answered without an id.");

    /// <summary>One call as the owner; the answer as JSON (null when empty). 402 is a module outside the plan.</summary>
    private async Task<JsonNode?> CallAsync(Tenant tenant, HttpMethod method, string path, object? body, int? branch, CancellationToken ct, bool idempotent = false)
    {
        var content = body is null ? null : JsonContent.Create(body);
        // The request id travels as a header of the body: the till's order endpoint wants one, and a retried call is then done once
        if (idempotent && content is not null) content.Headers.TryAddWithoutValidation("x-requestid", Guid.NewGuid().ToString());
        using var response = await stack.SendAsync(tenant, method, path, content, StackAuth.Control, ct, branch);
        if (response.StatusCode == HttpStatusCode.PaymentRequired)
            throw new ModuleOffException(path.Split('/', StringSplitOptions.RemoveEmptyEntries).ElementAtOrDefault(1) ?? path);
        var text = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"{method} {path.Split('?')[0]} answered {(int)response.StatusCode}: {text[..Math.Min(text.Length, 300)]}");
        return string.IsNullOrWhiteSpace(text) ? null : JsonNode.Parse(text);
    }
}
