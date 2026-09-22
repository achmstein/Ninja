using System.Net;
using System.Net.Http.Json;
using Ninja.Testing;

namespace Ninja.Ordering.FunctionalTests;

/// <summary>The service, once for the suite.</summary>
[TestClass]
public static class Suite
{
    public const int Branch = 1;

    public static ServiceUnderTest<Program> Ordering { get; private set; } = null!;

    [AssemblyInitialize]
    public static async Task StartAsync(TestContext context)
    {
        await SharedServices.StartAsync();
        Ordering = new ServiceUnderTest<Program>("orderingdb");
        _ = Ordering.CreateClient();
    }

    [AssemblyCleanup]
    public static async Task StopAsync()
    {
        await Ordering.DisposeAsync();
        await SharedServices.StopAsync();
    }
}

/// <summary>What the apps read off the wire; named here so a change in the API's shape fails a test.</summary>
public record OrderView(int OrderNumber, DateTime Date, string Status, int? PlaceId, string? PlaceKind, LocalizedView? PlaceName, decimal Total, string Source, List<OrderItemView> OrderItems);
public record OrderItemView(LocalizedView ProductName, int Units, double UnitPrice);
public record OrderSummaryView(int OrderNumber, string Status, double Total);
/// <summary>A page of a customer's own orders, as their app reads it.</summary>
public record PageView<T>(IEnumerable<T> Items, int PageIndex, int PageSize, int TotalCount);
public record KitchenOrderView(int OrderNumber, string Status, string Source, int? PlaceId);
public record PosOrderView(int OrderId);
public record LocalizedView(string En, string? Ar);

/// <summary>
/// An order's life: placed from a table by the customer's own app, seen at
/// the counter, taken by the kitchen, and either served or called off.
/// </summary>
[TestClass]
public sealed class OrderScenarios
{
    private const string Orders = "/api/orders";
    private const string Version = "api-version=1.0";

    private static Caller Customer(string userId) => Suite.Ordering.As(Persona.Customer(userId), Suite.Branch);
    private static Caller Till => Suite.Ordering.As(Persona.Cashier(Suite.Branch), Suite.Branch);
    private static Caller BackOffice => Suite.Ordering.As(Persona.Admin(Suite.Branch), Suite.Branch);

    private static object Item(int productId, string name, decimal price, int quantity = 1) => new
    {
        id = productId.ToString(),
        productId,
        productName = new { en = name, ar = name },
        unitPrice = price,
        oldUnitPrice = price,
        quantity,
        pictureUrl = (string?)null,
    };

    private static object Basket(string userId, string userName, params object[] items) => new
    {
        userId,
        userName,
        customerNote = "No sugar",
        pointsToRedeem = 0,
        loyaltyDiscount = 0,
        items = items.Length == 0 ? [Item(1, "Turkish coffee", 35m)] : items,
        placeId = 3,
        placeKind = "Table",
        placeName = new { en = "Table 3", ar = "ترابيزة ٣" },
    };

    /// <summary>A retry on café Wi-Fi must not become a second order, so every command carries its own id.</summary>
    private static async Task<HttpResponseMessage> SendAsync(Caller caller, HttpMethod method, string path, object? body, Guid? requestId = null)
    {
        var request = new HttpRequestMessage(method, path)
        {
            Content = body is null ? null : System.Net.Http.Json.JsonContent.Create(body, options: Caller.Json),
        };
        request.Headers.Add("x-requestid", (requestId ?? Guid.NewGuid()).ToString());
        return await caller.Http.SendAsync(request);
    }

    private static async Task<int> PlaceOrderAsync(string userId, string name = "Mona")
    {
        using var response = await SendAsync(Customer(userId), HttpMethod.Post, $"{Orders}?{Version}", Basket(userId, name));
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode, await response.Content.ReadAsStringAsync());

