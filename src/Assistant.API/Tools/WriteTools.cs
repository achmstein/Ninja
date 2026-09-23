using System.ComponentModel;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Ninja.Assistant.API.Auth;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;
using Ninja.ServiceDefaults;
using static Ninja.Assistant.API.Tools.ToolSupport;

namespace Ninja.Assistant.API.Tools;

/// <summary>
/// The few things a chat app may change, each in two steps: a preview that
/// writes nothing, then the same call with confirm=true once the person has
/// said yes. The confirm call carries an idempotency key made from the
/// request id, so a retried confirmation cannot record twice, and every
/// confirmed write lands in the audit log.
/// </summary>
[McpServerToolType]
public sealed class WriteTools(TenantContext tenant, NinjaApiClient api, AuditLog audit, IHttpContextAccessor httpContextAccessor, TimeProvider clock)
{
    private const string ConfirmDescription = "false (default) only previews what would happen and writes nothing. Show the preview to the person and call again with confirm=true and the same requestId only after they explicitly agree. Never set confirm=true without their go-ahead.";
    private const string RequestIdDescription = "Any id you choose for this request (e.g. a short random string). Reuse it on the confirm call so a retry cannot record the same thing twice.";
    private const string NextStep = "Show this preview to the person. If they agree, call again with confirm=true and this requestId.";

