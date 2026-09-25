using System.Net;
using Ninja.Assistant.API.Downstream;
using Ninja.Assistant.UnitTests.Support;

namespace Ninja.Assistant.UnitTests.Downstream;

[TestClass]
public sealed class NinjaApiClientTests
{
    [TestMethod]
    public async Task Sends_the_bearer_the_branch_header_and_the_api_version()
    {
        var bench = new Bench();
        bench.Handler.OnJson("GET", "sales-api/api/tickets/reports/range", _ => new { net = 10, ticketsSettled = 2 });

        var r = await bench.Api.GetAsync<RangeReport>("sales-api", "/api/tickets/reports/range?from=a&to=b", 7, CancellationToken.None);

        Assert.IsTrue(r.IsOk, r.Error);
        Assert.AreEqual(10m, r.Value!.Net);
        var seen = bench.Handler.Requests.Single();
        Assert.AreEqual("http://sales-api/api/tickets/reports/range?from=a&to=b&api-version=1.0", seen.Url.ToString());
        Assert.AreEqual("7", seen.Branch);
        Assert.AreEqual(Bench.InboundToken, seen.Bearer);
    }

    [TestMethod]
    public async Task Branch_api_gets_no_api_version_and_no_branch_header_when_none_is_given()
    {
        var bench = new Bench();
        bench.Handler.OnJson("GET", "tenant-api/api/tenant", _ => new { locale = new { currency = "EGP" } });

        var r = await bench.Api.GetAsync<TenantResponse>("tenant-api", "/api/tenant", null, CancellationToken.None);

        Assert.IsTrue(r.IsOk, r.Error);
        var seen = bench.Handler.Requests.Single();
        Assert.AreEqual("http://tenant-api/api/tenant", seen.Url.ToString());
        Assert.IsNull(seen.Branch);
    }

    [TestMethod]
    public async Task Numbers_sent_as_strings_still_read()
    {
        var bench = new Bench();
        bench.Handler.OnJson("GET", "finance-api/api/finance/profit", _ => new { year = "2026", month = 9, netSales = "1234.5", profit = 10 });

        var r = await bench.Api.GetAsync<ProfitView>("finance-api", "/api/finance/profit?year=2026&month=9", 1, CancellationToken.None);

        Assert.IsTrue(r.IsOk, r.Error);
        Assert.AreEqual(1234.5m, r.Value!.NetSales);
        Assert.AreEqual(2026, r.Value.Year);
    }

    [TestMethod]
    public async Task Every_failure_becomes_a_sentence()
    {
        var bench = new Bench();
        bench.Handler.On("GET", "finance-api/api/finance/expenses", _ => FakeHandler.Text("\"The window must end after it starts.\"", HttpStatusCode.BadRequest));
        bench.Handler.On("GET", "catalog-api/api/catalog/items", _ => FakeHandler.Text("{\"title\":\"Bad Request\",\"detail\":\"X-Branch-Id required\"}", HttpStatusCode.BadRequest));
        bench.Handler.On("GET", "payroll-api/api/payroll/employees", _ => new HttpResponseMessage(HttpStatusCode.Forbidden));
        bench.Handler.On("GET", "inventory-api/api/inventory/levels", _ => new HttpResponseMessage(HttpStatusCode.PaymentRequired));
        bench.Handler.On("GET", "sales-api/api/shifts/current", _ => new HttpResponseMessage(HttpStatusCode.NotFound));
        bench.Handler.On("GET", "ordering-api/api/orders/stats", _ => new HttpResponseMessage(HttpStatusCode.BadGateway));

        var expenses = await bench.Api.GetAsync<ExpensesView>("finance-api", "/api/finance/expenses", 1, CancellationToken.None);
        StringAssert.Contains(expenses.Error, "Finance refused the request: The window must end after it starts.");

        var items = await bench.Api.GetAsync<List<CatalogItemDto>>("catalog-api", "/api/catalog/items", null, CancellationToken.None);
        StringAssert.Contains(items.Error, "X-Branch-Id required");

        var staff = await bench.Api.GetAsync<List<EmployeeView>>("payroll-api", "/api/payroll/employees", 2, CancellationToken.None);
        StringAssert.Contains(staff.Error, "may not read Payroll data for branch 2");
        Assert.AreEqual(HttpStatusCode.Forbidden, staff.Status);

        var levels = await bench.Api.GetAsync<List<StockLevelView>>("inventory-api", "/api/inventory/levels", 1, CancellationToken.None);
        StringAssert.Contains(levels.Error, "not included in this cafe's plan");

        var shift = await bench.Api.GetAsync<ShiftView>("sales-api", "/api/shifts/current", 1, CancellationToken.None);
        Assert.AreEqual(HttpStatusCode.NotFound, shift.Status);

        var stats = await bench.Api.GetAsync<OrderStats>("ordering-api", "/api/orders/stats", 1, CancellationToken.None);
        StringAssert.Contains(stats.Error, "HTTP 502");
    }

    [TestMethod]
    public async Task An_unreachable_service_reads_as_not_in_the_plan()
    {
        var bench = new Bench();
        bench.Handler.On("GET", "loyalty-api/", _ => throw new HttpRequestException("No such host is known"));

        var r = await bench.Api.GetAsync<object>("loyalty-api", "/api/loyalty/x", 1, CancellationToken.None);

        Assert.IsFalse(r.IsOk);
        StringAssert.Contains(r.Error, "not reachable");
        StringAssert.Contains(r.Error, "plan");
    }

    [TestMethod]
    public async Task A_401_from_a_service_forgets_the_exchanged_token_and_tries_once_more()
    {
        var bench = new Bench(exchange: true);
        var exchanges = 0;
        bench.Handler.OnJson("POST", "keycloak/realms/chillax/protocol/openid-connect/token", _ => new { access_token = $"exchanged-{++exchanges}", expires_in = 300 });
        var calls = 0;
        bench.Handler.On("GET", "sales-api/api/shifts/current", _ => ++calls == 1 ? new HttpResponseMessage(HttpStatusCode.Unauthorized) : FakeHandler.Json(new { id = 5, branchId = 1 }));

        var r = await bench.Api.GetAsync<ShiftView>("sales-api", "/api/shifts/current", 1, CancellationToken.None);

        Assert.IsTrue(r.IsOk, r.Error);
        Assert.AreEqual(2, exchanges);
        var bearers = bench.Handler.Requests.Where(q => q.Url.Host == "sales-api").Select(q => q.Bearer).ToList();
        CollectionAssert.AreEqual(new[] { "exchanged-1", "exchanged-2" }, bearers);
    }
}
