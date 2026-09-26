using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

/// <summary>
/// A month of a café's life, put into a stack through its own APIs: the
/// parts link the way real data does, sales are replayed within what the
/// till allows, and a module outside the plan is left out, not failed on.
/// </summary>
[TestClass]
public sealed class DemoDataTests
{
    /// <summary>A stack as far as the filler talks to it: the café menu, four tables, ids for whatever is created.</summary>
    private sealed class FakeStack(params string[] modulesOff) : IStackProxy
    {
        private int _id = 100;
        private int _order = 5000;

        public List<(string Method, string Path, JsonNode? Body, string? RequestId)> Calls { get; } = [];

        public async Task<HttpResponseMessage> SendAsync(Tenant tenant, HttpMethod method, string pathAndQuery, HttpContent? content, StackAuth auth, CancellationToken ct, int? branchId = null)
        {
            var path = pathAndQuery.Split('?')[0];
            var body = content is null ? null : JsonNode.Parse(await content.ReadAsStringAsync(ct));
            var requestId = content?.Headers.TryGetValues("x-requestid", out var ids) == true ? ids.First() : null;
            Calls.Add((method.Method, path, body, requestId));

            if (modulesOff.Any(m => path.StartsWith($"/api/{m}", StringComparison.Ordinal)))
                return new(HttpStatusCode.PaymentRequired);

            JsonNode? answer = (method.Method, path) switch
            {
                ("GET", "/api/branches/all") => new JsonArray(new JsonObject { ["id"] = 1 }),
                ("GET", "/api/catalog/items") => Menu(),
                ("GET", "/api/places/") => new JsonArray(
                    Enumerable.Range(1, 4).Select(i => (JsonNode)new JsonObject { ["id"] = 40 + i, ["kind"] = 2, ["name"] = new JsonObject { ["en"] = $"Table {i}" } }).ToArray()),
                ("GET", "/api/finance/categories") => new JsonArray(
                    new[] { "Rent", "Electricity", "Water", "Internet", "Maintenance", "Marketing", "Other" }
                        .Select((n, i) => (JsonNode)new JsonObject { ["id"] = i + 1, ["name"] = new JsonObject { ["en"] = n } }).ToArray()),
                ("POST", "/api/orders/pos") => new JsonObject { ["orderId"] = ++_order },
                ("POST", "/api/payroll/payslips") => new JsonObject { ["ids"] = new JsonArray(1, 2, 3, 4) },
                ("GET", var p) when p.StartsWith("/api/tickets/by-order/") => new JsonObject { ["ticketId"] = int.Parse(p.Split('/').Last()) },
                ("GET", var p) when p.StartsWith("/api/tickets/") => new JsonObject { ["total"] = 120.5m },
                ("POST", _) => new JsonObject { ["id"] = ++_id },
                _ => null,
            };
            return new(HttpStatusCode.OK) { Content = new StringContent(answer?.ToJsonString() ?? "", Encoding.UTF8, "application/json") };
        }

        private static JsonArray Menu()
            => new(new[] { ("Espresso", 35m), ("Latte", 50m), ("Tea", 20m), ("Waffle", 70m) }
                .Select((m, i) => (JsonNode)new JsonObject
                {
                    ["id"] = i + 1,
                    ["name"] = new JsonObject { ["en"] = m.Item1 },
                    ["price"] = m.Item2,
                    ["isAvailable"] = true,
                    ["customizations"] = m.Item1 == "Latte"
                        ? new JsonArray(new JsonObject
                        {
                            ["id"] = 9,
                            ["isRequired"] = true,
                            ["options"] = new JsonArray(
                                new JsonObject { ["id"] = 91, ["priceAdjustment"] = 0, ["isDefault"] = false },
                                new JsonObject { ["id"] = 92, ["priceAdjustment"] = 10, ["isDefault"] = true }),
                        })
                        : new JsonArray(),
                }).ToArray());
    }

    private static Tenant Cafe() => new() { Slug = "olive", NameEn = "Olive", Kind = TenantKind.Demo, BusinessType = BusinessType.CoffeeShop, TimeZone = "Africa/Cairo" };

