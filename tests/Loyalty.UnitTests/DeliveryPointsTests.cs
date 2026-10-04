using Ninja.Loyalty.API.IntegrationEvents.EventHandling;
using Ninja.Loyalty.API.IntegrationEvents.Events;

namespace Ninja.Loyalty.UnitTests;

/// <summary>Points are for what was eaten, not for the ride over: a delivery's fee earns nothing.</summary>
[TestClass]
public sealed class DeliveryPointsTests
{
    [TestMethod]
    public void A_delivery_earns_on_its_dishes_not_its_fee()
    {
        var delivered = new OrderStatusChangedToConfirmedIntegrationEvent { OrderId = 1, OrderTotal = 115m, DeliveryFee = 20m, IsDelivery = true };
        Assert.AreEqual(95m, OrderStatusChangedToConfirmedIntegrationEventHandler.EarningTotal(delivered));
    }

    [TestMethod]
    public void An_order_without_a_fee_earns_on_all_of_it()
    {
        Assert.AreEqual(115m, OrderStatusChangedToConfirmedIntegrationEventHandler.EarningTotal(new() { OrderId = 2, OrderTotal = 115m }));
        Assert.AreEqual(115m, OrderStatusChangedToConfirmedIntegrationEventHandler.EarningTotal(new() { OrderId = 3, OrderTotal = 115m, IsDelivery = true }), "a free delivery");
    }

    [TestMethod]
    public void A_fee_bigger_than_the_order_never_takes_points_away()
    {
        Assert.AreEqual(0m, OrderStatusChangedToConfirmedIntegrationEventHandler.EarningTotal(new() { OrderId = 4, OrderTotal = 10m, DeliveryFee = 20m }));
    }
}
