namespace Chillax.Sales.UnitTests.Domain;

using Chillax.Sales.Domain.AggregatesModel.TicketAggregate;
using Chillax.Sales.Domain.Events;
using Chillax.Sales.Domain.Exceptions;
using Chillax.Sales.Domain.SeedWork;

[TestClass]
public class TicketAggregateTest
{
    [TestMethod]
    public void Appending_an_order_is_idempotent_by_order_id()
    {
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3"), branchId: 1);

        ticket.AppendOrder(41, [Line("Latte", 2, 50)], loyaltyDiscount: 0);
        ticket.AppendOrder(41, [Line("Latte", 2, 50)], loyaltyDiscount: 0);

        Assert.AreEqual(1, ticket.Lines.Count);
        Assert.AreEqual(100m, ticket.GetSubtotal());
    }

    [TestMethod]
    public void Loyalty_discount_lands_as_its_own_negative_line()
    {
        var ticket = Ticket.OpenForCounter(branchId: 1);

        ticket.AppendOrder(41, [Line("Latte", 2, 50)], loyaltyDiscount: 25);

        Assert.AreEqual(2, ticket.Lines.Count);
        Assert.AreEqual(75m, ticket.GetSubtotal());
    }

    [TestMethod]
    public void Session_time_lands_exactly_once_and_skips_empty_modes()
    {
        var ticket = Ticket.OpenForSession(7, 2, new LocalizedText("VIP"), branchId: 1);

        ticket.AppendSessionTime(singleHours: 2.5m, singleCost: 125, multiHours: 0, multiCost: 0);
        ticket.AppendSessionTime(singleHours: 2.5m, singleCost: 125, multiHours: 0, multiCost: 0);

        Assert.AreEqual(1, ticket.Lines.Count);
        Assert.AreEqual(125m, ticket.GetSubtotal());
        Assert.AreEqual(2.5m, ticket.Lines.First().Qty);
    }

    [TestMethod]
    public void Session_time_is_the_room_s_not_anyone_s()
    {
        var ticket = Ticket.OpenForSession(7, 2, new LocalizedText("VIP"), branchId: 1);

        ticket.AppendSessionTime(singleHours: 2m, singleCost: 100, multiHours: 0, multiCost: 0);

        // Even a room opened for somebody: the time is nobody's share until
        // the group splits it at settle
        var time = ticket.Lines.Single();
        Assert.IsNull(time.CustomerId);
        Assert.IsNull(time.CustomerName);
    }

    [TestMethod]
    public void A_counter_tab_is_named_not_owned()
    {
        var ticket = Ticket.OpenForCounter(branchId: 1, label: "  Sara ");

        Assert.AreEqual("Sara", ticket.Label);
        Assert.IsNull(Ticket.OpenForCounter(branchId: 1, label: " ").Label);
    }

    [TestMethod]
    public void Service_and_vat_price_the_bill_and_freeze_at_settle()
    {
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3"), branchId: 1);
        ticket.AppendOrder(41, [Line("Latte", 2, 50)], 0);
        var rules = new PricingRules(vatRate: 0.14m, pricesIncludeVat: false, serviceChargeRate: 0.12m);

        var bill = ticket.GetBill(rules);

        // 100 + 12% service = 112, + 14% VAT on that = 127.68
        Assert.AreEqual(100m, bill.Subtotal);
        Assert.AreEqual(12m, bill.ServiceCharge);
        Assert.AreEqual(15.68m, bill.Vat);
        Assert.AreEqual(127.68m, bill.Total);

        ticket.Settle([new Payment(PaymentTender.Cash, 130, "cashier")], "cashier", rules: rules);

        Assert.AreEqual(127.68m, ticket.Total);
        Assert.AreEqual(2.32m, ticket.ChangeGiven);
        // The rules moving later never move the receipt
        Assert.AreEqual(127.68m, ticket.GetBill(PricingRules.None).Total);
    }

    [TestMethod]
    public void Vat_inside_the_price_is_shown_not_added_and_a_counter_sale_is_not_served()
    {
        var ticket = TicketWith(total: 114);

        var bill = ticket.GetBill(new PricingRules(0.14m, pricesIncludeVat: true, serviceChargeRate: 0.12m));

        Assert.AreEqual(114m, bill.Total);
        Assert.AreEqual(14m, bill.Vat);
        Assert.AreEqual(0m, bill.ServiceCharge);
    }

