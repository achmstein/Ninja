namespace Chillax.Inventory.UnitTests.Domain;

using Chillax.Inventory.Domain.AggregatesModel.RecipeAggregate;
using Chillax.Inventory.Domain.Exceptions;

[TestClass]
public class RecipeTest
{
    private const int Latte = 10;
    private const int Milk = 1;
    private const int Beans = 2;
    private const int OatMilk = 3;
    private const int OatOption = 77;

    private static Recipe LatteRecipe() => new(Latte,
    [
        new RecipeLine(Milk, 200),
        new RecipeLine(Beans, 18),
        new RecipeLine(OatMilk, 200, [OatOption]),
    ]);

    [TestMethod]
    public void Explodes_base_lines_per_unit_sold()
    {
        var consumed = LatteRecipe().Explode(3).ToDictionary(x => x.StockItemId, x => x.Quantity);

        Assert.AreEqual(600m, consumed[Milk]);
        Assert.AreEqual(54m, consumed[Beans]);
        Assert.IsFalse(consumed.ContainsKey(OatMilk), "an option line is not used unless chosen");
    }

    [TestMethod]
    public void Option_lines_apply_only_when_the_option_was_chosen()
    {
        var consumed = LatteRecipe().Explode(1, [OatOption]).ToDictionary(x => x.StockItemId, x => x.Quantity);

        Assert.AreEqual(200m, consumed[OatMilk]);
        Assert.AreEqual(200m, consumed[Milk], "the base line still applies; swapping is a Phase 2 recipe choice");
    }

    [TestMethod]
    public void A_combination_line_needs_every_one_of_its_options()
    {
        const int Turkish = 20;
        const int MediumPlain = 11, MediumSpiced = 12;
        const int Medium = 101, Spiced = 202, Plain = 203;

        var recipe = new Recipe(Turkish,
        [
            new RecipeLine(MediumPlain, 7, [Medium, Plain]),
            new RecipeLine(MediumSpiced, 7, [Spiced, Medium]),
        ]);

        var spiced = recipe.Explode(1, [Medium, Spiced]).ToDictionary(x => x.StockItemId, x => x.Quantity);
        Assert.AreEqual(7m, spiced[MediumSpiced]);
        Assert.IsFalse(spiced.ContainsKey(MediumPlain));

        Assert.AreEqual(0, recipe.Explode(1, [Medium]).Count(), "half a combination applies to nothing");
        Assert.AreEqual(0, recipe.Explode(1).Count(), "no base lines: nothing without choices");

        // Order of the ids never matters for the duplicate rule
        Assert.ThrowsExactly<InventoryDomainException>(() => new Recipe(Turkish,
        [
            new RecipeLine(MediumSpiced, 7, [Medium, Spiced]),
            new RecipeLine(MediumSpiced, 8, [Spiced, Medium]),
        ]));
    }

    [TestMethod]
    public void Nothing_is_consumed_for_zero_units()
    {
        Assert.AreEqual(0, LatteRecipe().Explode(0).Count());
    }

    [TestMethod]
    public void Track_by_unit_is_one_of_the_stock_item_per_sale()
    {
        var recipe = Recipe.ForUnit(catalogItemId: 5, stockItemId: 9);

        var only = recipe.Explode(4).Single();
        Assert.AreEqual(9, only.StockItemId);
        Assert.AreEqual(4m, only.Quantity);
    }

    [TestMethod]
    public void Rejects_an_empty_recipe_and_duplicate_lines()
    {
        Assert.ThrowsExactly<InventoryDomainException>(() => new Recipe(Latte, []));

        Assert.ThrowsExactly<InventoryDomainException>(() => new Recipe(Latte,
        [
            new RecipeLine(Milk, 200),
            new RecipeLine(Milk, 50),
        ]));

        // The same ingredient may appear once as base and once for an option
        _ = new Recipe(Latte, [new RecipeLine(Milk, 200), new RecipeLine(Milk, 50, [OatOption])]);
    }

    [TestMethod]
    public void Rejects_non_positive_quantities()
    {
        Assert.ThrowsExactly<InventoryDomainException>(() => new RecipeLine(Milk, 0));
        Assert.ThrowsExactly<InventoryDomainException>(() => new RecipeLine(Milk, -1));
    }
}
