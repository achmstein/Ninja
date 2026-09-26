using System.ComponentModel;
using ModelContextProtocol.Server;

namespace Ninja.Assistant.API.Tools;

/// <summary>
/// Routines the owner starts with one click: MCP prompts, which a chat app
/// lists (Claude shows them in its "+" menu and as slash commands). Each is
/// a short brief for the model: which tools to call, in what order, and how
/// to report. They read only; anything they suggest changing still goes
/// through a write tool's preview and the owner's yes.
/// </summary>
[McpServerPromptType]
public static class Routines
{
    [McpServerPrompt(Name = "morning_briefing", Title = "Morning briefing")]
    [Description("Yesterday at a glance: sales against the same day last week, what sold, what is running low, and anything left open.")]
    public static string MorningBriefing(
        [Description("A branch id, or leave empty for every branch")] string? branch = null)
        => $"""
            Give me my morning briefing{For(branch)}.
            1. get_business_overview.
            2. get_sales_summary for yesterday, and for the same weekday one week earlier; compare net sales and the number of bills.
            3. get_sales_breakdown for yesterday: the three best-selling items and anything that sold far less than usual.
            4. get_stock_levels: everything under its reorder level.
            5. get_shifts for yesterday: any drawer that did not balance.
            Report in five short lines at most: yesterday's takings with the change against last week, the best sellers, what to reorder, anything odd. End with the one thing I should do first today.
            """;

    [McpServerPrompt(Name = "close_the_day", Title = "Close the day")]
    [Description("Today's takings by payment method, the drawer against what it should hold, refunds and discounts, and anything unusual.")]
    public static string CloseTheDay(
        [Description("A branch id, or leave empty for every branch")] string? branch = null)
        => $"""
            Close the day with me{For(branch)}.
            1. get_business_overview.
            2. get_sales_summary for today: net sales, bills, and the split by payment method (cash, card, InstaPay, online, on account).
            3. get_shifts for today: each drawer's expected cash against what was counted.
            4. get_refunds for today, and the discounts in the sales summary.
            Report the takings, whether every drawer balanced (and by how much it did not), and any refund or discount that stands out, with who gave it. Keep it short.
            """;

    [McpServerPrompt(Name = "weekly_review", Title = "Weekly review")]
    [Description("The last seven days: sales and profit trend, the biggest costs, staff cost, and what to change.")]
    public static string WeeklyReview(
        [Description("A branch id, or leave empty for every branch")] string? branch = null)
        => $"""
            Review my last seven days{For(branch)}.
            1. get_business_overview.
            2. get_daily_sales_trend for the last 14 days: this week against the one before.
            3. get_profit for this month so far, and get_profit_trend.
            4. get_expenses for the last 7 days: the three biggest.
            5. get_staff and get_attendance for the last 7 days: absences and overtime.
            6. get_sales_breakdown for the last 7 days: the busiest hours and weekdays, the best and worst items.
            Give me a short review: how the week went in two sentences with the numbers, then three concrete suggestions (a price, a slow item, a shift pattern, a cost to cut), each with its reason.
            """;

    [McpServerPrompt(Name = "restock_check", Title = "Restock check")]
    [Description("What is under its reorder level, how fast it is going, and what to order from which supplier.")]
    public static string RestockCheck(
        [Description("A branch id, or leave empty for every branch")] string? branch = null)
        => $"""
            Check my stock{For(branch)}.
            1. get_business_overview.
            2. get_stock_levels: every item under or near its reorder level.
            3. get_inventory_usage for the last 7 days: how fast each of those is used.
            4. get_supplier_balances: who they come from and what I owe them.
            Give me an order list grouped by supplier: the item, what is left, how many days that lasts at the current rate, and a quantity to order for about two weeks. Mention any supplier I owe a lot to before ordering more.
            """;

    private static string For(string? branch)
        => string.IsNullOrWhiteSpace(branch) ? " for every branch" : $" for branch {branch.Trim()}";
}
