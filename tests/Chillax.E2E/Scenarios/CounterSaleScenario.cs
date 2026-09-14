using Chillax.E2E.Actors;
using Chillax.E2E.Fixtures;
using Chillax.E2E.Harness;
using Chillax.E2E.Support;

namespace Chillax.E2E.Scenarios;

/// <summary>
/// A walk-up sale rung up for a known customer: the order is validated by
/// Catalog, auto-confirmed by Ordering, put on a ticket by Sales, deducted
/// from stock by Inventory, costed into Finance, awarded by Loyalty and
/// shown to the kitchen; then settled, partly refunded, and a second sale
/// voided. Every hop is asserted on the bus, in the projection and on the hub.
/// </summary>
public sealed class CounterSaleScenario(ChillaxApp app, DaySetup day) : ScenarioBase(app, day)
{
    [Fact]
    public async Task Ring_up_settle_refund_and_void()
    {
        var coffee = Menu.Item(MenuLookup.TurkishCoffee);
        var tea = Menu.Item(MenuLookup.Tea);
        var subtotal = 2 * coffee.EffectivePrice + tea.EffectivePrice;                 // 65.00
        var bill = Money.Bill(subtotal, served: 0m, DaySetup.VatRate, DaySetup.ServiceRate); // counter: no service, VAT 9.10, total 74.10
        var goods = 2 * DaySetup.BeansPerCoffeeGrams * DaySetup.BeansUnitCost + DaySetup.TeaBagUnitCost; // 12.00
        var month = Money.Month(BusinessDay);

        var beansBefore = (await Owner.LevelAsync(Day.BeansId, Ct)).OnHand;
        var bagsBefore = (await Owner.LevelAsync(Day.TeaBagsId, Ct)).OnHand;
        var loyaltyBefore = await Owner.LoyaltyAsync(Customer.UserId, Ct) ?? throw new Xunit.Sdk.XunitException("tester has no loyalty account");
        var profitBefore = await Owner.ProfitAsync(month.Year, month.Month, Ct);
        var expectedPoints = Money.LoyaltyPoints(subtotal, loyaltyBefore.CurrentTier);

        // 1. Ring up 2 x Turkish Coffee + 1 x Tea for the tester.
        var ring = Step("Ring up 2 Turkish Coffee + 1 Tea for the tester");
        var sale = await Cashier.RingUpAsync(Menu, Lines((MenuLookup.TurkishCoffee, 2), (MenuLookup.Tea, 1)), Ct,
            customerUserId: Customer.UserId, customerName: Customer.DisplayName);

        // The order's journey through the bus, in order.
        await ExpectEventAsync(ring, "OrderStarted");
        var validation = await ExpectEventAsync(ring, "OrderStatusChangedToAwaitingValidation", e => e.Int("OrderId") == sale.OrderId);
        Assert.Equal(2, validation.Array("OrderStockItems").Length);
        await ExpectEventAsync(ring, "OrderStockConfirmed", e => e.Int("OrderId") == sale.OrderId);
        await ExpectEventAsync(ring, "OrderStatusChangedToSubmitted", e => e.Int("OrderId") == sale.OrderId);
        var confirmed = await ExpectEventAsync(ring, "OrderStatusChangedToConfirmed", e => e.Int("OrderId") == sale.OrderId);
        Assert.Equal("Pos", confirmed.Str("Source"));
        Assert.Equal(Customer.UserId, confirmed.Str("BuyerIdentityGuid"));
        Assert.Equal(subtotal, confirmed.Dec("OrderTotal"));
        Assert.Equal(2, confirmed.Array("Items").Length);
        Assert.Equal(1, confirmed.Int("BranchId"));
        await ExpectEventAsync(ring, "TicketUpdated", e => e.Int("TicketId") == sale.TicketId);
        var consumed = await ExpectEventAsync(ring, "StockConsumed", e => e.Str("Reference") == $"order:{sale.OrderId}");
        Assert.Equal("Sale", consumed.Str("Kind"));
        Assert.Equal(goods, consumed.Dec("Cost"));

        // Sales: the ticket.
        var ticket = await TicketAsync(sale.TicketId);
        Assert.Equal("Counter", ticket.Type);
        Assert.Equal("Open", ticket.Status);
        Assert.Equal(2, ticket.Lines.Count);
        Assert.All(ticket.Lines, l =>
        {
            Assert.Equal(sale.OrderId, l.OrderId);
            Assert.Equal(Customer.UserId, l.CustomerId);
            Assert.Equal(Customer.DisplayName, l.CustomerName);
        });
        Assert.Equal(subtotal, ticket.Subtotal);
        Assert.Equal(0m, ticket.ServiceCharge);
        Assert.Equal(bill.Vat, ticket.Vat);
        Assert.Equal(bill.Total, ticket.Total);

        // Inventory: the recipe came off the shelf.
        await ExpectAsync("Inventory deducted the recipe", async () =>
        {
            Assert.Equal(beansBefore - 2 * DaySetup.BeansPerCoffeeGrams, (await Owner.LevelAsync(Day.BeansId, Ct)).OnHand);
            Assert.Equal(bagsBefore - 1, (await Owner.LevelAsync(Day.TeaBagsId, Ct)).OnHand);
        });

        // Loyalty: points on the menu money.
        await ExpectAsync("Loyalty awarded points for the order", async () =>
        {
            var account = await Owner.LoyaltyAsync(Customer.UserId, Ct);
            Assert.Equal(loyaltyBefore.PointsBalance + expectedPoints, account!.PointsBalance);
            var tx = await Owner.LoyaltyTransactionsAsync(Customer.UserId, Ct);
            var earned = Assert.Single(tx, t => t.ReferenceId == sale.OrderId.ToString() && t.Type == "Purchase");
            Assert.Equal(expectedPoints, earned.Points);
        });

        // Kitchen: the order is on the board.
        await ExpectAsync("the kitchen board shows the order", async () =>
            Assert.Contains(await Kitchen.BoardAsync(Ct), o => o.OrderNumber == sale.OrderId));

        // Finance: goods cost landed on the month.
        await ExpectAsync("Finance recorded the goods cost", async () =>
            Assert.Equal(goods, (await Owner.ProfitAsync(month.Year, month.Month, Ct)).Since(profitBefore).Goods));

        // Hub: the till and the kitchen were told.
        await ExpectOrderStatusAsync(ring, "order_submitted", sale.OrderId);
        await ExpectOrderStatusAsync(ring, "order_confirmed", sale.OrderId);
        await ExpectHubAsync(ring, "TicketUpdated", m => m.Int("ticketId") == sale.TicketId);

        // 2. Settle with 100 cash.
        var settle = Step("Settle the ticket with 100 cash");
        var settled = await Cashier.SettleAsync(sale.TicketId, Ct, Tender.Cash(100m));
        Assert.Equal(100m - bill.Total, settled.Change);

        var settledEvent = await ExpectEventAsync(settle, "TicketSettled", e => e.Int("TicketId") == sale.TicketId);
        Assert.Equal(bill.Total, settledEvent.Dec("Total"));
        Assert.Equal(subtotal, settledEvent.Dec("Subtotal"));
        Assert.Equal(bill.Vat, settledEvent.Dec("Vat"));
        Assert.Equal(0m, settledEvent.Dec("ServiceCharge"));
        Assert.Equal(0m, settledEvent.Dec("TimeTotal"));
        Assert.Empty(settledEvent.Array("AccountCharges"));
        await ExpectEventAsync(settle, "TicketUpdated", e => e.Int("TicketId") == sale.TicketId);

        ticket = await TicketAsync(sale.TicketId);
        Assert.Equal("Settled", ticket.Status);
        Assert.Equal(settled.Change, ticket.ChangeGiven);
        Assert.Equal(ShiftId, ticket.ShiftId);
        Assert.Equal(settled.ReceiptNumber, ticket.ReceiptNumber);
        var payment = Assert.Single(ticket.Payments);
        Assert.Equal("Cash", payment.Tender);
        Assert.Equal(100m, payment.Amount);
        Assert.Contains(await Cashier.SettledTicketsAsync(Ct), t => t.Id == sale.TicketId && t.ReceiptNumber == settled.ReceiptNumber);

        var shift = await CurrentShiftAsync();
        Assert.Equal(bill.Total, shift.SalesTotal);
        Assert.Equal(OpeningFloat + bill.Total, shift.ExpectedInDrawer);

        await ExpectAsync("Finance recorded the sale", async () =>
        {
            var d = (await Owner.ProfitAsync(month.Year, month.Month, Ct)).Since(profitBefore);
            Assert.Equal(bill.Total, d.Sales);
            Assert.Equal(bill.Vat, d.Vat);
        });
        await ExpectHubAsync(settle, "TicketUpdated", m => m.Int("ticketId") == sale.TicketId);

        // 3. The owner refunds one coffee in cash.
        var refund = Step("Owner refunds one coffee in cash");
        var coffeeLine = ticket.Lines.Single(l => l.Description.En == MenuLookup.TurkishCoffee);
        var refundAmount = Money.RefundLine(coffeeLine.Total, coffeeLine.Qty, 1m, ticket.Total, ticket.Subtotal); // 25 x 1.14 = 28.50
        var refundedMenu = Money.Round(coffeeLine.Total * 1m / coffeeLine.Qty);                                   // 25.00
        var clawback = Money.Clawback(expectedPoints, refundedMenu, subtotal);

        var refunded = await Owner.RefundAsync(sale.TicketId, [(coffeeLine.Id, 1m)], "spilled", Ct);
        Assert.Equal(refundAmount, refunded.Amount);

        var refundEvent = await ExpectEventAsync(refund, "TicketRefunded", e => e.Int("TicketId") == sale.TicketId);
        Assert.Equal(refundAmount, refundEvent.Dec("Amount"));
        Assert.Equal("Cash", refundEvent.Str("Tender"));
        var reversal = Assert.Single(refundEvent.Array("OrderReversals"));
        Assert.Equal(sale.OrderId, reversal.GetProperty("OrderId").GetInt32());
        Assert.Equal(refundedMenu, reversal.GetProperty("RefundedAmount").GetDecimal());
        Assert.Equal(subtotal, reversal.GetProperty("OrderAmount").GetDecimal());
        await ExpectEventAsync(refund, "TicketUpdated", e => e.Int("TicketId") == sale.TicketId);

        ticket = await TicketAsync(sale.TicketId);
        Assert.Equal(refundAmount, ticket.RefundedTotal);
        var note = Assert.Single(ticket.Refunds);
        Assert.Equal(1m, Assert.Single(note.Lines).Qty);

        await ExpectAsync("Loyalty clawed back the refunded share of the points", async () =>
        {
            var account = await Owner.LoyaltyAsync(Customer.UserId, Ct);
            Assert.Equal(loyaltyBefore.PointsBalance + expectedPoints - clawback, account!.PointsBalance);
            var tx = await Owner.LoyaltyTransactionsAsync(Customer.UserId, Ct);
            Assert.Contains(tx, t => t.Type == "Adjustment" && t.Points == -clawback && t.ReferenceId!.Contains($":{sale.OrderId}", StringComparison.Ordinal));
        });
        await ExpectAsync("Finance recorded the refund", async () =>
            Assert.Equal(refundAmount, (await Owner.ProfitAsync(month.Year, month.Month, Ct)).Since(profitBefore).Refunds));

        shift = await CurrentShiftAsync();
        Assert.Equal(refundAmount, shift.RefundsTotal);
        Assert.Equal(refundAmount, shift.CashRefunds);
        Assert.Equal(OpeningFloat + bill.Total - refundAmount, shift.ExpectedInDrawer);

        // 4. A second, anonymous sale that the owner voids before it is paid.
        var voided = Step("Ring up a tea for a walk-in and void it");
        var walkIn = await Cashier.RingUpAsync(Menu, Lines((MenuLookup.Tea, 1)), Ct);
        Assert.NotEqual(sale.TicketId, walkIn.TicketId);
        var pointsBeforeVoid = (await Owner.LoyaltyAsync(Customer.UserId, Ct))!.PointsBalance;

        await Owner.VoidAsync(walkIn.TicketId, "walked away", Ct);
        var voidEvent = await ExpectEventAsync(voided, "TicketVoided", e => e.Int("TicketId") == walkIn.TicketId);
        var voidReversal = Assert.Single(voidEvent.Array("OrderReversals"));
        Assert.Equal(walkIn.OrderId, voidReversal.GetProperty("OrderId").GetInt32());
        Assert.Equal(tea.EffectivePrice, voidReversal.GetProperty("RefundedAmount").GetDecimal());
        Assert.Equal(tea.EffectivePrice, voidReversal.GetProperty("OrderAmount").GetDecimal());
        await ExpectEventAsync(voided, "TicketUpdated", e => e.Int("TicketId") == walkIn.TicketId);

        var voidedTicket = await TicketAsync(walkIn.TicketId);
        Assert.Equal("Voided", voidedTicket.Status);
        Assert.Equal("walked away", voidedTicket.VoidReason);
        Assert.Contains((await Cashier.HistoryAsync(status: 2, Ct)).Items, t => t.Id == walkIn.TicketId);

        // Nobody was on that bill, so nobody loses points; nothing for Finance either.
        await Task.Delay(TimeSpan.FromSeconds(2), Ct);
        Assert.Equal(pointsBeforeVoid, (await Owner.LoyaltyAsync(Customer.UserId, Ct))!.PointsBalance);
        Assert.Equal(refundAmount, (await Owner.ProfitAsync(month.Year, month.Month, Ct)).Since(profitBefore).Refunds);

        App.Logs.AssertNoHandlerFailures(Checkpoint.Logs);
        AssertSameBusinessDay();
    }
}