    [TestMethod]
    public void Room_time_carries_no_service_charge()
    {
        var ticket = Ticket.OpenForSession(7, 2, new LocalizedText("VIP"), branchId: 1);
        ticket.AppendSessionTime(singleHours: 2m, singleCost: 100, multiHours: 0, multiCost: 0);
        ticket.AppendOrder(41, [Line("Latte", 1, 50)], 0);

        var bill = ticket.GetBill(new PricingRules(0m, true, 0.10m));

        Assert.AreEqual(5m, bill.ServiceCharge);
        Assert.AreEqual(155m, bill.Total);
    }

    [TestMethod]
    public void A_refund_gives_back_what_was_paid_for_the_line_and_never_more_than_the_receipt()
    {
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3"), branchId: 1);
        ticket.AppendOrder(41, [Line("Latte", 2, 50)], 0);
        ticket.Settle([new Payment(PaymentTender.Cash, 200, "cashier")], "cashier", rules: new PricingRules(0.14m, false, 0.12m));
        var lineId = ticket.Lines.Single().Id;

        // One of the two lattes: half the line's paid value, service and VAT included
        var first = Refund.Issue(1, ticket, 9, [], [new RefundRequestLine(lineId, 1)], "Cold", PaymentTender.Cash, null, null, "owner", null);
        Assert.AreEqual(63.84m, first.Amount);

        // The other: exactly what is left of the receipt — and then nothing more
        var second = Refund.Issue(2, ticket, 9, [first], [new RefundRequestLine(lineId, 1)], "Cold too", PaymentTender.Cash, null, null, "owner", null);
        Assert.AreEqual(63.84m, second.Amount);
        Assert.ThrowsExactly<SalesDomainException>(() =>
            Refund.Issue(3, ticket, 9, [first, second], [new RefundRequestLine(lineId, 1)], "Again", PaymentTender.Cash, null, null, "owner", null));
    }

    [TestMethod]
    public void A_refund_needs_a_settled_ticket_a_reason_and_a_tab_for_account_credit()
    {
        var open = TicketWith(total: 100);
        Assert.ThrowsExactly<SalesDomainException>(() =>
            Refund.Issue(1, open, 1, [], [new RefundRequestLine(0, 1)], "Wrong item", PaymentTender.Cash, null, null, "owner", null));

        var settled = TicketWith(total: 100);
        settled.Settle([new Payment(PaymentTender.Cash, 100, "cashier")], "cashier");
        var lineId = settled.Lines.Single().Id;
        Assert.ThrowsExactly<SalesDomainException>(() =>
            Refund.Issue(1, settled, 1, [], [new RefundRequestLine(lineId, 1)], " ", PaymentTender.Cash, null, null, "owner", null));
        Assert.ThrowsExactly<SalesDomainException>(() =>
            Refund.Issue(1, settled, 1, [], [new RefundRequestLine(lineId, 1)], "Wrong item", PaymentTender.Account, null, null, "owner", null));

        // Points come back per order in proportion to what came back
        var refund = Refund.Issue(1, settled, 1, [], [new RefundRequestLine(lineId, 1)], "Wrong item", PaymentTender.Cash, null, null, "owner", null);
        var (orderId, refunded) = refund.RefundedByOrder().Single();
        Assert.AreEqual(1, orderId);
        Assert.AreEqual(100m, refunded);
    }

    [TestMethod]
    public void Settle_requires_payments_to_cover_the_total()
    {
        var ticket = TicketWith(total: 100);

        Assert.ThrowsExactly<SalesDomainException>(() =>
            ticket.Settle([new Payment(PaymentTender.Cash, 60, "cashier")], "cashier"));
    }

    [TestMethod]
    public void Cash_overpayment_is_returned_as_change()
    {
        var ticket = TicketWith(total: 100);

        var change = ticket.Settle([new Payment(PaymentTender.Cash, 150, "cashier")], "cashier");

        Assert.AreEqual(50m, change);
        Assert.AreEqual(TicketStatus.Settled, ticket.Status);
    }

