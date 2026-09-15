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

    // --- slots -----------------------------------------------------------

    private const int Cup = 4, Sugar = 5, Coffee = 6, LightCoffee = 7, LightSpicedCoffee = 8;
    private const int Light = 301, Spiced = 302, Plain = 303, Double = 304, NoSugar = 305;

    [TestMethod]
    public void An_override_replaces_the_slots_default_instead_of_adding_to_it()
    {
        var recipe = new Recipe(Latte,
        [
            new RecipeLine(Beans, 18, slot: 1),
            new RecipeLine(Milk, 200, slot: 2),
            new RecipeLine(OatMilk, 200, [OatOption], slot: 2),
        ]);

        var oat = recipe.Explode(1, [OatOption]).ToDictionary(x => x.StockItemId, x => x.Quantity);
        Assert.AreEqual(200m, oat[OatMilk]);
        Assert.IsFalse(oat.ContainsKey(Milk), "the milk slot resolved to oat milk");
        Assert.AreEqual(18m, oat[Beans]);

        var plain = recipe.Explode(1).ToDictionary(x => x.StockItemId, x => x.Quantity);
        Assert.AreEqual(200m, plain[Milk]);
        Assert.IsFalse(plain.ContainsKey(OatMilk));
    }

    [TestMethod]
    public void The_most_specific_override_wins_and_an_uncovered_combination_falls_back_to_the_default()
    {
        var recipe = new Recipe(20,
        [
            new RecipeLine(Coffee, 7, slot: 1),
            new RecipeLine(LightCoffee, 7, [Light], slot: 1),
            new RecipeLine(LightSpicedCoffee, 7, [Light, Spiced], slot: 1),
        ]);

        Assert.AreEqual(LightSpicedCoffee, recipe.Explode(1, [Light, Spiced]).Single().StockItemId, "two options beat one");
        Assert.AreEqual(LightCoffee, recipe.Explode(1, [Light, Plain]).Single().StockItemId);
        Assert.AreEqual(Coffee, recipe.Explode(1, [Spiced]).Single().StockItemId, "no line for spiced alone: the default, never nothing");
        Assert.AreEqual(Coffee, recipe.Explode(1).Single().StockItemId);
    }

    [TestMethod]
    public void A_none_override_deducts_nothing_for_its_choice()
    {
        var recipe = new Recipe(20,
        [
            new RecipeLine(Coffee, 7, slot: 1),
            new RecipeLine(Sugar, 4, slot: 2),
            RecipeLine.None(2, Sugar, [NoSugar]),
        ]);

        var noSugar = recipe.Explode(1, [NoSugar]).ToDictionary(x => x.StockItemId, x => x.Quantity);
        Assert.AreEqual(7m, noSugar[Coffee]);
        Assert.IsFalse(noSugar.ContainsKey(Sugar));
        Assert.AreEqual(4m, recipe.Explode(1).ToDictionary(x => x.StockItemId, x => x.Quantity)[Sugar]);
    }

    [TestMethod]
    public void Plain_lines_are_slots_of_their_own_and_slot_numbers_are_renumbered_in_order()
    {
        var recipe = new Recipe(20,
        [
            new RecipeLine(Coffee, 7),
            new RecipeLine(Sugar, 4, slot: 9),
            new RecipeLine(Sugar, 2, [Light], slot: 9),
            new RecipeLine(Cup, 1),
        ]);

        CollectionAssert.AreEqual(new[] { 1, 2, 2, 3 }, recipe.Lines.Select(l => l.Slot).ToList());
        Assert.AreEqual(2m, recipe.Explode(1, [Light]).Single(x => x.StockItemId == Sugar).Quantity);
    }

    [TestMethod]
    public void A_slot_has_one_default_one_line_per_combination_and_something_to_deduct()
    {
        Assert.ThrowsExactly<InventoryDomainException>(() => new Recipe(20,
        [
            new RecipeLine(Coffee, 7, slot: 1),
            new RecipeLine(LightCoffee, 7, slot: 1),
        ]), "two defaults");

        Assert.ThrowsExactly<InventoryDomainException>(() => new Recipe(20,
        [
            new RecipeLine(Coffee, 7, slot: 1),
            new RecipeLine(LightCoffee, 7, [Light], slot: 1),
            new RecipeLine(LightSpicedCoffee, 9, [Light], slot: 1),
        ]), "the same combination twice in a slot");

        Assert.ThrowsExactly<InventoryDomainException>(() => new Recipe(20, [RecipeLine.None(1, Sugar, [NoSugar])]), "a none override alone");

        Assert.ThrowsExactly<InventoryDomainException>(() => RecipeLine.None(1, Sugar, []), "a none override needs options");
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
