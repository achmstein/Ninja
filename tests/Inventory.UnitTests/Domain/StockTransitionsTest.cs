namespace Chillax.Inventory.UnitTests.Domain;

using Chillax.Inventory.Domain.AggregatesModel.LedgerAggregate;
using Chillax.Inventory.Domain.Services;

[TestClass]
public class StockTransitionsTest
{
    [TestMethod]
    public void Crossing_zero_counts_only_on_the_movement_that_crosses()
    {
        Assert.IsTrue(StockTransitions.CrossedToZero(1, 0));
        Assert.IsTrue(StockTransitions.CrossedToZero(2, -1), "an oversell crosses too");
        Assert.IsFalse(StockTransitions.CrossedToZero(0, -1), "already out: no second announcement");
        Assert.IsFalse(StockTransitions.CrossedToZero(5, 3));

        Assert.IsTrue(StockTransitions.CrossedAboveZero(0, 5));
        Assert.IsTrue(StockTransitions.CrossedAboveZero(-2, 1));
        Assert.IsFalse(StockTransitions.CrossedAboveZero(-2, 0), "restocked to exactly nothing is still out");
        Assert.IsFalse(StockTransitions.CrossedAboveZero(3, 8));
    }

    [TestMethod]
    public void Low_stock_fires_once_when_dropping_to_or_below_the_line()
    {
        Assert.IsTrue(StockTransitions.CrossedBelowReorder(5, 3, 3));
        Assert.IsTrue(StockTransitions.CrossedBelowReorder(4, 0, 3));
        Assert.IsFalse(StockTransitions.CrossedBelowReorder(3, 2, 3), "already at the line");
        Assert.IsFalse(StockTransitions.CrossedBelowReorder(2, 5, 3), "going up never warns");
        Assert.IsFalse(StockTransitions.CrossedBelowReorder(5, 1, null), "no line, no warning");
    }

    [TestMethod]
    public void Average_cost_moves_with_receipts_and_resets_when_nothing_was_on_hand()
    {
        Assert.AreEqual(12m, StockLevel.NextAverageCost(onHand: 0, avgUnitCost: 10, quantity: 5, unitCost: 12));
        Assert.AreEqual(12m, StockLevel.NextAverageCost(onHand: -3, avgUnitCost: 10, quantity: 5, unitCost: 12), "oversold stock does not drag the price");
        Assert.AreEqual(11m, StockLevel.NextAverageCost(onHand: 5, avgUnitCost: 10, quantity: 5, unitCost: 12));
        Assert.AreEqual(10m, StockLevel.NextAverageCost(onHand: 5, avgUnitCost: 10, quantity: -2, unitCost: 99), "stock going out never changes the average");
    }
}