    [TestMethod]
    public void Card_payments_cannot_overpay()
    {
        var ticket = TicketWith(total: 100);

        Assert.ThrowsExactly<SalesDomainException>(() =>
            ticket.Settle([new Payment(PaymentTender.Card, 150, "cashier")], "cashier"));
    }

    [TestMethod]
    public void Split_payment_settles_when_the_parts_cover_the_total()
    {
        var ticket = TicketWith(total: 100);

        var change = ticket.Settle(
            [new Payment(PaymentTender.Card, 60, "cashier"), new Payment(PaymentTender.Cash, 40, "cashier")],
            "cashier");

        Assert.AreEqual(0m, change);
        Assert.AreEqual(2, ticket.Payments.Count);
    }

    [TestMethod]
    public void A_settled_ticket_is_frozen()
    {
        var ticket = TicketWith(total: 100);
        ticket.Settle([new Payment(PaymentTender.Cash, 100, "cashier")], "cashier");

        Assert.ThrowsExactly<SalesDomainException>(() =>
            ticket.AddManualLine(new LocalizedText("Extra"), 1, 10, 0, "cashier"));
        Assert.ThrowsExactly<SalesDomainException>(() =>
            ticket.AppendOrder(99, [Line("Latte", 1, 50)], 0));
    }

    [TestMethod]
    public void An_empty_ticket_cannot_be_settled()
    {
        var ticket = Ticket.OpenForCounter(branchId: 1);

        Assert.ThrowsExactly<SalesDomainException>(() =>
            ticket.Settle([new Payment(PaymentTender.Cash, 10, "cashier")], "cashier"));
    }

    [TestMethod]
    public void Room_tickets_cannot_be_split_by_moving_lines()
    {
        var ticket = Ticket.OpenForSession(7, 2, new LocalizedText("VIP"), branchId: 1);
        ticket.AppendOrder(41, [Line("Latte", 1, 50), Line("Mocha", 1, 60)], 0);

        Assert.ThrowsExactly<SalesDomainException>(() => ticket.MoveLines([1]));
    }

    [TestMethod]
    public void Lines_move_onto_another_open_ticket_and_may_empty_the_source()
    {
        var table = Ticket.OpenForTable(1, new LocalizedText("Table 1"), branchId: 1);
        table.AppendOrder(41, [Line("Latte", 1, 50), Line("Mocha", 1, 60)], 0);
        var room = Ticket.OpenForSession(7, 2, new LocalizedText("VIP"), branchId: 1);

        // The customer ordered at the table, then took the room
        table.MoveLinesTo(room, table.Lines.Select(l => l.Id).ToList());

        Assert.AreEqual(0, table.Lines.Count);
        Assert.AreEqual(2, room.Lines.Count);
        Assert.AreEqual(110m, room.GetSubtotal());
    }

    [TestMethod]
    public void Session_time_never_leaves_its_ticket()
    {
        var room = Ticket.OpenForSession(7, 2, new LocalizedText("VIP"), branchId: 1);
        room.AppendSessionTime(singleHours: 1m, singleCost: 50, multiHours: 0, multiCost: 0);
        var counter = Ticket.OpenForCounter(branchId: 1);

        Assert.ThrowsExactly<SalesDomainException>(() =>
            room.MoveLinesTo(counter, room.Lines.Select(l => l.Id).ToList()));
    }

    [TestMethod]
    public void Lines_only_move_within_a_branch_and_onto_open_tickets()
    {
        var source = TicketWith(total: 100);
        var otherBranch = Ticket.OpenForCounter(branchId: 2);
        var settled = TicketWith(total: 50);
        settled.Settle([new Payment(PaymentTender.Cash, 50, "cashier")], "cashier");
        var ids = source.Lines.Select(l => l.Id).ToList();

        Assert.ThrowsExactly<SalesDomainException>(() => source.MoveLinesTo(otherBranch, ids));
        Assert.ThrowsExactly<SalesDomainException>(() => source.MoveLinesTo(settled, ids));
        Assert.ThrowsExactly<SalesDomainException>(() => source.MoveLinesTo(source, ids));
        Assert.AreEqual(1, source.Lines.Count);
    }