        // The order is written by a command; its number is what the customer's own list gives back
        await ServiceUnderTest<Program>.EventuallyAsync(async () =>
            (await Customer(userId).GetAsync<PageView<OrderSummaryView>>($"{Orders}?{Version}")).Items.Any(), "the order reaches the customer's list");
        var mine = await Customer(userId).GetAsync<PageView<OrderSummaryView>>($"{Orders}?{Version}");
        return mine.Items.OrderByDescending(o => o.OrderNumber).First().OrderNumber;
    }

    [TestMethod]
    public async Task A_customer_orders_from_a_table_and_sees_it_in_their_own_list()
    {
        var userId = $"customer-{Guid.NewGuid():N}";

        var orderNumber = await PlaceOrderAsync(userId);

        var order = await Customer(userId).GetAsync<OrderView>($"{Orders}/{orderNumber}?{Version}");
        Assert.AreEqual(orderNumber, order.OrderNumber);
        Assert.AreEqual(3, order.PlaceId, "the order knows the table it came from");
        Assert.AreEqual("Table", order.PlaceKind);
        Assert.AreEqual("Table 3", order.PlaceName!.En);
        Assert.AreEqual(35m, order.Total);
        var line = order.OrderItems.Single();
        Assert.AreEqual("Turkish coffee", line.ProductName.En);
        Assert.AreEqual(1, line.Units);
        Assert.AreEqual(35d, line.UnitPrice);

        var atThePlace = await Customer(userId).GetAsync<List<OrderSummaryView>>($"{Orders}/place/3/open?{Version}");
        Assert.IsTrue(atThePlace.Any(o => o.OrderNumber == orderNumber), "the table's open orders are what the till and the app both read");
    }

    [TestMethod]
    public async Task The_same_order_sent_twice_is_one_order()
    {
        var userId = $"customer-{Guid.NewGuid():N}";
        var requestId = Guid.NewGuid();
        var basket = Basket(userId, "Mona");

        using (var first = await SendAsync(Customer(userId), HttpMethod.Post, $"{Orders}?{Version}", basket, requestId))
        {
            Assert.AreEqual(HttpStatusCode.OK, first.StatusCode);
        }
        await ServiceUnderTest<Program>.EventuallyAsync(async () =>
            (await Customer(userId).GetAsync<PageView<OrderSummaryView>>($"{Orders}?{Version}")).Items.Any(), "the first order lands");

        using (var again = await SendAsync(Customer(userId), HttpMethod.Post, $"{Orders}?{Version}", basket, requestId))
        {
            Assert.AreEqual(HttpStatusCode.OK, again.StatusCode, "a retry is answered, not refused");
        }

        var mine = await Customer(userId).GetAsync<PageView<OrderSummaryView>>($"{Orders}?{Version}");
        Assert.AreEqual(1, mine.Items.Count(), "the same request id is the same order");
    }

    [TestMethod]
    public async Task An_order_from_the_app_waits_for_the_menu_to_say_the_items_are_there()
    {
        var userId = $"customer-{Guid.NewGuid():N}";
        var orderNumber = await PlaceOrderAsync(userId);

        var order = await Customer(userId).GetAsync<OrderView>($"{Orders}/{orderNumber}?{Version}");
        Assert.AreEqual("AwaitingValidation", order.Status, "Catalog confirms the stock before the counter is given the order");

        var pending = await Till.GetAsync<List<OrderSummaryView>>($"{Orders}/pending?{Version}");
        Assert.IsFalse(pending.Any(o => o.OrderNumber == orderNumber), "the counter's list is what passed that check");
    }

    [TestMethod]
    public async Task A_sale_rung_up_at_the_till_is_the_tills_own_order()
    {
        using var response = await SendAsync(Till, HttpMethod.Post, $"{Orders}/pos?{Version}", new
        {
            items = new[] { Item(2, "Tea", 20m, 2) },
            customerNote = "Extra hot",
            placeId = 5,
            placeKind = "Table",
            placeName = new { en = "Table 5", ar = "ترابيزة ٥" },
        });
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode, await response.Content.ReadAsStringAsync());
        var sale = (await response.Content.ReadFromJsonAsync<PosOrderView>(Caller.Json))!;

        // An order is read by the back office, the customer who placed it, or the guest at the table:
        // the till works from its own lists (pending, the kitchen, the table's open orders)
        var order = await BackOffice.GetAsync<OrderView>($"{Orders}/{sale.OrderId}?{Version}");
        Assert.AreEqual("Pos", order.Source, "a sale keyed in at the counter is not an order sent from a phone");
        Assert.AreEqual(5, order.PlaceId);
        Assert.AreEqual(40m, order.Total, "two teas at twenty");
        Assert.AreEqual(2, order.OrderItems.Single().Units);

        // Like every order it waits for the menu to confirm the stock; the kitchen's board
        // is that round trip, which tests/Ninja.E2E follows across the services
        Assert.AreEqual("AwaitingValidation", order.Status);
    }

    [TestMethod]
    public async Task A_till_sale_that_redeems_points_needs_a_customer_to_redeem_them_from()
    {
        using var response = await SendAsync(Till, HttpMethod.Post, $"{Orders}/pos?{Version}", new
        {
            items = new[] { Item(2, "Tea", 20m) },
            pointsToRedeem = 100,
        });

        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("attached customer", await response.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
    }

    [TestMethod]
    public async Task An_order_is_called_off_at_the_counter()
    {
        var userId = $"customer-{Guid.NewGuid():N}";
        var orderNumber = await PlaceOrderAsync(userId);

        using (var cancelled = await SendAsync(Till, HttpMethod.Put, $"{Orders}/cancel?{Version}", new { orderNumber }))
        {
            Assert.AreEqual(HttpStatusCode.OK, cancelled.StatusCode);
        }

        await ServiceUnderTest<Program>.EventuallyAsync(async () =>
            (await Customer(userId).GetAsync<OrderView>($"{Orders}/{orderNumber}?{Version}")).Status.Contains("ancel", StringComparison.OrdinalIgnoreCase),
            "the customer's own copy says it was called off");

        var atThePlace = await Customer(userId).GetAsync<List<OrderSummaryView>>($"{Orders}/place/3/open?{Version}");
        Assert.IsFalse(atThePlace.Any(o => o.OrderNumber == orderNumber), "a called-off order is not open at the table any more");
    }

    [TestMethod]
    public async Task A_command_without_its_own_id_is_refused()
    {
        // No x-requestid at all, and an empty one: both are a client that could send the order twice
        var (missing, _) = await Till.RefusedAsync(HttpMethod.Put, $"{Orders}/confirm?{Version}", new { orderNumber = 1 });
        Assert.AreEqual(HttpStatusCode.BadRequest, missing);

        foreach (var path in new[] { $"{Orders}/confirm?{Version}", $"{Orders}/cancel?{Version}" })
        {
            using var response = await SendAsync(Till, HttpMethod.Put, path, new { orderNumber = 1 }, Guid.Empty);
            Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode, path);
            Assert.Contains("Empty GUID", await response.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        }
    }

    [TestMethod]
    public async Task An_order_nobody_placed_is_not_there_to_confirm_or_read()
    {
        using (var confirm = await SendAsync(Till, HttpMethod.Put, $"{Orders}/confirm?{Version}", new { orderNumber = 999999 }))
        {
            // Today the service cannot tell "no such order" from "something broke" and answers 500 for both;
            // what matters here is that it does not pretend to have confirmed one
            Assert.IsFalse(confirm.IsSuccessStatusCode, "there is nothing to confirm");
        }

        var (missing, _) = await Suite.Ordering.AsAnonymous().RefusedAsync(HttpMethod.Get, $"{Orders}/999999?{Version}");
        Assert.AreEqual(HttpStatusCode.NotFound, missing);
    }

    [TestMethod]
    public async Task The_counter_and_the_back_office_have_their_own_doors()
    {
        var userId = $"customer-{Guid.NewGuid():N}";
        var orderNumber = await PlaceOrderAsync(userId);
        var customer = Customer(userId);

        foreach (var (method, path) in new[]
        {
            (HttpMethod.Get, $"{Orders}/pending?{Version}"),
            (HttpMethod.Get, $"{Orders}/kitchen?{Version}"),
            (HttpMethod.Put, $"{Orders}/{orderNumber}/ready?{Version}"),
        })
        {
            var (status, _) = await customer.RefusedAsync(method, path);
            Assert.AreEqual(HttpStatusCode.Forbidden, status, $"{method} {path} is the counter's");
        }

        using (var confirm = await SendAsync(customer, HttpMethod.Put, $"{Orders}/confirm?{Version}", new { orderNumber }))
        {
            Assert.AreEqual(HttpStatusCode.Forbidden, confirm.StatusCode, "a customer does not confirm their own order");
        }

        var (tillDelete, _) = await Till.RefusedAsync(HttpMethod.Delete, $"{Orders}/{orderNumber}?{Version}");
        Assert.AreEqual(HttpStatusCode.Forbidden, tillDelete, "removing an order outright is the back office's");

        var (adminDelete, _) = await BackOffice.RefusedAsync(HttpMethod.Delete, $"{Orders}/{orderNumber}?{Version}");
        Assert.AreNotEqual(HttpStatusCode.Forbidden, adminDelete, "the back office's door is open; whether the order may go is the order's business");
    }
}
