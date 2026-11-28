namespace Ninja.Sales.UnitTests.Domain;

using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Ninja.Sales.API.Application.DomainEventHandlers;
using Ninja.Sales.API.Application.IntegrationEvents;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.Domain.AggregatesModel.TicketAggregate;
using Ninja.Sales.Domain.Events;
using Ninja.Sales.Domain.Exceptions;
using Ninja.Sales.Domain.SeedWork;

[TestClass]
public class TicketAggregateTest
{
    [TestMethod]
    public void Appending_an_order_is_idempotent_by_order_id()
    {
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3", null), branchId: 1);

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
    public void A_promo_code_lands_as_its_own_negative_line_named_after_the_code()
    {
        var ticket = Ticket.OpenForCounter(branchId: 1);

        ticket.AppendOrder(41, [Line("Latte", 2, 50)], loyaltyDiscount: 0, promoCode: "SUMMER-10", promoDiscount: 10);

        Assert.AreEqual(2, ticket.Lines.Count);
        Assert.AreEqual(90m, ticket.GetSubtotal());
        var promoLine = ticket.Lines.Last();
        Assert.AreEqual("Promo SUMMER-10", promoLine.Description.En);
        Assert.AreEqual(41, promoLine.OrderId);
    }

    [TestMethod]
    public void Session_time_lands_exactly_once_and_skips_empty_options()
    {
        var ticket = Ticket.OpenForSession(7, 2, new LocalizedText("VIP", null), branchId: 1);

        ticket.AppendSessionTime([Time(2.5m, 125), Time(0, 0, "Multi")]);
        ticket.AppendSessionTime([Time(2.5m, 125), Time(0, 0, "Multi")]);

        Assert.AreEqual(1, ticket.Lines.Count);
        Assert.AreEqual(125m, ticket.GetSubtotal());
        Assert.AreEqual(2.5m, ticket.Lines.First().Qty);
    }

    [TestMethod]
    public void Session_time_is_the_room_s_not_anyone_s()
    {
        var ticket = Ticket.OpenForSession(7, 2, new LocalizedText("VIP", null), branchId: 1);

        ticket.AppendSessionTime([Time(2m, 100)]);

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
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3", null), branchId: 1);
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
    public void Session_time_carries_no_service_charge()
    {
        var ticket = Ticket.OpenForSession(7, 2, new LocalizedText("VIP", null), branchId: 1);
        ticket.AppendSessionTime([Time(2m, 100)]);
        ticket.AppendOrder(41, [Line("Latte", 1, 50)], 0);

        var bill = ticket.GetBill(new PricingRules(0m, true, 0.10m));

        Assert.AreEqual(5m, bill.ServiceCharge);
        Assert.AreEqual(155m, bill.Total);
    }

    [TestMethod]
    public void A_refund_gives_back_what_was_paid_for_the_line_and_never_more_than_the_receipt()
    {
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3", null), branchId: 1);
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
            ticket.AddManualLine(new LocalizedText("Extra", null), 1, 10, 0, "cashier"));
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
    public void Session_tickets_cannot_be_split_by_moving_lines()
    {
        var ticket = Ticket.OpenForSession(7, 2, new LocalizedText("VIP", null), branchId: 1);
        ticket.AppendOrder(41, [Line("Latte", 1, 50), Line("Mocha", 1, 60)], 0);

        Assert.ThrowsExactly<SalesDomainException>(() => ticket.MoveLines([1]));
    }

    [TestMethod]
    public void Lines_move_onto_another_open_ticket_and_may_empty_the_source()
    {
        var table = Ticket.OpenForTable(1, new LocalizedText("Table 1", null), branchId: 1);
        table.AppendOrder(41, [Line("Latte", 1, 50), Line("Mocha", 1, 60)], 0);
        var room = Ticket.OpenForSession(7, 2, new LocalizedText("VIP", null), branchId: 1);

        // The customer ordered at the table, then took the room
        table.MoveLinesTo(room, table.Lines.Select(l => l.Id).ToList());

        Assert.AreEqual(0, table.Lines.Count);
        Assert.AreEqual(2, room.Lines.Count);
        Assert.AreEqual(110m, room.GetSubtotal());
    }

    [TestMethod]
    public void A_customer_whose_lines_move_onto_a_rooms_bill_is_told_to_the_room()
    {
        var counter = Ticket.OpenForCounter(branchId: 1);
        counter.AppendOrder(41, [Line("Latte", 1, 50)], 0);
        var ids = counter.Lines.Select(l => l.Id).ToList();
        counter.AssignLinesCustomer(ids, "u-ahmed", "Ahmed Hassan");
        var room = Ticket.OpenForSession(7, 2, new LocalizedText("VIP", null), branchId: 1);
        room.ClearDomainEvents();

        counter.MoveLinesTo(room, ids);

        var moved = room.DomainEvents!.OfType<CustomersMovedToSessionDomainEvent>().Single();
        Assert.AreEqual(7, moved.Ticket.SessionId);
        Assert.AreEqual("u-ahmed", moved.Customers.Single().CustomerId);
        Assert.AreEqual("Ahmed Hassan", moved.Customers.Single().CustomerName);
    }

    [TestMethod]
    public void Lines_moved_to_a_table_or_with_no_customer_tell_no_room()
    {
        var counter = Ticket.OpenForCounter(branchId: 1);
        counter.AppendOrder(41, [Line("Latte", 1, 50)], 0);
        var ids = counter.Lines.Select(l => l.Id).ToList();
        var room = Ticket.OpenForSession(7, 2, new LocalizedText("VIP", null), branchId: 1);
        counter.MoveLinesTo(room, ids);
        Assert.IsFalse(room.DomainEvents!.OfType<CustomersMovedToSessionDomainEvent>().Any());

        room.AssignLinesCustomer(ids, "u-ahmed", "Ahmed Hassan");
        var table = Ticket.OpenForTable(1, new LocalizedText("Table 1", null), branchId: 1);
        room.MoveLinesTo(table, ids);
        Assert.IsFalse(table.DomainEvents!.OfType<CustomersMovedToSessionDomainEvent>().Any());
    }

    [TestMethod]
    public void Session_time_never_leaves_its_ticket()
    {
        var room = Ticket.OpenForSession(7, 2, new LocalizedText("VIP", null), branchId: 1);
        room.AppendSessionTime([Time(1m, 50)]);
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
            ticket.AddManualLine(new LocalizedText("Extra", null), 1, 10, 0, "cashier"));
    }

    [TestMethod]
    public void Voiding_raises_the_voided_event_and_prices_each_order_by_its_lines_here()
    {
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3", null), branchId: 1);
        ticket.AppendOrder(41, [Line("Latte", 2, 50)], loyaltyDiscount: 25);
        ticket.AppendOrder(42, [Line("Tea", 1, 30)], loyaltyDiscount: 0);
        ticket.AddManualLine(new LocalizedText("Extra", null), 1, 10, 0, "cashier");
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
        Assert.IsNull(raised.StockDisposition, "the cashier said nothing of the food: Ordering decides");
    }

    [TestMethod]
    public async Task A_void_tells_Ordering_what_the_cashier_said_becomes_of_the_food()
    {
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3", null), branchId: 1);
        ticket.AppendOrder(41, [Line("Latte", 2, 50)], loyaltyDiscount: 0);
        ticket.ClearDomainEvents();

        ticket.Void("Walked out", "owner", "Waste");

        var raised = ticket.DomainEvents!.OfType<TicketVoidedDomainEvent>().Single();
        Assert.AreEqual("Waste", raised.StockDisposition);

        var outbox = Substitute.For<ISalesIntegrationEventService>();
        await new TicketVoidedDomainEventHandler(outbox, NullLogger<TicketVoidedDomainEventHandler>.Instance)
            .Handle(raised, CancellationToken.None);

        await outbox.Received(1).AddAndSaveEventAsync(Arg.Is<TicketVoidedIntegrationEvent>(e =>
            e.StockDisposition == "Waste" && e.OrderReversals.Single().OrderId == 41));
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
    public void Session_tickets_cannot_be_discarded_while_the_clock_runs()
    {
        // Empty only because the session is still running: its time lands at the end
        var ticket = Ticket.OpenForSession(7, 2, new LocalizedText("VIP", null), branchId: 1);

        Assert.ThrowsExactly<SalesDomainException>(() => ticket.Discard());
    }

    [TestMethod]
    public void A_cancelled_session_drops_its_empty_ticket()
    {
        var ticket = Ticket.OpenForSession(7, 2, new LocalizedText("VIP", null), branchId: 1);
        ticket.ClearDomainEvents();

        ticket.DiscardForCancelledSession();

        Assert.AreEqual(1, ticket.DomainEvents!.OfType<TicketChangedDomainEvent>().Count());
    }

    [TestMethod]
    public void A_cancelled_session_keeps_a_ticket_that_already_has_lines()
    {
        var ticket = Ticket.OpenForSession(7, 2, new LocalizedText("VIP", null), branchId: 1);
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
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3", null), branchId: 1);
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
    public void Session_ticket_cannot_be_voided_or_settled_while_its_session_runs()
    {
        var running = Ticket.OpenForSession(7, 2, new LocalizedText("VIP", null), branchId: 1);

        Assert.ThrowsExactly<SalesDomainException>(() => running.Void("wrong room", "owner"));

        // Cancelled with lines: no time will ever land, so the owner may void it
        running.MarkSessionCancelled();
        running.Void("wrong room", "owner");
        Assert.AreEqual(TicketStatus.Voided, running.Status);

        // Ended normally: the time landed, so the bill can go
        var ended = Ticket.OpenForSession(8, 2, new LocalizedText("VIP", null), branchId: 1);
        ended.AppendSessionTime([Time(1m, 50)]);
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

        var room = Ticket.OpenForSession(7, 2, new LocalizedText("VIP", null), branchId: 1);
        room.AppendSessionTime([Time(1m, 50)]);
        Assert.ThrowsExactly<SalesDomainException>(() =>
            room.AssignLinesCustomer([room.Lines.Single().Id], "u2", "Omar"));
    }

    [TestMethod]
    public void Session_ticket_is_discardable_only_after_its_session_ends_empty()
    {
        var running = Ticket.OpenForSession(7, 2, new LocalizedText("VIP", null), branchId: 1);

        // While the session runs, no: its time is still to come
        Assert.ThrowsExactly<SalesDomainException>(() => running.Discard());

        // Ended with zero time and no orders — nothing landed, so it goes
        running.AppendSessionTime([Time(0, 0)]);
        running.Discard();

        // But an ended room ticket that carried time cannot be discarded
        var withTime = Ticket.OpenForSession(8, 2, new LocalizedText("VIP", null), branchId: 1);
        withTime.AppendSessionTime([Time(1m, 50)]);
        Assert.ThrowsExactly<SalesDomainException>(() => withTime.Discard());
    }

    [TestMethod]
    public void Time_lines_are_named_after_the_place_and_its_option()
    {
        var room = Ticket.OpenForSession(7, 4, new LocalizedText("Room 4", "اوضة ٤"), branchId: 1);
        room.AppendSessionTime([
            new SessionTimeLine(new LocalizedText("Single", "سنجل"), 0.75m, 45m),
            new SessionTimeLine(new LocalizedText("Multi", "ملتي"), 1.75m, 157.5m),
        ]);

        Assert.AreEqual(2, room.Lines.Count);
        Assert.AreEqual("Room 4 time — Single", room.Lines.First().Description.En);
        Assert.AreEqual("وقت اوضة ٤ — سنجل", room.Lines.First().Description.Ar);
        Assert.AreEqual("Room 4 time — Multi", room.Lines.Last().Description.En);
        Assert.AreEqual(60m, room.Lines.First().UnitPrice);
        Assert.AreEqual(202.5m, room.GetSubtotal());

        // One option: no dash, nothing to tell apart
        var table = Ticket.OpenForSession(8, 51, new LocalizedText("Table 4", "ترابيزة ٤"), branchId: 1, placeKind: "Table");
        table.AppendSessionTime([new SessionTimeLine(new LocalizedText("Standard", "عادي"), 1m, 40m)]);

        Assert.AreEqual("Table 4 time", table.Lines.Single().Description.En);
        Assert.AreEqual("وقت ترابيزة ٤", table.Lines.Single().Description.Ar);
    }

    [TestMethod]
    public void A_timed_table_follows_its_session_like_a_room()
    {
        var table = Ticket.OpenForSession(8, 51, new LocalizedText("Table 4", null), branchId: 1, placeKind: "Table");

        Assert.AreEqual(TicketType.Table, table.Type, "the reports still group it with the tables");
        Assert.IsTrue(table.HasSession);
        Assert.AreEqual(51, table.PlaceId);

        // The session rules apply regardless of the type
        Assert.ThrowsExactly<SalesDomainException>(() => table.Discard());
        Assert.ThrowsExactly<SalesDomainException>(() => table.Void("wrong table", "owner"));
        table.AppendOrder(41, [Line("Latte", 1, 50)], 0);
        Assert.ThrowsExactly<SalesDomainException>(() => table.MoveLines([table.Lines.Single().Id]));

        table.AppendSessionTime([new SessionTimeLine(new LocalizedText("Standard", null), 1m, 40m)]);
        table.Void("comp", "owner");
        Assert.AreEqual(TicketStatus.Voided, table.Status);

        // A plain table bill has no session: it opens on its first order, at
        // the place the order named
        var plain = Ticket.OpenForTable(41, new LocalizedText("Table 3", null), branchId: 1);
        Assert.IsFalse(plain.HasSession);
        Assert.AreEqual(41, plain.PlaceId);
        Assert.AreEqual("Table", plain.PlaceKind);
    }

    // ---- Cancelling sent items off an open bill ----

    [TestMethod]
    public void Cancelling_part_of_a_line_leaves_what_is_still_sold_and_keeps_what_came_off()
    {
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3", null), branchId: 1);
        ticket.AppendOrder(41, [Item(1, "Latte", 3, 50, discount: 30), Item(2, "Tea", 1, 20)], 0);
        Assert.AreEqual(140m, ticket.GetSubtotal());

        ticket.CancelLines([new LineCancel(1, 1)], "  Changed their mind ", "owner");

        var latte = ticket.Lines.Single(l => l.Id == 1);
        Assert.AreEqual(2m, latte.Qty, "Qty is what is still sold");
        Assert.AreEqual(1m, latte.CancelledQty);
        Assert.AreEqual(3m, latte.OriginalQty);
        Assert.AreEqual(20m, latte.Discount, "the line's discount shrinks with it: 30 x 2/3");
        Assert.AreEqual(80m, latte.Total);
        Assert.AreEqual(40m, latte.CancelledAmount, "120 before, 80 after");
        Assert.AreEqual("Changed their mind", latte.CancelReason);
        Assert.AreEqual("owner", latte.CancelledBy);
        Assert.IsNotNull(latte.CancelledAt);
        Assert.AreEqual(100m, ticket.GetSubtotal());

        // The tea was not touched
        var tea = ticket.Lines.Single(l => l.Id == 2);
        Assert.AreEqual(0m, tea.CancelledQty);
        Assert.IsNull(tea.CancelReason);
    }

    [TestMethod]
    public void Cancelling_a_whole_line_keeps_it_on_the_bill_at_nothing()
    {
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3", null), branchId: 1);
        ticket.AppendOrder(41, [Item(1, "Latte", 2, 50, discount: 10), Item(2, "Tea", 1, 20)], 0);

        // The same line asked for twice is one request for the sum
        ticket.CancelLines([new LineCancel(1, 1), new LineCancel(1, 1)], "Ran out", "owner");

        var latte = ticket.Lines.Single(l => l.Id == 1);
        Assert.HasCount(2, ticket.Lines, "struck, not removed");
        Assert.AreEqual(0m, latte.Qty);
        Assert.AreEqual(0m, latte.Discount);
        Assert.AreEqual(0m, latte.Total);
        Assert.AreEqual(2m, latte.CancelledQty);
        Assert.AreEqual(90m, latte.CancelledAmount);
        Assert.AreEqual(20m, ticket.GetSubtotal());
    }

    [TestMethod]
    public void Cancelling_needs_a_reason_under_the_cap_and_a_person()
    {
        var ticket = TwoItems();

        Assert.ThrowsExactly<SalesDomainException>(() => ticket.CancelLines([new LineCancel(1, 1)], " ", "owner"));
        Assert.ThrowsExactly<SalesDomainException>(() =>
            ticket.CancelLines([new LineCancel(1, 1)], new string('x', TicketLine.CancelReasonLength + 1), "owner"));
        Assert.ThrowsExactly<SalesDomainException>(() => ticket.CancelLines([new LineCancel(1, 1)], "Cold", " "));
        Assert.ThrowsExactly<SalesDomainException>(() => ticket.CancelLines([], "Cold", "owner"));
        Assert.ThrowsExactly<SalesDomainException>(() => ticket.CancelLines([new LineCancel(99, 1)], "Cold", "owner"));

        // Exactly at the cap is kept, and nothing above changed the bill
        Assert.AreEqual(120m, ticket.GetSubtotal());
        ticket.CancelLines([new LineCancel(1, 1)], new string('x', TicketLine.CancelReasonLength), "owner");
        Assert.AreEqual(70m, ticket.GetSubtotal());
    }

    [TestMethod]
    public void Only_items_sold_can_be_cancelled_not_time_fees_or_money_off()
    {
        var ticket = Ticket.OpenForSession(7, 2, new LocalizedText("VIP", null), branchId: 1);
        ticket.AppendOrder(41, [Item(1, "Latte", 2, 50), Fee(2, 25), Item(3, "Loyalty discount", 1, -10)], 0);
        ticket.AddManualLine(new LocalizedText("Extra", null), 1, 10, 0, "cashier");
        ticket.AppendSessionTime([Time(1m, 50)]);
        var manual = ticket.Lines.Single(l => l.Source == TicketLineSource.Manual);
        var time = ticket.Lines.Single(l => l.Source == TicketLineSource.SessionTime);
        typeof(Entity).GetProperty(nameof(Entity.Id))!.SetValue(manual, 4);
        typeof(Entity).GetProperty(nameof(Entity.Id))!.SetValue(time, 5);

        Assert.ThrowsExactly<SalesDomainException>(() => ticket.CancelLines([new LineCancel(2, 1)], "No", "owner"), "delivery fee");
        Assert.ThrowsExactly<SalesDomainException>(() => ticket.CancelLines([new LineCancel(3, 1)], "No", "owner"), "money off");
        Assert.ThrowsExactly<SalesDomainException>(() => ticket.CancelLines([new LineCancel(5, 1)], "No", "owner"), "room time");

        // A manual line is a thing sold
        ticket.CancelLines([new LineCancel(4, 1)], "Rung up wrong", "owner");
        Assert.AreEqual(1m, manual.CancelledQty);
    }

    [TestMethod]
    public void More_than_is_left_or_nothing_cannot_be_cancelled()
    {
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3", null), branchId: 1);
        ticket.AppendOrder(41, [Item(1, "Latte", 2, 50), Item(2, "Tea", 3, 20)], 0);
        ticket.CancelLines([new LineCancel(1, 1)], "Cold", "owner");

        var tooMany = Assert.ThrowsExactly<SalesDomainException>(() => ticket.CancelLines([new LineCancel(1, 2)], "Cold", "owner"));
        Assert.Contains("left to cancel", tooMany.Message);
        Assert.AreEqual(1m, ticket.Lines.Single(l => l.Id == 1).Qty);
        Assert.ThrowsExactly<SalesDomainException>(() => ticket.CancelLines([new LineCancel(1, 0)], "Cold", "owner"));
        Assert.ThrowsExactly<SalesDomainException>(() => ticket.CancelLines([new LineCancel(1, -1)], "Cold", "owner"));
    }

    [TestMethod]
    public void Cancelling_everything_sold_is_a_void()
    {
        var ticket = TwoItems();

        Assert.ThrowsExactly<SalesDomainException>(() =>
            ticket.CancelLines([new LineCancel(1, 2), new LineCancel(2, 1)], "Left", "owner"));

        // One at a time comes to the same thing
        ticket.CancelLines([new LineCancel(1, 2)], "Left", "owner");
        var refused = Assert.ThrowsExactly<SalesDomainException>(() => ticket.CancelLines([new LineCancel(2, 1)], "Left", "owner"));
        Assert.Contains("void the bill instead", refused.Message);
        Assert.AreEqual(20m, ticket.GetSubtotal());
    }

    [TestMethod]
    public void A_cancel_never_leaves_the_bill_worth_less_than_nothing()
    {
        // 70 of items, 60 off in points: the latte going would leave -40
        var ticket = Ticket.OpenForCounter(branchId: 1);
        ticket.AppendOrder(41, [Item(1, "Latte", 1, 50), Item(2, "Tea", 1, 20), Item(3, "Loyalty discount", 1, -60)], 0);

        var refused = Assert.ThrowsExactly<SalesDomainException>(() => ticket.CancelLines([new LineCancel(1, 1)], "Cold", "owner"));
        Assert.Contains("less than nothing", refused.Message);
    }

    [TestMethod]
    public void Every_item_can_go_while_the_room_s_time_stays_on_the_bill()
    {
        var room = Ticket.OpenForSession(7, 2, new LocalizedText("VIP", null), branchId: 1);
        room.AppendOrder(41, [Item(1, "Latte", 2, 50)], 0);
        room.AppendSessionTime([Time(1m, 50)]);

        room.CancelLines([new LineCancel(1, 2)], "Spilled", "owner");

        Assert.AreEqual(50m, room.GetSubtotal(), "the time is still sold");
    }

    [TestMethod]
    public void A_settled_bill_is_refunded_not_cancelled()
    {
        var ticket = TwoItems();
        ticket.Settle([new Payment(PaymentTender.Cash, 120, "cashier")], "cashier");

        Assert.ThrowsExactly<SalesDomainException>(() => ticket.CancelLines([new LineCancel(1, 1)], "Cold", "owner"));
    }

    [TestMethod]
    public void The_cancel_event_carries_what_came_off_and_each_order_as_it_was_before()
    {
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3", null), branchId: 1);
        ticket.AppendOrder(41, [Item(1, "Latte", 2, 50)], 0);
        ticket.AppendOrder(42, [Item(2, "Tea", 2, 20)], 0);

        // Nothing cancelled yet: as rung up is as it stands
        CollectionAssert.AreEquivalent(ticket.GetAmountByOrder().ToList(), ticket.GetOriginalAmountByOrder().ToList());

        ticket.ClearDomainEvents();
        ticket.CancelLines([new LineCancel(1, 1), new LineCancel(2, 1)], "Wrong table", "owner", "Restock");

        var cancelled = ticket.DomainEvents!.OfType<TicketLinesCancelledDomainEvent>().Single();
        Assert.AreSame(ticket, cancelled.Ticket);
        Assert.AreEqual("Wrong table", cancelled.Reason);
        Assert.AreEqual("owner", cancelled.CancelledBy);
        Assert.AreEqual("Restock", cancelled.StockDisposition);
        Assert.HasCount(2, cancelled.Lines);
        Assert.AreEqual(50m, cancelled.Lines.Single(l => l.Line.Id == 1).Amount);
        Assert.AreEqual(1m, cancelled.Lines.Single(l => l.Line.Id == 1).Qty);
        Assert.AreEqual(20m, cancelled.Lines.Single(l => l.Line.Id == 2).Amount);
        Assert.AreEqual(100m, cancelled.OriginalAmountByOrder[41], "before this cancel");
        Assert.AreEqual(40m, cancelled.OriginalAmountByOrder[42]);

        // After it: what stands, and what was rung up
        Assert.AreEqual(50m, ticket.GetAmountByOrder()[41]);
        Assert.AreEqual(20m, ticket.GetAmountByOrder()[42]);
        Assert.AreEqual(100m, ticket.GetOriginalAmountByOrder()[41]);
        Assert.AreEqual(40m, ticket.GetOriginalAmountByOrder()[42]);

        // A second cancel still reports the order as rung up, not as it stood after the first
        ticket.ClearDomainEvents();
        ticket.CancelLines([new LineCancel(1, 1)], "Wrong table", "owner");
        var second = ticket.DomainEvents!.OfType<TicketLinesCancelledDomainEvent>().Single();
        Assert.AreEqual(100m, second.OriginalAmountByOrder[41]);
        Assert.IsNull(second.StockDisposition);
    }

    [TestMethod]
    public void A_refund_after_a_cancel_gives_back_only_what_was_still_sold()
    {
        var ticket = TwoItems();
        ticket.CancelLines([new LineCancel(1, 1)], "Cold", "owner");
        ticket.Settle([new Payment(PaymentTender.Cash, 70, "cashier")], "cashier");
        Assert.AreEqual(70m, ticket.Total);

        Assert.ThrowsExactly<SalesDomainException>(() =>
            Refund.Issue(1, ticket, 9, [], [new RefundRequestLine(1, 2)], "Cold", PaymentTender.Cash, null, null, "owner", null),
            "one latte was cancelled, only one was paid for");

        var refund = Refund.Issue(1, ticket, 9, [], [new RefundRequestLine(1, 1)], "Cold", PaymentTender.Cash, null, null, "owner", null);
        Assert.AreEqual(50m, refund.Amount);
        Assert.ThrowsExactly<SalesDomainException>(() =>
            Refund.Issue(2, ticket, 9, [refund], [new RefundRequestLine(1, 1)], "Again", PaymentTender.Cash, null, null, "owner", null));
    }

    /// <summary>A latte line (id 1, 2 x 50) and a tea line (id 2, 1 x 20) of order 41: 120.</summary>
    private static Ticket TwoItems()
    {
        var ticket = Ticket.OpenForTable(3, new LocalizedText("Table 3", null), branchId: 1);
        ticket.AppendOrder(41, [Item(1, "Latte", 2, 50), Item(2, "Tea", 1, 20)], 0);
        return ticket;
    }

    private static TicketLine Item(int id, string name, decimal qty, decimal unitPrice, decimal discount = 0)
        => new IdLine(id, TicketLineSource.Order, name, qty, unitPrice, discount);

    private static TicketLine Fee(int id, decimal fee)
        => new IdLine(id, TicketLineSource.DeliveryFee, "Delivery fee", 1, fee);

    private sealed class IdLine : TicketLine
    {
        public IdLine(int id, TicketLineSource source, string name, decimal qty, decimal unitPrice, decimal discount = 0)
            : base(source, new LocalizedText(name, null), qty, unitPrice, discount)
        {
            Id = id;
        }
    }

    /// <summary>One rate option's time, as Spaces reports it when the stay ends.</summary>
    private static SessionTimeLine Time(decimal hours, decimal cost, string option = "Single")
        => new(new LocalizedText(option, null), hours, cost);

    private static TicketLine Line(string name, int qty, decimal unitPrice)
        => new(TicketLineSource.Order, new LocalizedText(name, null), qty, unitPrice, orderId: null);

    private static Ticket TicketWith(decimal total)
    {
        var ticket = Ticket.OpenForCounter(branchId: 1);
        ticket.AppendOrder(1, [Line("Item", 1, total)], 0);
        return ticket;
    }
}