    [TestMethod]
    public void Voiding_needs_a_reason_and_freezes_the_ticket()
    {
        var ticket = TicketWith(total: 100);

        Assert.ThrowsExactly<SalesDomainException>(() => ticket.Void(" ", "owner"));

        ticket.Void("Rang up the wrong table", "owner");

        Assert.AreEqual(TicketStatus.Voided, ticket.Status);
        Assert.AreEqual("Rang up the wrong table", ticket.VoidReason);
        Assert.ThrowsExactly<SalesDomainException>(() =>
            ticket.AddManualLine(new LocalizedText("Extra"), 1, 10, 0, "cashier"));
    }

    [TestMethod]
    public void Voiding_raises_the_voided_event_and_prices_each_order_by_its_lines_here()
    {
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3"), branchId: 1);
        ticket.AppendOrder(41, [Line("Latte", 2, 50)], loyaltyDiscount: 25);
        ticket.AppendOrder(42, [Line("Tea", 1, 30)], loyaltyDiscount: 0);
        ticket.AddManualLine(new LocalizedText("Extra"), 1, 10, 0, "cashier");
        ticket.ClearDomainEvents();

        ticket.Void("Rang up the wrong table", "owner");

        // Loyalty hears of it once, alongside the floor nudge
        var raised = ticket.DomainEvents!.OfType<TicketVoidedDomainEvent>().Single();
        Assert.AreSame(ticket, raised.Ticket);
        Assert.AreEqual(1, ticket.DomainEvents!.OfType<TicketChangedDomainEvent>().Count());

        // Menu money per order, the discount line included; the manual line earned nothing
        var byOrder = ticket.GetAmountByOrder();
        Assert.AreEqual(2, byOrder.Count);
        Assert.AreEqual(75m, byOrder[41]);
        Assert.AreEqual(30m, byOrder[42]);
    }

    [TestMethod]
    public void A_settled_ticket_cannot_be_voided()
    {
        var ticket = TicketWith(total: 100);
        ticket.Settle([new Payment(PaymentTender.Cash, 100, "cashier")], "cashier");

        // Money was taken — undoing that is a refund, not a void
        Assert.ThrowsExactly<SalesDomainException>(() => ticket.Void("mistake", "owner"));
    }

    [TestMethod]
    public void An_empty_ticket_can_be_discarded_and_still_nudges_the_floor()
    {
        var ticket = Ticket.OpenForCounter(branchId: 1);
        ticket.ClearDomainEvents();

        ticket.Discard();

        // No tombstone: the row goes, and the only trace is the floor refetch
        Assert.AreEqual(TicketStatus.Open, ticket.Status);
        Assert.AreEqual(1, ticket.DomainEvents!.OfType<TicketChangedDomainEvent>().Count());
    }

    [TestMethod]
    public void A_ticket_with_lines_cannot_be_discarded()
    {
        var ticket = TicketWith(total: 100);

        // Something happened on it — that is what a void's reason is for
        Assert.ThrowsExactly<SalesDomainException>(() => ticket.Discard());
    }

    [TestMethod]
    public void Room_tickets_cannot_be_discarded()
    {
        // Empty only because the session is still running: its time lands at the end
        var ticket = Ticket.OpenForSession(7, 2, new LocalizedText("VIP"), branchId: 1);

        Assert.ThrowsExactly<SalesDomainException>(() => ticket.Discard());
    }

    [TestMethod]
    public void A_cancelled_session_drops_its_empty_room_ticket()
    {
        var ticket = Ticket.OpenForSession(7, 2, new LocalizedText("VIP"), branchId: 1);
        ticket.ClearDomainEvents();

        ticket.DiscardForCancelledSession();

        Assert.AreEqual(1, ticket.DomainEvents!.OfType<TicketChangedDomainEvent>().Count());
    }

    [TestMethod]
    public void A_cancelled_session_keeps_a_room_ticket_that_already_has_lines()
    {
        var ticket = Ticket.OpenForSession(7, 2, new LocalizedText("VIP"), branchId: 1);
        ticket.AppendOrder(41, [Line("Latte", 1, 50)], 0);

        // Orders were served: somebody settles or voids this, nobody loses it
        Assert.ThrowsExactly<SalesDomainException>(() => ticket.DiscardForCancelledSession());
    }

