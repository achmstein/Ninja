using ModelContextProtocol.Client;
using ModelContextProtocol.Protocol;
using Ninja.E2E.Fixtures;
using Ninja.E2E.Harness;
using Ninja.E2E.Support;

namespace Ninja.E2E.Scenarios;

/// <summary>
/// An owner's chat app talking to the MCP server through the BFF with the
/// official client, the way Claude does: list the tools, ask about today,
/// preview an expense, confirm it, and find it in Finance.
/// </summary>
public sealed class McpAssistantScenario(NinjaApp app, DaySetup day) : ScenarioBase(app, day)
{
    protected override bool OpensShift => false;

    [Fact]
    public async Task The_owner_reads_the_day_and_records_an_expense_from_chat()
    {
        Step("Sign in as the owner through the ninja-mcp client and connect");
        var owner = await App.Tokens.PasswordGrantAsync("ninja-mcp", "admin", "Admin123$", Ct, scope: "openid mcp");
        await using var client = await McpClient.CreateAsync(new HttpClientTransport(new HttpClientTransportOptions
        {
            Endpoint = new Uri(App.BffBaseAddress, "mcp"),
            AdditionalHeaders = new Dictionary<string, string> { ["Authorization"] = $"Bearer {owner.Value}" },
        }), cancellationToken: Ct);

        Step("The tools are listed");
        var tools = await client.ListToolsAsync(cancellationToken: Ct);
        var names = tools.Select(t => t.Name).ToList();
        foreach (var expected in new[] { "get_business_overview", "get_sales_summary", "get_sales_breakdown", "get_profit", "get_expenses", "get_stock_levels", "get_staff", "record_expense", "set_item_availability", "pause_online_ordering" })
            Assert.Contains(expected, names);

        Step("The overview knows the seeded branch and the tenant's currency");
        var overview = Json(await client.CallToolAsync("get_business_overview", null, null, null, Ct));
        Assert.Equal("EGP", overview.GetProperty("tenant").GetProperty("currency").GetString());
        Assert.Contains(overview.GetProperty("branches").EnumerateArray(), b => b.GetProperty("id").GetInt32() == 1);

        Step("Today's sales come back per branch");
        var sales = Json(await client.CallToolAsync("get_sales_summary", new Dictionary<string, object?> { ["period"] = "today" }, null, null, Ct));
        Assert.Contains(sales.GetProperty("branches").EnumerateArray(), b => b.GetProperty("id").GetInt32() == 1);
        Assert.True(sales.GetProperty("total").GetProperty("ticketsSettled").GetInt32() >= 0);

        Step("A write previews first and records nothing");
        var vendor = $"E2E MCP {Day.RunId}";
        var arguments = new Dictionary<string, object?>
        {
            ["amount"] = 1,
            ["category"] = "Electricity",
            ["date"] = BusinessDay.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture),
            ["branch"] = "1",
            ["vendor"] = vendor,
            ["note"] = "recorded from chat",
            ["requestId"] = $"e2e-{Day.RunId}",
        };
        var preview = Json(await client.CallToolAsync("record_expense", arguments, null, null, Ct));
        Assert.Contains("EGP 1", preview.GetProperty("preview").GetString());
        Assert.Contains("confirm=true", preview.GetProperty("nextStep").GetString());
        Assert.DoesNotContain((await Owner.ExpensesAsync(BusinessDay, BusinessDay, Ct)).Expenses, e => e.Vendor == vendor);

        Step("Confirmed, it lands in Finance once, even when confirmed twice");
        arguments["confirm"] = true;
        var done = Json(await client.CallToolAsync("record_expense", arguments, null, null, Ct));
        Assert.True(done.GetProperty("recorded").GetBoolean());
        var expenseId = done.GetProperty("expenseId").GetInt32();
        Assert.True(expenseId > 0);

        var again = Json(await client.CallToolAsync("record_expense", arguments, null, null, Ct));
        Assert.True(again.GetProperty("recorded").GetBoolean());
        Assert.Equal(JsonValueKind.Null, again.GetProperty("expenseId").ValueKind);

        var expenses = await Owner.ExpensesAsync(BusinessDay, BusinessDay, Ct);
        var recorded = expenses.Expenses.Where(e => e.Vendor == vendor).ToList();
        var one = Assert.Single(recorded);
        Assert.Equal(expenseId, one.Id);
        Assert.Equal(Day.ElectricityCategoryId, one.CategoryId);
        Assert.Equal(1m, one.Amount);
    }

    private static JsonElement Json(CallToolResult result)
    {
        var text = ((TextContentBlock)result.Content[0]).Text;
        Assert.False(result.IsError == true, text);
        return JsonDocument.Parse(text).RootElement;
    }
}
