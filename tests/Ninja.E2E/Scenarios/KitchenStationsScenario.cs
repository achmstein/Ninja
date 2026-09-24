using Ninja.E2E.Actors;
using Ninja.E2E.Fixtures;
using Ninja.E2E.Harness;
using Ninja.E2E.Support;

namespace Ninja.E2E.Scenarios;

/// <summary>
/// The kitchen split in two: coffee goes to the bar's screen, tea to a
/// printer. A counter sale of both lands on each as its part only; the
/// printer's part becomes a ticket one device prints; the order is ready
/// when the bar is, the printed part never holding it back; and the till
/// asks for the paper again. Catalog, Ordering and Notification take part.
/// Housekeeping puts the kitchen back to one station afterwards.
/// </summary>
public sealed class KitchenStationsScenario(NinjaApp app, DaySetup day) : ScenarioBase(app, day)
{
    [Fact]
    public async Task A_split_order_reaches_its_screen_and_its_printer()
    {
        var cappuccino = Menu.Item(MenuLookup.Cappuccino);
        var tea = Menu.Item(MenuLookup.Tea);
        Assert.NotEqual(cappuccino.CatalogTypeId, tea.CatalogTypeId);

        // 1. The back office splits the kitchen: coffee to the bar's screen, tea to a printer.
        var setup = Step("Owner sets up a Bar screen and a Tea printer");
        var bar = await Owner.CreateStationAsync("Bar", [cappuccino.CatalogTypeId], screen: true, printerHost: null, Ct);
        var teaPrinter = await Owner.CreateStationAsync("Tea printer", [tea.CatalogTypeId], screen: false, printerHost: "127.0.0.1", Ct);
        var stations = await Kitchen.StationsAsync(Ct);
        var kitchenDefault = Assert.Single(stations, s => s.IsDefault);
        Assert.Equal(3, stations.Count);
        Assert.Equal(9100, Assert.Single(stations, s => s.Id == teaPrinter.Id).PrinterPort);

        // 2. A counter sale of both confirms itself; Catalog names each line's category.
        var sale = Step("Cashier rings up a cappuccino and two teas");
        var rung = await Cashier.RingUpAsync(Menu, Lines((MenuLookup.Cappuccino, 1), (MenuLookup.Tea, 2)), Ct);
        await ExpectEventAsync(sale, "OrderStockConfirmed", e => e.Int("OrderId") == rung.OrderId);
        await ExpectEventAsync(sale, "OrderStatusChangedToConfirmed", e => e.Int("OrderId") == rung.OrderId);
        await ExpectEventAsync(sale, "KitchenTicketQueued", e => e.Int("BranchId") == 1);
        await ExpectHubAsync(sale, "OrderStatusChanged", m => m.Str("type") == "kitchen_ticket" && m.Int("branchId") == 1);

        // 3. The bar's screen has the cappuccino and nothing else; the kitchen's has nothing of it.
        var onBar = await ExpectValueAsync("the order on the bar's screen", async () =>
            (await Kitchen.BoardAsync(Ct, bar.Id)).FirstOrDefault(o => o.OrderNumber == rung.OrderId));
        var barLine = Assert.Single(onBar.Items);
        Assert.Equal(MenuLookup.Cappuccino, barLine.ProductName.En);
        Assert.Null(onBar.ReadyAt);
        Assert.DoesNotContain(await Kitchen.BoardAsync(Ct, kitchenDefault.Id), o => o.OrderNumber == rung.OrderId);

        // 4. The pass sees the order whole, split in two parts.
        var onPass = Assert.Single(await Kitchen.BoardAsync(Ct), o => o.OrderNumber == rung.OrderId);
        Assert.Equal(2, onPass.Items.Count);
        Assert.Equal(2, onPass.Parts!.Count);
        Assert.True(Assert.Single(onPass.Parts, p => p.StationId == bar.Id).ShowsOnScreen);
        var printedPart = Assert.Single(onPass.Parts, p => p.StationId == teaPrinter.Id);
        Assert.True(printedPart.PrintsTickets);
        Assert.False(printedPart.ShowsOnScreen);

        // 5. The tea's ticket waits for a printer, with the tea on it and nothing else.
        var print = Step("A device in the shop prints the tea's ticket");
        var ticket = Assert.Single(await Kitchen.PrintJobsAsync(Ct), t => t.OrderNumber == rung.OrderId);
        Assert.Equal(teaPrinter.Id, ticket.StationId);
        Assert.Equal("127.0.0.1", ticket.PrinterHost);
        Assert.False(ticket.IsReprint);
        var teaLine = Assert.Single(ticket.Items);
        Assert.Equal(MenuLookup.Tea, teaLine.ProductName.En);
        Assert.Equal(2, teaLine.Units);

        // The till and a kitchen tablet both reach for it; one prints it.
        Assert.True(await Kitchen.ClaimAsync(ticket.JobId, "e2e-till", Ct));
        Assert.False(await Kitchen.ClaimAsync(ticket.JobId, "e2e-tablet", Ct));
        await Kitchen.PrintedAsync(ticket.JobId, Ct);
        Assert.DoesNotContain(await Kitchen.PrintJobsAsync(Ct), t => t.JobId == ticket.JobId);

        // 6. The bar finishes; the printed tea never holds the order back.
        var ready = Step("The bar marks its part ready");
        await Kitchen.MarkStationReadyAsync(rung.OrderId, bar.Id, Ct);
        var readyEvent = await ExpectEventAsync(ready, "OrderReadyChanged", e => e.Int("OrderId") == rung.OrderId);
        Assert.True(readyEvent.Bool("IsReady"));
        await ExpectOrderStatusAsync(ready, "order_ready", rung.OrderId);
        await ExpectAsync("the pass shows the order ready", async () =>
            Assert.NotNull(Assert.Single(await Kitchen.BoardAsync(Ct), o => o.OrderNumber == rung.OrderId).ReadyAt));

        // 7. The ticket went missing: the till asks for it again.
        var reprint = Step("The cashier reprints the order's kitchen tickets");
        await Kitchen.ReprintAsync(rung.OrderId, Ct);
        await ExpectEventAsync(reprint, "KitchenTicketQueued", e => e.Int("BranchId") == 1);
        var again = Assert.Single(await Kitchen.PrintJobsAsync(Ct), t => t.OrderNumber == rung.OrderId);
        Assert.True(again.IsReprint);
        Assert.Equal(teaPrinter.Id, again.StationId);
    }
}