    [TestMethod]
    public void A_voided_ticket_cannot_be_discarded()
    {
        var ticket = Ticket.OpenForCounter(branchId: 1);
        ticket.Void("opened twice", "owner");

        // The void is on record now; deleting it would erase that record
        Assert.ThrowsExactly<SalesDomainException>(() => ticket.Discard());
    }

    [TestMethod]
    public void Settle_records_the_shift_and_the_change_given()
    {
        var ticket = TicketWith(total: 100);

        ticket.Settle([new Payment(PaymentTender.Cash, 150, "cashier")], "cashier", shiftId: 7);

        Assert.AreEqual(7, ticket.ShiftId);
        Assert.AreEqual(50m, ticket.ChangeGiven);
    }

    [TestMethod]
    public void Settling_without_an_open_shift_goes_unattributed()
    {
        var ticket = TicketWith(total: 100);

        ticket.Settle([new Payment(PaymentTender.Cash, 100, "cashier")], "cashier");

        Assert.IsNull(ticket.ShiftId);
    }

    [TestMethod]
    public void Account_tender_must_name_the_tab_it_charges()
    {
        // The ticket it sits on is irrelevant: a charge lands on one account
        // holder, and a payment that names nobody has no tab to charge
        Assert.ThrowsExactly<SalesDomainException>(() =>
            new Payment(PaymentTender.Account, 100, "cashier"));
    }

    [TestMethod]
    public void Account_tender_settles_against_the_payment_s_own_customer()
    {
        var ticket = Ticket.OpenForCounter(branchId: 1, label: "Nadia");
        ticket.AppendOrder(1, [Line("Item", 1, 100)], 0);

        var change = ticket.Settle(
            [
                new Payment(PaymentTender.Account, 60, "cashier", "u1", "Nadia"),
                new Payment(PaymentTender.Cash, 40, "cashier"),
            ],
            "cashier");

        Assert.AreEqual(0m, change);
        Assert.AreEqual(TicketStatus.Settled, ticket.Status);
    }

    [TestMethod]
    public void A_shared_bill_can_charge_several_tabs()
    {
        // Ahmed's share on his tab, Sara's on hers, the rest in cash — one
        // ticket, one receipt, two accounts
        var ticket = TicketWith(total: 160);

        var change = ticket.Settle(
            [
                new Payment(PaymentTender.Account, 60, "cashier", "u-ahmed", "Ahmed"),
                new Payment(PaymentTender.Account, 35, "cashier", "u-sara", "Sara"),
                new Payment(PaymentTender.Cash, 65, "cashier"),
            ],
            "cashier");

        Assert.AreEqual(0m, change);
        Assert.AreEqual(TicketStatus.Settled, ticket.Status);
        CollectionAssert.AreEquivalent(
            new[] { "u-ahmed", "u-sara" },
            ticket.Payments
                .Where(p => p.Tender == PaymentTender.Account)
                .Select(p => p.CustomerId)
                .ToArray());
    }

    [TestMethod]
    public void Non_cash_tenders_can_never_exceed_the_total()
    {
        // Account 150 + cash 10 on a 100 ticket would hand back 60 "change"
        // paid for out of the customer's own tab
        var ticket = Ticket.OpenForCounter(branchId: 1, label: "Nadia");
        ticket.AppendOrder(1, [Line("Item", 1, 100)], 0);

        Assert.ThrowsExactly<SalesDomainException>(() =>
            ticket.Settle(
                [new Payment(PaymentTender.Account, 150, "cashier", "u1", "Nadia"), new Payment(PaymentTender.Cash, 10, "cashier")],
                "cashier"));
    }

    [TestMethod]
    public void Assigning_a_customer_after_the_fact_retags_only_that_order_s_lines()
    {
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3"), branchId: 1);
        ticket.AppendOrder(41, [Line("Latte", 1, 50)], 0);
        ticket.AppendOrder(42, [Line("Tea", 1, 20)], 0);
        ticket.ClearDomainEvents();

        ticket.AssignOrderCustomer(41, "u1", " Nadia ");

        var latte = ticket.Lines.Single(l => l.OrderId == 41);
        Assert.AreEqual("u1", latte.CustomerId);
        Assert.AreEqual("Nadia", latte.CustomerName);
        Assert.IsNull(ticket.Lines.Single(l => l.OrderId == 42).CustomerName);
        // The open ticket screen and the floor refetch, though nothing landed
        Assert.AreEqual(1, ticket.DomainEvents!.OfType<TicketChangedDomainEvent>().Count());
    }

