using System.ComponentModel;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Downstream;
using static Ninja.Assistant.API.Tools.ToolSupport;

namespace Ninja.Assistant.API.Tools;

/// <summary>
/// The business's customers as a whole: the loyalty programme, the tabs
/// they run, and what was announced to them. These are the chain's, not a
/// branch's, so each is one call.
/// </summary>
[McpServerToolType]
public sealed class CustomerReadTools(TenantContext tenant, NinjaApiClient api)
{
    [McpServerTool(Name = "get_loyalty_overview", Title = "Loyalty overview", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("The loyalty programme: how many members, how many in each tier, points issued today, in the last 7 days and the last 30, and the top members by lifetime points with their tier and current balance. Use for 'how is the loyalty programme doing', 'who are our best customers', 'how many gold members'.")]
    public async Task<CallToolResult> GetLoyaltyOverview(
        [Description(TopDescription)] int top = ToolResults.DefaultTop,
        CancellationToken ct = default)
    {
        var (_, _, fail) = await ReadSupport.ResolveAsync(tenant, null, ct);
        if (fail is not null) return fail;
        top = ToolResults.ClampTop(top);

        var stats = await api.GetAsync<LoyaltyStatsView>("loyalty-api", "/api/loyalty/stats", null, ct);
        if (!stats.IsOk) return ToolResults.Fail(stats.Error!);
        var accounts = await api.GetAsync<List<LoyaltyAccountView>>("loyalty-api", $"/api/loyalty/accounts?max={top}", null, ct);

        var s = stats.Value!;
        return ToolResults.Ok(new
        {
            members = s.TotalAccounts,
            byTier = s.AccountsByTier,
            pointsIssued = new { today = s.PointsIssuedToday, last7Days = s.PointsIssuedThisWeek, last30Days = s.PointsIssuedThisMonth },
            topMembers = accounts.IsOk
                ? accounts.Value!.OrderByDescending(a => a.LifetimePoints).Take(top).Select(a => new
                {
                    name = a.UserDisplayName ?? "(no name)",
                    tier = a.CurrentTier,
                    lifetimePoints = a.LifetimePoints,
                    balance = a.PointsBalance,
                })
                : null,
            errors = accounts.IsOk ? null : new[] { accounts.Error! },
        });
    }

    [McpServerTool(Name = "get_customer_tabs", Title = "Customer tabs", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("Customers' tabs (bills put on account): the total customers owe, how many owe, any credit held for customers, and the biggest balances first with when each last changed. Search by name to find one customer. Use for 'who owes us money', 'how much is on tabs', 'what does Karim owe'.")]
    public async Task<CallToolResult> GetCustomerTabs(
        [Description("Part of a customer's name, to find one")] string? search = null,
        [Description(TopDescription)] int top = 20,
        CancellationToken ct = default)
    {
        var (snap, _, fail) = await ReadSupport.ResolveAsync(tenant, null, ct);
        if (fail is not null) return fail;
        top = ToolResults.ClampTop(top);

        var path = string.IsNullOrWhiteSpace(search) ? "/api/accounts" : $"/api/accounts/search?q={Uri.EscapeDataString(search.Trim())}";
        var tabs = await api.GetAsync<List<TabAccountView>>("accounts-api", path, null, ct);
        if (!tabs.IsOk) return ToolResults.Fail(tabs.Error!);

        // A positive balance is owed to the business; a negative one is credit the customer has with it
        var all = tabs.Value!;
        var owing = all.Where(a => a.Balance > 0).ToList();
        return ToolResults.Ok(new
        {
            currency = snap!.Currency,
            totalOwed = owing.Sum(a => a.Balance),
            customersOwing = owing.Count,
            creditHeld = all.Where(a => a.Balance < 0).Sum(a => -a.Balance),
            tabs = all.Where(a => a.Balance != 0 || !string.IsNullOrWhiteSpace(search)).OrderByDescending(a => a.Balance).Take(top).Select(a => new
            {
                customer = a.CustomerName ?? "(no name)",
                owes = a.Balance,
                lastChange = ReadSupport.Local(snap, a.UpdatedAt),
            }),
            more = owing.Count > top ? owing.Count - top : (int?)null,
        });
    }

    [McpServerTool(Name = "get_announcements", Title = "Announcements", ReadOnly = true, Idempotent = true, OpenWorld = false)]
    [Description("The push announcements sent to customers' phones, newest first: title, message, who sent it, when, and how many devices it reached. Use for 'what did we announce last', 'how many people got the offer message'.")]
    public async Task<CallToolResult> GetAnnouncements(
        [Description(TopDescription)] int top = ToolResults.DefaultTop,
        CancellationToken ct = default)
    {
        var (snap, _, fail) = await ReadSupport.ResolveAsync(tenant, null, ct);
        if (fail is not null) return fail;
        top = ToolResults.ClampTop(top);

        var sent = await api.GetAsync<List<AnnouncementView>>("notification-api", $"/api/notifications/announcements?limit={top}", null, ct);
        if (!sent.IsOk) return ToolResults.Fail(sent.Error!);

        return ToolResults.Ok(new
        {
            announcements = sent.Value!.OrderByDescending(a => a.SentAt).Select(a => new
            {
                a.Title,
                a.Body,
                a.SentBy,
                sentAt = ReadSupport.Local(snap!, a.SentAt),
                reached = a.RecipientCount,
            }),
        });
    }
}
