using Ninja.E2E.Actors;
using Ninja.E2E.Fixtures;
using Ninja.E2E.Harness;
using Ninja.E2E.Manifest;
using Ninja.E2E.Support;

namespace Ninja.E2E.Scenarios;

/// <summary>
/// One day at the branch, start to finish, in the order a real one runs:
/// the shift opens; a customer orders from the app and the kitchen makes
/// it; the cashier adds to bills, splits them, settles them, takes a tab
/// payment; a room session runs and a customer calls the waiter; walk-ups
/// are rung up, refunded and voided; a delivery arrives, stock is wasted,
/// sold out and counted; every kind of cash movement goes through the
/// drawer; a barista is hired, paid and their payslip closed; the shift
/// closes. Then the month's P&amp;L is reconciled against everything the day
/// did and the choreography audit checks the outbox, the bus, the hub and
/// the logs. The individual scenarios assert each hop in depth; this one
/// asserts that the whole day hangs together.
/// </summary>
public sealed class FullDayScenario(NinjaApp app, DaySetup day) : ScenarioBase(app, day)
{
    protected override decimal OpeningFloat => 1000m;

    [Fact]
    public async Task A_day_in_the_life_of_the_branch()
    {
        var month = Money.Month(BusinessDay);
        var coffee = Menu.Item(MenuLookup.TurkishCoffee);
        var tea = Menu.Item(MenuLookup.Tea);
        var cappuccino = Menu.Item(MenuLookup.Cappuccino);
        const decimal vat = DaySetup.VatRate, service = DaySetup.ServiceRate;
        var coffeeGoods = DaySetup.BeansPerCoffeeGrams * DaySetup.BeansUnitCost;
        var teaGoods = DaySetup.TeaBagUnitCost;

        // What the day should add to the month, accumulated as it happens.
        decimal sales = 0, refunds = 0, vatTotal = 0, goods = 0, waste = 0, labour = 0, expenses = 0;
        decimal cashIn = 0;   // cash payments taken
        decimal change = 0;   // change handed back
        decimal cashRefunds = 0, cashTabPayments = 0, payIns = 0, payOuts = 0;

        // Let the shift's own fan-out settle before baselining the month.
        await Task.Delay(TimeSpan.FromSeconds(2), Ct);
        var dayStart = App.Checkpoint();
        var profitBefore = await Owner.ProfitAsync(month.Year, month.Month, Ct);
        var balanceBefore = (await Cashier.AccountBalanceAsync(Customer.UserId, Ct))?.Balance ?? 0m;

        // --- Morning: a customer at a table -------------------------------------
        Step("A customer orders at Table 1 from the app; the cashier confirms; the kitchen makes it");
        var tableOrder = await Customer.PlaceOrderAsync(Menu, Lines((MenuLookup.Cappuccino, 1), (MenuLookup.TurkishCoffee, 1)), Ct, 1, "Table 1");
        await Cashier.ConfirmAsync(tableOrder, Ct);
        var tableTicket = await ExpectValueAsync("the table bill", async () =>
            (await Cashier.OpenTicketsAsync(Ct)).FirstOrDefault(t => t.TableId == 1 && t.LineCount == 2));
        goods += coffeeGoods;
        await Kitchen.MarkReadyAsync(tableOrder, Ct);

        Step("The cashier adds two teas, then splits them off for a friend");
        var teas = await Cashier.RingUpAsync(Menu, Lines((MenuLookup.Tea, 2)), Ct, ticketId: tableTicket.Id);
        goods += 2 * teaGoods;
        var teaLine = (await TicketAsync(tableTicket.Id)).Lines.Single(l => l.OrderId == teas.OrderId);
        var friendTab = await Cashier.MoveLinesToNewCounterAsync(tableTicket.Id, [teaLine.Id], "Friend", Ct);

        Step("The table pays by card and on the customer's tab; the friend pays cash; the tab is paid off");
        var tableBill = Money.Bill(cappuccino.EffectivePrice + coffee.EffectivePrice, served: cappuccino.EffectivePrice + coffee.EffectivePrice, vat, service);
        var onAccount = tableBill.Total - 50m;
        await Cashier.SettleAsync(tableTicket.Id, Ct, Tender.Card(50m), Tender.Account(onAccount, Customer.UserId, Customer.DisplayName));
        sales += tableBill.Total; vatTotal += tableBill.Vat;

        var friendBill = Money.Bill(2 * tea.EffectivePrice, served: 0m, vat, service);
        var friendReceipt = await Cashier.SettleAsync(friendTab, Ct, Tender.Cash(50m));
        sales += friendBill.Total; vatTotal += friendBill.Vat; cashIn += 50m; change += friendReceipt.Change;

        await ExpectAsync("the tab was charged", async () =>
            Assert.Equal(balanceBefore + onAccount, (await Cashier.AccountBalanceAsync(Customer.UserId, Ct))!.Balance));
        await Cashier.TakeTabPaymentAsync(Customer.UserId, Customer.DisplayName, Codes.Tender.Cash, onAccount, Ct);
        cashTabPayments += onAccount;
        await Cashier.AssignOrderCustomerAsync(teas.OrderId, null, "Friend", Ct);

        // --- Midday: the rooms -------------------------------------------------------
        Step("A group walks into Room 1, a member joins, they order, call the waiter, and leave");
        var room1 = (await Cashier.RoomsAsync(Ct)).First(r => r.Name.En == "Room 1");
        var session = await Cashier.StartWalkInAsync(room1.Id, Ct);
        var roomTicket = await ExpectValueAsync("the room bill", async () =>
            (await Cashier.OpenTicketsAsync(Ct)).FirstOrDefault(t => t.SessionId == session));
        await Cashier.AddMemberAsync(session, Customer.UserId, Customer.DisplayName, Ct);
        await Cashier.RingUpAsync(Menu, Lines((MenuLookup.TurkishCoffee, 1)), Ct, ticketId: roomTicket.Id);
        goods += coffeeGoods;
        await Customer.RequestServiceAsync(session, room1.Id, room1.Name.En, Codes.ServiceRequest.CallWaiter, Ct);
        await Cashier.EndSessionAsync(session, Ct);
        await ExpectAsync("the room bill is free to settle", async () => Assert.NotNull((await TicketAsync(roomTicket.Id)).SessionEndedAt));
        var roomBill = Money.Bill(coffee.EffectivePrice, served: coffee.EffectivePrice, vat, service);
        await Cashier.SettleAsync(roomTicket.Id, Ct, Tender.Cash(roomBill.Total));
        sales += roomBill.Total; vatTotal += roomBill.Vat; cashIn += roomBill.Total;

        Step("Room 2 is started by mistake and cancelled; Room 3 ends with nothing on it");
        var room2 = (await Cashier.RoomsAsync(Ct)).First(r => r.Name.En == "Room 2");
        var wrong = await Cashier.StartWalkInAsync(room2.Id, Ct);
        await ExpectValueAsync("Room 2's bill", async () => (await Cashier.OpenTicketsAsync(Ct)).FirstOrDefault(t => t.SessionId == wrong));
        await Cashier.CancelSessionAsync(wrong, Ct);
        var room3 = (await Cashier.RoomsAsync(Ct)).First(r => r.Name.En == "Room 3");
        var empty = await Cashier.StartWalkInAsync(room3.Id, Ct);
        await ExpectValueAsync("Room 3's bill", async () => (await Cashier.OpenTicketsAsync(Ct)).FirstOrDefault(t => t.SessionId == empty));
        await Cashier.EndSessionAsync(empty, Ct);

        // --- Afternoon: walk-ups ----------------------------------------------------
        Step("A regular buys two coffees for cash and brings one back; a walk-in's tea is voided");
        var counter = await Cashier.RingUpAsync(Menu, Lines((MenuLookup.TurkishCoffee, 2)), Ct, Customer.UserId, Customer.DisplayName);
        goods += 2 * coffeeGoods;
        var counterBill = Money.Bill(2 * coffee.EffectivePrice, served: 0m, vat, service);
        var counterReceipt = await Cashier.SettleAsync(counter.TicketId, Ct, Tender.Cash(100m));
        sales += counterBill.Total; vatTotal += counterBill.Vat; cashIn += 100m; change += counterReceipt.Change;
        var counterTicket = await TicketAsync(counter.TicketId);
        var coffeeLine = Assert.Single(counterTicket.Lines);
        var refund = await Owner.RefundAsync(counter.TicketId, [(coffeeLine.Id, 1m)], "too strong", Ct);
        Assert.Equal(Money.RefundLine(coffeeLine.Total, coffeeLine.Qty, 1m, counterTicket.Total, counterTicket.Subtotal), refund.Amount);
        refunds += refund.Amount; cashRefunds += refund.Amount;

        var walkIn = await Cashier.RingUpAsync(Menu, Lines((MenuLookup.Tea, 1)), Ct);
        goods += teaGoods; // stock left with the order; a void does not restock
        await Owner.VoidAsync(walkIn.TicketId, "walked away", Ct);

        // --- Stock: a delivery, waste, a sell-out, a count ------------------------------
        Step("Lemons arrive, one is wasted, lemonade sells out, one more is refused, a count brings it back");
        var lemonadeName = $"E2E Day Lemonade {Day.RunId}";
        var lemonade = await Owner.CreateMenuItemAsync(lemonadeName, 20m, 5, Ct);
        var lemons = await Owner.CreateStockItemAsync($"E2E Day Lemons {Day.RunId}", "pcs", autoSoldOut: true, Ct);
        await Owner.SetReorderLevelAsync(lemons, 2m, Ct);
        await Owner.SetRecipeAsync(lemonade.Id, [(lemons, 1m)], Ct);
        await Menu.RefreshAsync(Ct);
        await Owner.ReceivePurchaseAsync([(lemons, 3m, 4m)], Ct, supplierId: Day.SupplierId, invoiceRef: $"DAY-{Day.RunId}");
        await Owner.PostWasteAsync(lemons, 1m, "bruised", Ct);
        waste += 4m;
        var lemonadeSale = await Cashier.RingUpAsync(Menu, Lines((lemonadeName, 2)), Ct);
        goods += 8m;
        var lemonadeBill = Money.Bill(40m, served: 0m, vat, service);
        await Cashier.SettleAsync(lemonadeSale.TicketId, Ct, Tender.Cash(lemonadeBill.Total));
        sales += lemonadeBill.Total; vatTotal += lemonadeBill.Vat; cashIn += lemonadeBill.Total;
        await ExpectAsync("lemonade is sold out at the till", async () =>
        {
            await Menu.RefreshAsync(Ct);
            Assert.True(Menu.Item(lemonadeName).IsOutOfStock);
        });
        var (_, refusedTicket) = await Cashier.TryRingUpAsync(Menu, Lines((lemonadeName, 1)), Ct);
        Assert.Null(refusedTicket);
        await Owner.PostCountAsync([(lemons, 5m)], "recount", Ct);
        await ExpectAsync("lemonade is back", async () =>
        {
            await Menu.RefreshAsync(Ct);
            Assert.True(Menu.Item(lemonadeName).IsAvailable);
        });

        // --- Staff: a new barista, paid from the till --------------------------------------
        Step("A barista is hired and marked present; the till pays a wage and an advance; the payslip is closed");
        var barista = await Owner.HireAsync($"E2E Day Barista {Day.RunId}", BusinessDay.AddDays(-1), 200m, Ct);
        await Owner.MarkPresentAsync(BusinessDay, barista, Ct);
        labour += 200m;
        Assert.Equal(HttpStatusCode.OK, (await Cashier.PayOutAsync(ShiftId, 120m, "Evening wage", Ct, kind: Codes.MovementKind.Wage, employeeId: barista, employeeName: "Barista")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Cashier.PayOutAsync(ShiftId, 30m, "Advance", Ct, kind: Codes.MovementKind.Advance, employeeId: barista, employeeName: "Barista")).StatusCode);
        payOuts += 150m;
        await ExpectAsync("the barista's ledger shows the wage and the advance", async () =>
        {
            var ledger = await Owner.LedgerAsync(barista, Ct);
            Assert.Contains(ledger.Entries, x => x.Type == Codes.LedgerEntry.Payment && x.Amount == 120m);
            Assert.Contains(ledger.Entries, x => x.Type == Codes.LedgerEntry.Advance && x.Amount == 30m);
            Assert.Equal(50m, ledger.Balance);
        });
        var payslipId = Assert.Single(await Owner.GeneratePayslipsAsync(barista, month.Start, month.End, Ct));
        await Owner.PayPayslipAsync(payslipId, null, "day end", Ct);
        Assert.Equal(0m, (await Owner.LedgerAsync(barista, Ct)).Balance);

        // --- The drawer: the rest of the movements ---------------------------------------
        Step("Change from the safe, a taxi, the supplier, the electricity bill, the partner's drawing and contribution");
        Assert.Equal(HttpStatusCode.OK, (await Cashier.PayInAsync(ShiftId, 200m, "Change from the safe", Ct)).StatusCode);
        payIns += 200m;
        Assert.Equal(HttpStatusCode.OK, (await Cashier.PayOutAsync(ShiftId, 40m, "Taxi", Ct)).StatusCode);
        payOuts += 40m;
        Assert.Equal(HttpStatusCode.OK, (await Cashier.PayOutAsync(ShiftId, 100m, "Beans", Ct, kind: Codes.MovementKind.Supplier, supplierId: Day.SupplierId, supplierName: Day.SupplierName)).StatusCode);
        payOuts += 100m;
        Assert.Equal(HttpStatusCode.OK, (await Cashier.PayOutAsync(ShiftId, 60m, "Electricity", Ct, kind: Codes.MovementKind.Expense, categoryId: Day.ElectricityCategoryId)).StatusCode);
        payOuts += 60m; expenses += 60m;
        Assert.Equal(HttpStatusCode.OK, (await Cashier.PayOutAsync(ShiftId, 20m, "Drawing", Ct, kind: Codes.MovementKind.Partner, partnerId: Day.PartnerId, partnerName: Day.PartnerName)).StatusCode);
        payOuts += 20m;
        Assert.Equal(HttpStatusCode.OK, (await Cashier.PayInAsync(ShiftId, 300m, "Contribution", Ct, kind: Codes.MovementKind.Partner, partnerId: Day.PartnerId, partnerName: Day.PartnerName)).StatusCode);
        payIns += 300m;

        // --- Closing ---------------------------------------------------------------------
        Step("Close the shift");
        var expectedCash = OpeningFloat + cashIn - change - cashRefunds + cashTabPayments + payIns - payOuts;
        var live = await CurrentShiftAsync();
        Assert.Equal(expectedCash, live.ExpectedInDrawer);
        Assert.Equal(sales, live.SalesTotal);
        Assert.Equal(refunds, live.RefundsTotal);
        Assert.Equal(cashTabPayments, live.TabPaymentsTotal);
        var z = await Cashier.CloseShiftAsync(ShiftId, expectedCash, Ct);
        Assert.Equal(expectedCash, z.ExpectedCash);
        Assert.Equal(0m, z.OverShort);
        await ExpectAsync("the branch closed with the shift", async () =>
            Assert.False((await Cashier.BranchesAsync(Ct)).Single(b => b.Id == 1).IsOrderingEnabled));

        // --- The books ----------------------------------------------------------------------
        Step("Reconcile the month's P&L against the day");
        await ExpectAsync("the P&L reflects everything the day did", async () =>
        {
            var d = (await Owner.ProfitAsync(month.Year, month.Month, Ct)).Since(profitBefore);
            Assert.Equal(sales, d.Sales);
            Assert.Equal(refunds, d.Refunds);
            Assert.Equal(sales - refunds, d.NetSales);
            Assert.Equal(vatTotal, d.Vat);
            Assert.Equal(goods, d.Goods);
            Assert.Equal(waste, d.Waste);
            Assert.Equal(labour, d.Labour);
            Assert.Equal(expenses, d.Expenses);
            Assert.Equal(d.NetSales - d.Goods - d.Waste - d.Labour - d.Expenses, d.Profit);
        }, TimeSpan.FromSeconds(30));
        await ExpectAsync("the supplier's account carries the invoice and the payment", async () =>
        {
            var ledger = await Owner.SupplierLedgerAsync(Day.SupplierId, Ct);
            Assert.Contains(ledger.Entries, x => x.Type == Codes.SupplierEntry.Invoice && x.Note == $"DAY-{Day.RunId}");
            Assert.Contains(ledger.Entries, x => x.Type == Codes.SupplierEntry.Payment && x.Amount == 100m && x.Reference!.StartsWith($"shift:{ShiftId}:", StringComparison.Ordinal));
        });
        await ExpectAsync("the partner's account carries the drawing and the contribution", async () =>
        {
            var ledger = await Owner.PartnerLedgerAsync(Day.PartnerId, Ct);
            Assert.Contains(ledger.Entries, x => x.Type == Codes.PartnerEntry.Drawing && x.Amount == 20m && x.Reference!.StartsWith($"shift:{ShiftId}:", StringComparison.Ordinal));
            Assert.Contains(ledger.Entries, x => x.Type == Codes.PartnerEntry.Contribution && x.Amount == 300m && x.Reference!.StartsWith($"shift:{ShiftId}:", StringComparison.Ordinal));
        });
        Assert.Equal(balanceBefore, (await Cashier.AccountBalanceAsync(Customer.UserId, Ct))!.Balance);

        // --- The audit --------------------------------------------------------------------
        Step("Audit the day's choreography: outbox, bus, hub, logs");
        await ChoreographyAudit.RunAsync(App, BeforeShift, Ct); // from before the shift opened, so ShiftOpened is in scope
        AssertSameBusinessDay();
    }
}
