using Ninja.E2E.Actors;
using Ninja.E2E.Fixtures;
using Ninja.E2E.Harness;
using Ninja.E2E.Support;

namespace Ninja.E2E.Scenarios;

/// <summary>
/// A customer orders from the app at a table, staff confirm it, the kitchen
/// makes it, the cashier adds to the bill and splits a friend's tea off it,
/// the table pays half by card and half on the customer's tab, and the tab
/// is paid off at the till. Ordering, Sales, Inventory, Loyalty, Accounts
/// and Notification all take part.
/// </summary>
public sealed class TableAndCustomerOrderScenario(NinjaApp app, DaySetup day) : ScenarioBase(app, day)
{
    private const int TableId = 1;
    private const string TableName = "Table 1";

    [Fact]
    public async Task Customer_order_confirm_split_settle_and_pay_tab()
    {
        var cappuccino = Menu.Item(MenuLookup.Cappuccino);
        var coffee = Menu.Item(MenuLookup.TurkishCoffee);
        var tea = Menu.Item(MenuLookup.Tea);
        var loyaltyBefore = (await Owner.LoyaltyAsync(Customer.UserId, Ct))!;
        var balanceBefore = (await Cashier.AccountBalanceAsync(Customer.UserId, Ct))?.Balance ?? 0m;

        // 1. The customer orders a cappuccino and a coffee to Table 1 from the app.
        var place = Step("Customer places an order at Table 1");
        var orderId = await Customer.PlaceOrderAsync(Menu, Lines((MenuLookup.Cappuccino, 1), (MenuLookup.TurkishCoffee, 1)), Ct, TableId, TableName);
        var tableMenu = cappuccino.EffectivePrice + coffee.EffectivePrice; // 75.00

        await ExpectEventAsync(place, "OrderStarted");
        await ExpectEventAsync(place, "OrderStatusChangedToAwaitingValidation", e => e.Int("OrderId") == orderId);
        await ExpectEventAsync(place, "OrderStockConfirmed", e => e.Int("OrderId") == orderId);
        var submitted = await ExpectEventAsync(place, "OrderStatusChangedToSubmitted", e => e.Int("OrderId") == orderId);
        Assert.Equal(Customer.UserId, submitted.Str("BuyerIdentityGuid"));
        Assert.Equal(1, submitted.Int("BranchId"));
        // Customer orders wait for staff: nothing is confirmed on its own.
        await ExpectNoEventAsync(place, "OrderStatusChangedToConfirmed");

        var pending = Assert.Single(await Cashier.PendingAsync(Ct), o => o.OrderNumber == orderId);
        Assert.Equal("Submitted", pending.Status);
        Assert.Equal(TableId, pending.TableId);
        Assert.Equal(Customer.UserId, pending.UserId);
        Assert.Equal(2, pending.Items!.Count);
        await ExpectOrderStatusAsync(place, "order_submitted", orderId);

        // 2. The cashier confirms: the same fan-out a POS sale gets.
        var confirm = Step("Cashier confirms the order");
        await Cashier.ConfirmAsync(orderId, Ct);
        var confirmed = await ExpectEventAsync(confirm, "OrderStatusChangedToConfirmed", e => e.Int("OrderId") == orderId);
        Assert.Equal("Customer", confirmed.Str("Source"));
        Assert.Equal(TableId, confirmed.Int("TableId"));
        Assert.Null(confirmed.Str("TicketId"));
        var consumed = await ExpectEventAsync(confirm, "StockConsumed", e => e.Str("Reference") == $"order:{orderId}");
        Assert.Equal(DaySetup.BeansPerCoffeeGrams * DaySetup.BeansUnitCost, consumed.Dec("Cost")); // only the coffee has a recipe

        var table = await ExpectValueAsync("Sales opened the table's bill", async () =>
            (await Cashier.OpenTicketsAsync(Ct)).FirstOrDefault(t => t.TableId == TableId && t.LineCount == 2));
        Assert.Equal("Table", table.Type);
        Assert.Contains(Customer.UserId, table.CustomerIds);
        var expectedPoints = Money.LoyaltyPoints(tableMenu, loyaltyBefore.CurrentTier);
        await ExpectAsync("Loyalty awarded the customer", async () =>
            Assert.Equal(loyaltyBefore.PointsBalance + expectedPoints, (await Owner.LoyaltyAsync(Customer.UserId, Ct))!.PointsBalance));
        await ExpectAsync("the kitchen board shows the order", async () =>
            Assert.Contains(await Kitchen.BoardAsync(Ct), o => o.OrderNumber == orderId));
        await ExpectOrderStatusAsync(confirm, "order_confirmed", orderId);
        await ExpectHubAsync(confirm, "TicketUpdated", m => m.Int("ticketId") == table.Id);

        // 3. The cashier adds two teas to the table's bill from the pad.
        var addOn = Step("Cashier adds 2 teas to the table bill");
        var teas = await Cashier.RingUpAsync(Menu, Lines((MenuLookup.Tea, 2)), Ct, ticketId: table.Id);
        Assert.Equal(table.Id, teas.TicketId);
        var addOnEvent = await ExpectEventAsync(addOn, "OrderStatusChangedToConfirmed", e => e.Int("OrderId") == teas.OrderId);
        Assert.Equal(table.Id, addOnEvent.Int("TicketId"));

        var ticket = await TicketAsync(table.Id);
        Assert.Equal(3, ticket.Lines.Count);
        var teaLine = Assert.Single(ticket.Lines, l => l.OrderId == teas.OrderId);
        Assert.Equal(2m, teaLine.Qty);
        Assert.Equal(2 * tea.EffectivePrice, teaLine.Total);
        Assert.Null(teaLine.CustomerName);
        Assert.Equal(tableMenu + 2 * tea.EffectivePrice, ticket.Subtotal);

        // 4. The teas were a friend's: split them onto their own counter tab.
        var split = Step("Move the teas onto a new counter tab for the friend");
        var friendTab = await Cashier.MoveLinesToNewCounterAsync(table.Id, [teaLine.Id], "Friend", Ct);
        Assert.NotEqual(table.Id, friendTab);
        await ExpectEventAsync(split, "TicketUpdated", e => e.Int("TicketId") == table.Id);
        await ExpectEventAsync(split, "TicketUpdated", e => e.Int("TicketId") == friendTab);

        ticket = await TicketAsync(table.Id);
        Assert.Equal(2, ticket.Lines.Count);
        var friend = await TicketAsync(friendTab);
        Assert.Equal("Counter", friend.Type);
        Assert.Equal("Friend", friend.Label);
        var friendBill = Money.Bill(2 * tea.EffectivePrice, served: 0m, DaySetup.VatRate, DaySetup.ServiceRate); // 30 + 4.20
        Assert.Equal(friendBill.Total, friend.Total);

        // 5. Put the friend's name on their line.
        var name = Step("Name the friend on their tea line");
        await Cashier.NameLinesAsync(friendTab, [Assert.Single(friend.Lines).Id], null, "Friend", Ct);
        await ExpectEventAsync(name, "TicketUpdated", e => e.Int("TicketId") == friendTab);
        friend = await TicketAsync(friendTab);
        Assert.Equal("Friend", Assert.Single(friend.Lines).CustomerName);
        Assert.Null(Assert.Single(friend.Lines).CustomerId);

        // 6. The kitchen finishes the customer's order.
        var ready = Step("Kitchen marks the order ready");
        await Kitchen.MarkReadyAsync(orderId, Ct);
        var readyEvent = await ExpectEventAsync(ready, "OrderReadyChanged", e => e.Int("OrderId") == orderId);
        Assert.True(readyEvent.Bool("IsReady"));
        await ExpectAsync("the board shows it ready", async () =>
            Assert.NotNull(Assert.Single(await Kitchen.BoardAsync(Ct), o => o.OrderNumber == orderId).ReadyAt));
        await ExpectOrderStatusAsync(ready, "order_ready", orderId);

        // 7. The table pays: 50 by card, the rest on the customer's tab.
        var tableBill = Money.Bill(tableMenu, served: tableMenu, DaySetup.VatRate, DaySetup.ServiceRate); // 75 + 7.50 + 11.55 = 94.05
        var onAccount = tableBill.Total - 50m;
        var settleTable = Step($"Settle the table: 50 card + {onAccount} on the customer's tab");
        var tableReceipt = await Cashier.SettleAsync(table.Id, Ct, Tender.Card(50m), Tender.Account(onAccount, Customer.UserId, Customer.DisplayName));
        Assert.Equal(0m, tableReceipt.Change);

        var tableSettled = await ExpectEventAsync(settleTable, "TicketSettled", e => e.Int("TicketId") == table.Id);
        Assert.Equal(tableBill.Total, tableSettled.Dec("Total"));
        Assert.Equal(tableBill.ServiceCharge, tableSettled.Dec("ServiceCharge"));
        Assert.Equal(tableBill.Vat, tableSettled.Dec("Vat"));
        var charge = Assert.Single(tableSettled.Array("AccountCharges"));
        Assert.Equal(Customer.UserId, charge.GetProperty("CustomerId").GetString());
        Assert.Equal(onAccount, charge.GetProperty("Amount").GetDecimal());

        await ExpectAsync("Accounts charged the customer's tab", async () =>
        {
            Assert.Equal(balanceBefore + onAccount, (await Cashier.AccountBalanceAsync(Customer.UserId, Ct))!.Balance);
            var account = await Owner.AccountAsync(Customer.UserId, Ct);
            Assert.Contains(account!.Transactions, t => t.Source == "posReceipt" && t.SourceNumber == tableReceipt.ReceiptNumber && t.Amount == onAccount);
        });

        var shift = await CurrentShiftAsync();
        Assert.Equal(50m, Assert.Single(shift.TenderTotals, t => t.Tender == "Card").Amount);
        Assert.Equal(onAccount, Assert.Single(shift.TenderTotals, t => t.Tender == "Account").Amount);
        Assert.Equal(OpeningFloat, shift.ExpectedInDrawer); // nothing in cash yet

        // 8. The friend pays cash.
        var settleFriend = Step("Settle the friend's tab with 50 cash");
        var friendReceipt = await Cashier.SettleAsync(friendTab, Ct, Tender.Cash(50m));
        Assert.Equal(50m - friendBill.Total, friendReceipt.Change);
        await ExpectEventAsync(settleFriend, "TicketSettled", e => e.Int("TicketId") == friendTab);
        shift = await CurrentShiftAsync();
        Assert.Equal(OpeningFloat + friendBill.Total, shift.ExpectedInDrawer);

        // 9. Later the customer pays their tab off in cash at the till.
        var tab = Step("Customer pays their tab in cash");
        var slip = await Cashier.TakeTabPaymentAsync(Customer.UserId, Customer.DisplayName, Codes.Tender.Cash, onAccount, Ct);
        Assert.True(slip.Number > 0);
        var tabEvent = await ExpectEventAsync(tab, "TabPaymentRecorded", e => e.Int("TabPaymentId") == slip.Id);
        Assert.Equal("Cash", tabEvent.Str("Tender"));
        Assert.Equal(onAccount, tabEvent.Dec("Amount"));
        Assert.Equal(Customer.UserId, tabEvent.Str("CustomerId"));

        await ExpectAsync("Accounts settled the tab", async () =>
        {
            Assert.Equal(balanceBefore, (await Cashier.AccountBalanceAsync(Customer.UserId, Ct))!.Balance);
            var account = await Owner.AccountAsync(Customer.UserId, Ct);
            Assert.Contains(account!.Transactions, t => t.Source == "posTabPayment" && t.SourceNumber == slip.Number && t.Amount == onAccount);
        });
        shift = await CurrentShiftAsync();
        Assert.Equal(onAccount, shift.TabPaymentsTotal);
        Assert.Equal(onAccount, shift.CashTabPayments);
        Assert.Contains(shift.TabPayments, p => p.Number == slip.Number);
        Assert.Equal(OpeningFloat + friendBill.Total + onAccount, shift.ExpectedInDrawer);

        // 10. Naming the tea order's customer after the fact still travels the bus, even though the bill is closed.
        var assign = Step("Assign the friend to the tea order in Ordering");
        await Cashier.AssignOrderCustomerAsync(teas.OrderId, null, "Friend", Ct);
        var assigned = await ExpectEventAsync(assign, "OrderCustomerAssigned", e => e.Int("OrderId") == teas.OrderId);
        Assert.Equal("Friend", assigned.Str("CustomerName"));
        Assert.Null(assigned.Str("BuyerIdentityGuid"));

        App.Logs.AssertNoHandlerFailures(Checkpoint.Logs);
        AssertSameBusinessDay();
    }
}
