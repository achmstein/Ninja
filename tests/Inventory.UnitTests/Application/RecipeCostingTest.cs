#nullable enable
using Chillax.Inventory.API.Application.Services;
using Chillax.Inventory.Domain.AggregatesModel.RecipeAggregate;
using Chillax.Inventory.Domain.AggregatesModel.StockItemAggregate;
using Chillax.Inventory.Domain.SeedWork;

namespace Inventory.UnitTests.Application;

/// <summary>What one sale costs: base lines summed, option sets apart, uncosted ingredients named.</summary>
[TestClass]
public class RecipeCostingTest
{
    private const int Beans = 1, Milk = 2, OatMilk = 3, Cup = 4;
    private const int OatOption = 40, LargeOption = 41;

    private static readonly Dictionary<int, StockItem> Items = new()
    {
        [Beans] = StockItem.Create(new LocalizedText("Beans", "بن"), "g", 1000, "bag", false),
        [Milk] = StockItem.Create(new LocalizedText("Milk", "لبن"), "ml", 1000, "carton", false),
        [OatMilk] = StockItem.Create(new LocalizedText("Oat Milk", "لبن شوفان"), "ml", 1000, "carton", false),
        [Cup] = StockItem.Create(new LocalizedText("Cup", "كوب"), "pcs", null, null, true),
    };

    private static Recipe Latte() => new(7,
    [
        new RecipeLine(Beans, 18),
        new RecipeLine(Milk, 200),
        new RecipeLine(Cup, 1),
        new RecipeLine(OatMilk, 200, [OatOption]),
        new RecipeLine(Milk, 100, [LargeOption]),
        new RecipeLine(Beans, 6, [LargeOption]),
    ]);

    [TestMethod]
    public void Base_cost_is_the_base_lines_at_average_cost_and_each_option_set_is_its_extra()
    {
        var costs = new Dictionary<int, decimal> { [Beans] = 0.6m, [Milk] = 0.03m, [OatMilk] = 0.09m, [Cup] = 1.5m };

        var cost = RecipeCosting.Cost(Latte(), costs, Items);

        Assert.AreEqual(7, cost.CatalogItemId);
        Assert.AreEqual(18 * 0.6m + 200 * 0.03m + 1.5m, cost.BaseCost, "10.80 + 6.00 + 1.50");
        Assert.IsEmpty(cost.Uncosted);
        Assert.HasCount(2, cost.Options);

        var oat = cost.Options.Single(o => o.OptionIds.SequenceEqual([OatOption]));
        Assert.AreEqual(18m, oat.Cost, "200 ml of oat milk");
        var large = cost.Options.Single(o => o.OptionIds.SequenceEqual([LargeOption]));
        Assert.AreEqual(100 * 0.03m + 6 * 0.6m, large.Cost, "the two large lines summed");

        Assert.HasCount(6, cost.Lines);
        Assert.AreEqual("Beans", cost.Lines[0].Name.En);
        Assert.AreEqual(0.6m, cost.Lines[0].UnitCost);
        Assert.AreEqual(10.8m, cost.Lines[0].Cost);
    }

    [TestMethod]
    public void An_ingredient_never_received_here_is_listed_as_uncosted_and_counts_as_zero()
    {
        var costs = new Dictionary<int, decimal> { [Beans] = 0.6m, [Cup] = 1.5m };

        var cost = RecipeCosting.Cost(Latte(), costs, Items);

        Assert.AreEqual(10.8m + 1.5m, cost.BaseCost, "milk counts as nothing until it is received");
        CollectionAssert.AreEqual(new[] { Milk, OatMilk }, cost.Uncosted.ToList());
        Assert.AreEqual(0m, cost.Options.Single(o => o.OptionIds.SequenceEqual([OatOption])).Cost);
    }

    [TestMethod]
    public void Money_is_rounded_to_piastres()
    {
        var costs = new Dictionary<int, decimal> { [Beans] = 0.4567m };
        var cost = RecipeCosting.Cost(new Recipe(1, [new RecipeLine(Beans, 3)]), costs, Items);
        Assert.AreEqual(1.37m, cost.BaseCost, "3 × 0.4567 = 1.3701");
    }
}