    [McpServerTool(Name = "record_expense", Title = "Record an expense", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Records an operating expense (rent, electricity, supplies, a repair, ...) for one branch, the way the back office's Add expense form does. " + ConfirmDescription)]
    public async Task<CallToolResult> RecordExpense(
        [Description("Amount in the cafe's currency, e.g. 350")] decimal amount,
        [Description("Expense category name as the cafe uses it (e.g. Electricity, Rent); ask get_expenses to see the categories in use")] string category,
        [Description("The business date, yyyy-MM-dd; default today")] string? date = null,
        [Description("Branch id or name; required when the cafe has more than one active branch")] string? branch = null,
        [Description("drawer (cash from the till, default) or bank")] string paidFrom = "drawer",
        [Description("Who was paid, e.g. the utility or shop")] string? vendor = null,
        [Description("A short note: period, meter, invoice number")] string? note = null,
        [Description(RequestIdDescription)] string? requestId = null,
        [Description(ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        if (amount <= 0) return ToolResults.Fail("An expense needs a positive amount.");
        var paidFromCode = paidFrom.Trim().ToLowerInvariant() switch
        {
            "drawer" or "cash" or "till" => 0,
            "bank" or "transfer" or "card" => 1,
            _ => -1,
        };
        if (paidFromCode < 0) return ToolResults.Fail("paidFrom must be drawer or bank.");

        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;
        var one = BranchSelector.SelectOne(snap.Branches, branch);
        if (!one.IsOk) return ToolResults.Fail(one.Error!);
        var target = one.Value!;

        var categories = await api.GetAsync<List<ExpenseCategoryView>>("finance-api", "/api/finance/categories", null, ct);
        if (!categories.IsOk) return ToolResults.Fail(categories.Error!);
        var match = FindCategory(categories.Value!, category);
        if (match is null)
            return ToolResults.Fail($"No expense category matches '{category}'. The categories are: {string.Join(", ", categories.Value!.Where(c => c.IsActive).Select(c => c.Name?.Display))}.");

        DateOnly day;
        if (string.IsNullOrWhiteSpace(date))
            day = PeriodResolver.BusinessToday(snap.Zone, target.DayStart, clock.GetUtcNow());
        else if (!DateOnly.TryParseExact(date.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out day))
            return ToolResults.Fail("date must be yyyy-MM-dd.");

        var preview = $"Record {snap.Currency} {ToolResults.Money(amount)} under {match.Name?.Display} for {target.DisplayName} on {Day(day)}, paid from the {(paidFromCode == 0 ? "drawer" : "bank")}"
            + (string.IsNullOrWhiteSpace(vendor) ? "" : $", vendor {vendor.Trim()}")
            + (string.IsNullOrWhiteSpace(note) ? "" : $", note \"{note.Trim()}\"") + ".";
        requestId ??= Guid.NewGuid().ToString("N");
        if (!confirm)
            return ToolResults.Ok(new { preview, requestId, nextStep = NextStep });

        var key = IdempotencyKey("record_expense", requestId);
        var body = new ExpenseRequest(day, match.Id, amount, paidFromCode, null, vendor?.Trim(), note?.Trim());
        var result = await api.SendAsync<CreatedResponse>(HttpMethod.Post, "finance-api", "/api/finance/expenses", target.Id, body, key, ct);
        audit.Write(User, "record_expense", new { amount, category = match.Name?.Display, day = Day(day), branch = target.Id, paidFrom = paidFromCode, vendor, note, requestId, key },
            result.IsOk ? $"expense {result.Value!.Id}" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);

        return ToolResults.Ok(result.Value!.Id == 0
            ? new { recorded = true, expenseId = (int?)null, preview, note = (string?)"This request had already been recorded; nothing was written twice." }
            : new { recorded = true, expenseId = (int?)result.Value.Id, preview, note = (string?)null });
    }

    [McpServerTool(Name = "set_item_availability", Title = "Mark a menu item available or sold out", ReadOnly = false, Idempotent = true, Destructive = false, OpenWorld = false)]
    [Description("Marks a menu item sold out (available=false) or back on sale (available=true) at one branch, as the till does. Customers and the till stop seeing it as orderable while it is sold out. " + ConfirmDescription)]
    public async Task<CallToolResult> SetItemAvailability(
        [Description("Menu item name (English or Arabic) or its id")] string item,
        [Description("true = on sale, false = sold out")] bool available,
        [Description("Branch id or name; required when the cafe has more than one active branch")] string? branch = null,
        [Description(RequestIdDescription)] string? requestId = null,
        [Description(ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;
        var one = BranchSelector.SelectOne(snap.Branches, branch);
        if (!one.IsOk) return ToolResults.Fail(one.Error!);
        var target = one.Value!;

        var items = await api.GetAsync<List<CatalogItemDto>>("catalog-api", "/api/catalog/items", target.Id, ct);
        if (!items.IsOk) return ToolResults.Fail(items.Error!);
        var found = FindItem(items.Value!, item);
        if (found.Error is not null) return ToolResults.Fail(found.Error);
        var menuItem = found.Item!;

        var preview = available
            ? $"Put \"{menuItem.Name?.Display}\" back on sale at {target.DisplayName}."
            : $"Mark \"{menuItem.Name?.Display}\" sold out at {target.DisplayName} (currently {(menuItem.IsAvailable && !menuItem.IsOutOfStock ? "on sale" : "not on sale")}).";
        requestId ??= Guid.NewGuid().ToString("N");
        if (!confirm)
            return ToolResults.Ok(new { preview, requestId, itemId = menuItem.Id, nextStep = NextStep });

        var result = await api.SendAsync<CatalogItemDto>(HttpMethod.Patch, "catalog-api", $"/api/catalog/items/{menuItem.Id}/availability", target.Id,
            new SetAvailabilityRequest(available), null, ct);
        audit.Write(User, "set_item_availability", new { itemId = menuItem.Id, item = menuItem.Name?.Display, available, branch = target.Id, requestId },
            result.IsOk ? $"available={result.Value!.IsAvailable}" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);

        return ToolResults.Ok(new
        {
            done = true,
            item = result.Value!.Name?.Display,
            branch = target.DisplayName,
            isAvailable = result.Value.IsAvailable,
            isOutOfStock = result.Value.IsOutOfStock,
        });
    }

    [McpServerTool(Name = "pause_online_ordering", Title = "Pause or resume online ordering", ReadOnly = false, Idempotent = true, Destructive = true, OpenWorld = false)]
    [Description("Pauses (paused=true) or resumes (paused=false) online and table ordering for one branch. While paused, customers cannot place orders from the app or a table QR; the till keeps working. " + ConfirmDescription)]
    public async Task<CallToolResult> PauseOnlineOrdering(
        [Description("true = stop taking online orders, false = take them again")] bool paused,
        [Description("Branch id or name; required when the cafe has more than one active branch")] string? branch = null,
        [Description(RequestIdDescription)] string? requestId = null,
        [Description(ConfirmDescription)] bool confirm = false,
        CancellationToken ct = default)
    {
        var snapshot = await tenant.LoadAsync(ct);
        if (!snapshot.IsOk) return ToolResults.Fail(snapshot.Error!);
        var snap = snapshot.Value!;
        var one = BranchSelector.SelectOne(snap.Branches, branch);
        if (!one.IsOk) return ToolResults.Fail(one.Error!);
        var target = one.Value!;

        var preview = paused
            ? $"Pause online ordering at {target.DisplayName}: customers will not be able to order from the app or a table until it is resumed. It is {(target.IsOrderingEnabled ? "on" : "already paused")} now."
            : $"Resume online ordering at {target.DisplayName}. It is {(target.IsOrderingEnabled ? "already on" : "paused")} now.";
        requestId ??= Guid.NewGuid().ToString("N");
        if (!confirm)
            return ToolResults.Ok(new { preview, requestId, nextStep = NextStep });

        var result = await api.SendAsync<BranchResponse>(HttpMethod.Patch, "branch-api", $"/api/branches/{target.Id}/settings", target.Id,
            new UpdateBranchSettingsRequest(!paused, null, null), null, ct);
        audit.Write(User, "pause_online_ordering", new { paused, branch = target.Id, requestId },
            result.IsOk ? $"ordering={(result.Value!.IsOrderingEnabled ? "on" : "paused")}" : result.Error!);
        if (!result.IsOk) return ToolResults.Fail(result.Error!);

        return ToolResults.Ok(new
        {
            done = true,
            branch = result.Value!.DisplayName,
            onlineOrdering = result.Value.IsOrderingEnabled ? "on" : "paused",
        });
    }

    private System.Security.Claims.ClaimsPrincipal User
        => httpContextAccessor.HttpContext?.User ?? new System.Security.Claims.ClaimsPrincipal();

    /// <summary>A stable GUID from (user, tool, request id): the confirm call twice hits the services' x-requestid guard.</summary>
    internal static Guid IdempotencyKey(string userId, string tool, string requestId)
        => new(SHA256.HashData(Encoding.UTF8.GetBytes($"{userId}|{tool}|{requestId}")).AsSpan(0, 16));

    private Guid IdempotencyKey(string tool, string requestId)
        => IdempotencyKey(User.GetUserId() ?? "", tool, requestId);

    internal static ExpenseCategoryView? FindCategory(IReadOnlyList<ExpenseCategoryView> categories, string text)
    {
        text = text.Trim();
        if (int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id))
            return categories.FirstOrDefault(c => c.Id == id);
        return categories.FirstOrDefault(c => Same(c.Name, text, exact: true))
            ?? categories.FirstOrDefault(c => c.IsActive && Same(c.Name, text, exact: false))
            ?? categories.FirstOrDefault(c => Same(c.Name, text, exact: false));
    }

    internal static (CatalogItemDto? Item, string? Error) FindItem(IReadOnlyList<CatalogItemDto> items, string text)
    {
        text = text.Trim();
        if (int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id))
        {
            var byId = items.FirstOrDefault(i => i.Id == id);
            return byId is null ? (null, $"No menu item has id {id}.") : (byId, null);
        }
        var exact = items.Where(i => Same(i.Name, text, exact: true)).ToList();
        if (exact.Count == 1) return (exact[0], null);
        var loose = items.Where(i => Same(i.Name, text, exact: false)).ToList();
        return loose.Count switch
        {
            1 => (loose[0], null),
            0 => (null, $"No menu item matches '{text}'."),
            _ => (null, $"Several menu items match '{text}': {string.Join(", ", loose.Take(8).Select(i => $"{i.Name?.Display} (id {i.Id})"))}. Say which."),
        };
    }

    private static bool Same(LocalizedText? name, string text, bool exact)
    {
        static bool Hit(string? n, string t, bool exact)
            => !string.IsNullOrEmpty(n) && (exact ? n.Equals(t, StringComparison.OrdinalIgnoreCase) : n.Contains(t, StringComparison.OrdinalIgnoreCase));
        return Hit(name?.En, text, exact) || Hit(name?.Ar, text, exact);
    }
}
