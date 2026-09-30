#nullable enable
namespace Ninja.Ordering.UnitTests.Domain;

using Ninja.Ordering.API.Application.Commands;
using Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;
using Ninja.Ordering.API.Application.IntegrationEvents.Events;
using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;
using Ninja.Ordering.Domain.Seedwork;

/// <summary>
/// The menu's answer stands over what the app sent: each line takes the
/// price Catalog priced it at, and the discounts follow the prices that
/// stand. A refusal cancels the order saying why; an answer heard twice
/// changes nothing the second time.
/// </summary>
[TestClass]
public class OrderValidationTest
{
    private const int Latte = 1;
    private const int Cake = 2;

    /// <summary>A latte someone sent at 1 and a cake at its 60, with 30 in points to redeem.</summary>
    private static Order TamperedOrder(int pointsToRedeem = 0)
    {
        var order = new Order("u1", "Mona", branchId: 1, pointsToRedeem: pointsToRedeem,
            loyaltyDiscount: Order.GetLoyaltyDiscountFor(pointsToRedeem, 61));
        order.AddOrderItem(Latte, new LocalizedText("Latte", null), 1, 0, null);
        order.AddOrderItem(Cake, new LocalizedText("Cake", null), 60, 0, null);
        var lines = order.OrderItems.ToList();
        typeof(Entity).GetProperty(nameof(Entity.Id))!.SetValue(lines[0], 101);
        typeof(Entity).GetProperty(nameof(Entity.Id))!.SetValue(lines[1], 102);
        return order;
    }

    [TestMethod]
    public void Each_line_takes_the_menus_price_and_the_total_follows()
    {
        var order = TamperedOrder();

        order.SetValidatedStatus(new Dictionary<int, decimal> { [101] = 50, [102] = 60 });

        Assert.AreEqual(OrderStatus.Submitted, order.OrderStatus);
        Assert.AreEqual(50m, order.OrderItems.Single(i => i.ProductId == Latte).UnitPrice);
        Assert.AreEqual(110m, order.GetTotal());
    }

    [TestMethod]
    public void The_loyalty_discount_is_worked_out_again_on_the_prices_that_stand()
    {
        // 100 points are worth 1, never more than the order: the app's 61 capped nothing, the menu's 110 neither
        var order = TamperedOrder(pointsToRedeem: 20_000);
        Assert.AreEqual(61d, order.LoyaltyDiscount, "200 in points, capped at the 61 the app claimed");

        order.SetValidatedStatus(new Dictionary<int, decimal> { [101] = 50, [102] = 60 });

        Assert.AreEqual(110d, order.LoyaltyDiscount, "capped at the 110 the menu says");
        Assert.AreEqual(0m, order.GetTotal());
    }

    [TestMethod]
    public void A_promo_is_clamped_to_the_prices_that_stand()
    {
        var order = TamperedOrder();

        order.SetValidatedStatus(new Dictionary<int, decimal> { [101] = 50, [102] = 60 }, "BIG", 200m);

        Assert.AreEqual(110m, order.PromoDiscount);
        Assert.AreEqual("BIG", order.PromoCode);
    }

    [TestMethod]
    public void Without_prices_the_lines_stand_as_they_came()
    {
        var order = TamperedOrder();

        order.SetValidatedStatus();

        Assert.AreEqual(1m, order.OrderItems.Single(i => i.ProductId == Latte).UnitPrice);
        Assert.AreEqual(OrderStatus.Submitted, order.OrderStatus);
    }

    [TestMethod]
    public void A_price_the_menu_raised_cancels_the_order_saying_so()
    {
        var order = TamperedOrder();

        order.SetValidationFailedStatus([new ValidationFailure(Latte, ValidationFailure.PriceChanged)]);

        Assert.AreEqual(OrderStatus.Cancelled, order.OrderStatus);
        StringAssert.Contains(order.Description, "prices changed");
    }

    [TestMethod]
    public void Something_the_menu_cannot_sell_cancels_the_order_as_unavailable()
    {
        var order = TamperedOrder();

        order.SetValidationFailedStatus([
            new ValidationFailure(Latte, ValidationFailure.PriceChanged),
            new ValidationFailure(Cake, "OptionUnavailable"),
        ]);

        StringAssert.Contains(order.Description, "not available: 2");
    }

    [TestMethod]
    public void A_waiting_reminder_does_not_count_against_staff_once_the_check_answers()
    {
        var order = TamperedOrder();
        order.RecordReminderSent();

        order.SetValidatedStatus();

        Assert.AreEqual(0, order.ReminderCount);
        Assert.IsNull(order.LastReminderSentAt);
    }

    [TestMethod]
    public async Task An_answer_heard_twice_leaves_the_order_as_the_first_left_it()
    {
        var order = TamperedOrder();
        order.SetValidatedStatus(new Dictionary<int, decimal> { [101] = 50, [102] = 60 });
        var repository = Substitute.For<IOrderRepository>();
        repository.GetAsync(7).Returns(Task.FromResult(order));

        var validatedAgain = await new SetOrderValidatedCommandHandler(repository, Substitute.For<ILogger<SetOrderValidatedCommandHandler>>())
            .Handle(new SetOrderValidatedCommand(7, new Dictionary<int, decimal> { [101] = 1 }), CancellationToken.None);
        var failedAfter = await new SetOrderValidationFailedCommandHandler(repository, Substitute.For<ILogger<SetOrderValidationFailedCommandHandler>>())
            .Handle(new SetOrderValidationFailedCommand(7, [new ValidationFailure(Latte, ValidationFailure.Unavailable)]), CancellationToken.None);

        Assert.IsFalse(validatedAgain);
        Assert.IsFalse(failedAfter);
        Assert.AreEqual(OrderStatus.Submitted, order.OrderStatus);
        Assert.AreEqual(50m, order.OrderItems.Single(i => i.ProductId == Latte).UnitPrice);
        await repository.UnitOfWork.DidNotReceive().SaveEntitiesAsync(Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task An_answer_under_the_old_names_still_moves_the_order()
    {
        var mediator = Substitute.For<IMediator>();
        mediator.Send(Arg.Any<SetOrderValidatedCommand>()).Returns(true);
        mediator.Send(Arg.Any<SetOrderValidationFailedCommand>()).Returns(true);
        var repository = Substitute.For<IOrderRepository>();
        var logger = Substitute.For<ILogger<OrderValidatedIntegrationEventHandler>>();

        await new OrderStockConfirmedIntegrationEventHandler(repository, mediator, logger)
            .Handle(new OrderStockConfirmedIntegrationEvent(7, "SAVE", 5m) { Categories = new() { [Latte] = 3 } });
        await new OrderStockRejectedIntegrationEventHandler(mediator, Substitute.For<ILogger<OrderValidationFailedIntegrationEventHandler>>())
            .Handle(new OrderStockRejectedIntegrationEvent(8, [new ConfirmedOrderStockItem(Latte, true), new ConfirmedOrderStockItem(Cake, false)]));

        await mediator.Received(1).Send(Arg.Is<SetOrderValidatedCommand>(c =>
            c.OrderNumber == 7 && c.Prices == null && c.PromoCode == "SAVE" && c.PromoDiscount == 5m && c.Categories![Latte] == 3));
        await mediator.Received(1).Send(Arg.Is<SetOrderValidationFailedCommand>(c =>
            c.OrderNumber == 8 && c.Failures.Single().ProductId == Cake && c.Failures.Single().Reason == ValidationFailure.Unavailable));
    }
}