    [TestMethod]
    public void A_customer_is_not_assigned_on_a_frozen_ticket_or_to_an_order_that_is_not_there()
    {
        var open = TicketWith(total: 100);
        Assert.ThrowsExactly<SalesDomainException>(() => open.AssignOrderCustomer(99, null, "Nadia"));

        // The receipt is printed; who it was for stays as it was settled
        var settled = TicketWith(total: 100);
        settled.Settle([new Payment(PaymentTender.Cash, 100, "cashier")], "cashier");
        Assert.ThrowsExactly<SalesDomainException>(() => settled.AssignOrderCustomer(1, null, "Nadia"));
        Assert.IsNull(settled.Lines.Single().CustomerName);
    }

    [TestMethod]
    public void Room_ticket_cannot_be_voided_or_settled_while_its_session_runs()
    {
        var running = Ticket.OpenForSession(7, 2, new LocalizedText("VIP"), branchId: 1);

        Assert.ThrowsExactly<SalesDomainException>(() => running.Void("wrong room", "owner"));

        // Cancelled with lines: no time will ever land, so the owner may void it
        running.MarkSessionCancelled();
        running.Void("wrong room", "owner");
        Assert.AreEqual(TicketStatus.Voided, running.Status);

        // Ended normally: the time landed, so the bill can go
        var ended = Ticket.OpenForSession(8, 2, new LocalizedText("VIP"), branchId: 1);
        ended.AppendSessionTime(singleHours: 1m, singleCost: 50, multiHours: 0, multiCost: 0);
        ended.Void("comp", "owner");
        Assert.AreEqual(TicketStatus.Voided, ended.Status);
    }

    [TestMethod]
    public void Naming_a_customer_on_chosen_lines_sets_only_their_snapshot()
    {
        var ticket = Ticket.OpenForCounter(branchId: 1);
        ticket.AppendOrder(1, [Line("Latte", 1, 60)], 0);
        var lineId = ticket.Lines.Single().Id;

        ticket.AssignLinesCustomer([lineId], "u1", "Nadia");

        Assert.AreEqual("Nadia", ticket.Lines.Single().CustomerName);
        Assert.AreEqual("u1", ticket.Lines.Single().CustomerId);

        // A line that is not on the ticket, and session time, are both refused
        Assert.ThrowsExactly<SalesDomainException>(() => ticket.AssignLinesCustomer([lineId, 99], "u1", "Nadia"));

        var room = Ticket.OpenForSession(7, 2, new LocalizedText("VIP"), branchId: 1);
        room.AppendSessionTime(singleHours: 1m, singleCost: 50, multiHours: 0, multiCost: 0);
        Assert.ThrowsExactly<SalesDomainException>(() =>
            room.AssignLinesCustomer([room.Lines.Single().Id], "u2", "Omar"));
    }

    [TestMethod]
    public void Room_ticket_is_discardable_only_after_its_session_ends_empty()
    {
        var running = Ticket.OpenForSession(7, 2, new LocalizedText("VIP"), branchId: 1);

        // While the session runs, no: its time is still to come
        Assert.ThrowsExactly<SalesDomainException>(() => running.Discard());

        // Ended with zero time and no orders — nothing landed, so it goes
        running.AppendSessionTime(singleHours: 0, singleCost: 0, multiHours: 0, multiCost: 0);
        running.Discard();

        // But an ended room ticket that carried time cannot be discarded
        var withTime = Ticket.OpenForSession(8, 2, new LocalizedText("VIP"), branchId: 1);
        withTime.AppendSessionTime(singleHours: 1m, singleCost: 50, multiHours: 0, multiCost: 0);
        Assert.ThrowsExactly<SalesDomainException>(() => withTime.Discard());
    }

    private static TicketLine Line(string name, int qty, decimal unitPrice)
        => new(TicketLineSource.Order, new LocalizedText(name), qty, unitPrice, orderId: null);

    private static Ticket TicketWith(decimal total)
    {
        var ticket = Ticket.OpenForCounter(branchId: 1);
        ticket.AppendOrder(1, [Line("Item", 1, total)], 0);
        return ticket;
    }
}