    [TestMethod]
    public async Task A_cafe_demo_gets_suppliers_stock_recipes_staff_costs_and_a_month_of_sales_all_linked()
    {
        var stack = new FakeStack();
        var said = await new DemoData(stack, NullLogger<DemoData>.Instance).FillAsync(Cafe(), CancellationToken.None);

        StringAssert.Contains(said, "4 suppliers");
        StringAssert.Contains(said, "13 stock items, 4 deliveries");
        StringAssert.Contains(said, "4 recipes", "only the sample menu's items get one");
        Assert.DoesNotContain("failed", said);

        // A recipe is keyed by the menu item's id and made of stock the filler created
        var stockIds = stack.Calls.Where(c => c.Path == "/api/inventory/items").Count();
        var latte = stack.Calls.Single(c => c.Method == "PUT" && c.Path == "/api/inventory/recipes/2");
        Assert.AreEqual(2, latte.Body!["lines"]!.AsArray().Count, "beans and milk");
        Assert.AreEqual(13, stockIds);

        // Each delivery names its supplier, so Finance posts the invoice to its account
        var deliveries = stack.Calls.Where(c => c.Path == "/api/inventory/purchases").ToList();
        Assert.IsTrue(deliveries.All(d => d.Body!["supplierId"]?.GetValue<int>() > 0));
        Assert.IsTrue(deliveries.All(d => d.RequestId is not null), "done once, even if retried");

        // Sales: till orders replayed at their hour, within the till's month, settled after they were placed
        var orders = stack.Calls.Where(c => c.Path == "/api/orders/pos").ToList();
        Assert.IsTrue(orders.Count > 100, $"a month of visits, not {orders.Count}");
        Assert.IsTrue(orders.All(o => o.Body!["replay"]!.GetValue<bool>() && o.RequestId is not null));
        var placed = orders.Select(o => o.Body!["placedAt"]!.GetValue<DateTimeOffset>()).ToList();
        Assert.IsTrue(placed.All(p => p > DateTimeOffset.UtcNow.AddDays(-31) && p < DateTimeOffset.UtcNow), "the till takes a replay up to 31 days old");
        Assert.IsTrue(orders.All(o => o.Body!["placeId"]?.GetValue<int>() is >= 41 and <= 44), "at the café's own tables");
        var settles = stack.Calls.Where(c => c.Path.EndsWith("/settle", StringComparison.Ordinal)).ToList();
        Assert.AreEqual(orders.Count, settles.Count, "every bill is closed");
        Assert.IsTrue(settles.All(s => s.Body!["payments"]![0]!["amount"]!.GetValue<decimal>() == 120.5m), "for what the till says the bill comes to");

        // A required option is chosen, the default one, and priced in
        var withLatte = orders.Select(o => o.Body!["items"]!.AsArray().OfType<JsonObject>().FirstOrDefault(i => i["productId"]!.GetValue<int>() == 2)).First(i => i is not null)!;
        Assert.AreEqual(92, withLatte["selectedCustomizations"]![0]!["optionId"]!.GetValue<int>());
        Assert.AreEqual(60m, withLatte["unitPrice"]!.GetValue<decimal>());

        // Staff: attendance for the month, last month's payslips paid; costs dated through the month
        Assert.AreEqual(DemoData.Days, stack.Calls.Count(c => c.Path.StartsWith("/api/payroll/attendance/")));
        Assert.AreEqual(4, stack.Calls.Count(c => c.Path.EndsWith("/pay")));
        Assert.IsTrue(stack.Calls.Count(c => c.Path == "/api/finance/expenses") >= 6);
    }

    [TestMethod]
    public async Task A_module_the_plan_leaves_out_is_skipped_and_the_rest_still_lands()
    {
        var stack = new FakeStack("inventory", "payroll", "loyalty");
        var said = await new DemoData(stack, NullLogger<DemoData>.Instance).FillAsync(Cafe(), CancellationToken.None);

        StringAssert.Contains(said, "inventory is not in the plan");
        StringAssert.Contains(said, "payroll is not in the plan");
        StringAssert.Contains(said, "4 suppliers");
        Assert.IsTrue(stack.Calls.Count(c => c.Path == "/api/orders/pos") > 100, "sales go in without stock to draw on");
    }
}
