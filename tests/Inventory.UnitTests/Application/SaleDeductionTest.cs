namespace Chillax.Inventory.UnitTests.Application;

using Chillax.Inventory.API.Application.IntegrationEvents.Events;
using Chillax.Inventory.API.Application.Services;
using Chillax.Inventory.Domain.AggregatesModel.LedgerAggregate;
using Chillax.Inventory.Domain.AggregatesModel.RecipeAggregate;

[TestClass]
public class SaleDeductionTest
{
    private const int Latte = 10;
    private const int Cappuccino = 11;
    private const int Cola = 12;
    private const int Milk = 1;
    private const int Beans = 2;
    private const int ColaCan = 3;

    private static readonly Dictionary<int, Recipe> Recipes = new()
    {
        [Latte] = new Recipe(Latte, [new RecipeLine(Milk, 200), new RecipeLine(Beans, 18)]),
        [Cappuccino] = new Recipe(Cappuccino, [new RecipeLine(Milk, 120), new RecipeLine(Beans, 18)]),
        [Cola] = Recipe.ForUnit(Cola, ColaCan),
    };

    [TestMethod]
    public void Sums_ingredients_across_lines_and_products_into_one_movement_each()
    {
        var drafts = SaleDeduction.BuildDrafts(42,
        [
            new OrderConfirmedItem { ProductId = Latte, Units = 2 },
            new OrderConfirmedItem { ProductId = Latte, Units = 1 },   // a customized second line of the same product
            new OrderConfirmedItem { ProductId = Cappuccino, Units = 1 },
            new OrderConfirmedItem { ProductId = Cola, Units = 3 },
        ], Recipes);

        var byItem = drafts.ToDictionary(d => d.StockItemId);

        Assert.AreEqual(3, drafts.Count);
        Assert.AreEqual(-(600m + 120m), byItem[Milk].Quantity);
        Assert.AreEqual(-(54m + 18m), byItem[Beans].Quantity);
        Assert.AreEqual(-3m, byItem[ColaCan].Quantity);
        Assert.IsTrue(drafts.All(d => d.Type == MovementType.Sale));
        Assert.IsTrue(drafts.All(d => d.Reference == "order:42"), "every movement of the order shares its reference");
    }

    [TestMethod]
    public void Option_lines_are_charged_only_for_lines_that_chose_the_option()
    {
        const int OatMilk = 4;
        const int OatOption = 77;
        var recipes = new Dictionary<int, Recipe>
        {
            [Latte] = new Recipe(Latte, [new RecipeLine(Milk, 200), new RecipeLine(Beans, 18), new RecipeLine(OatMilk, 200, [OatOption])]),
        };

        var drafts = SaleDeduction.BuildDrafts(7,
        [
            new OrderConfirmedItem { ProductId = Latte, Units = 1 },
            new OrderConfirmedItem { ProductId = Latte, Units = 2, OptionIds = [OatOption] },
        ], recipes);

        var byItem = drafts.ToDictionary(d => d.StockItemId);

        Assert.AreEqual(-400m, byItem[OatMilk].Quantity, "only the two oat lattes take oat milk");
        Assert.AreEqual(-600m, byItem[Milk].Quantity, "the base line still applies to all three");
        Assert.AreEqual(-54m, byItem[Beans].Quantity);
    }

    [TestMethod]
    public void Untracked_products_post_nothing()
    {
        var drafts = SaleDeduction.BuildDrafts(1, [new OrderConfirmedItem { ProductId = 999, Units = 5 }], Recipes);

        Assert.AreEqual(0, drafts.Count);
    }

    [TestMethod]
    public void An_order_of_nothing_tracked_and_something_tracked_posts_only_the_tracked_part()
    {
        var drafts = SaleDeduction.BuildDrafts(1,
        [
            new OrderConfirmedItem { ProductId = 999, Units = 5 },
            new OrderConfirmedItem { ProductId = Cola, Units = 1 },
        ], Recipes);

        var only = drafts.Single();
        Assert.AreEqual(ColaCan, only.StockItemId);
        Assert.AreEqual(-1m, only.Quantity);
    }
}
