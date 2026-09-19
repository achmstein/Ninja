#nullable enable
using Ninja.Inventory.API.Application.Assist;
using Ninja.Inventory.API.Application.Queries;
using Ninja.Inventory.Domain.SeedWork;

namespace Inventory.UnitTests.Application;

[TestClass]
public class RecipeProposalValidatorTest
{
    private static readonly List<StockItemView> Shelf =
    [
        new(1, new LocalizedText("Beans", "بن"), "g", 1000, "bag", false, true),
        new(2, new LocalizedText("Whole Milk", "لبن كامل الدسم"), "ml", 1000, "carton", false, true),
    ];

    private const int Latte = 10, Cola = 11, Oat = 40, Large = 41;

    private static readonly List<MenuItemToTrack> Requested =
    [
        new(Latte, new LocalizedText("Latte", "لاتيه"), null, "Coffee", 45, [new(Oat, "Milk", new LocalizedText("Oat Milk")), new(Large, "Size", new LocalizedText("Large"))]),
        new(Cola, new LocalizedText("Cola", "كولا"), null, "Drinks", 20, null),
    ];

    private static ExtractedIngredient Ingredient(string key, string en, string ar = "", string unit = "ml", decimal pack = 1000, string packName = "carton", bool auto = false)
        => new(key, en, ar, unit, pack, packName, auto);

    [TestMethod]
    public void A_clean_answer_passes_through_with_the_shelf_resolved_and_the_syrup_new()
    {
        var extraction = new RecipesExtraction(
            [Ingredient("oat-milk", "Oat Milk", "لبن شوفان"), Ingredient("cup", "Paper Cup", "كوب ورق", "pcs", 0, "", true)],
            [
                new ExtractedRecipe(Latte, "recipe",
                [
                    new ExtractedRecipeLine(1, "", 18, [], 0),
                    new ExtractedRecipeLine(2, "", 200, [], 0),
                    new ExtractedRecipeLine(0, "cup", 1, [], 0),
                    new ExtractedRecipeLine(0, "oat-milk", 200, [Oat], 0),
                    new ExtractedRecipeLine(1, "", 6, [Large], 0),
                ]),
                new ExtractedRecipe(Cola, "unit", []),
            ],
            "");

        var proposal = RecipeProposalValidator.Validate(extraction, Requested, Shelf, []);

        Assert.IsEmpty(proposal.Warnings);
        Assert.IsNull(proposal.Notes);
        CollectionAssert.AreEqual(new[] { "oat-milk", "cup" }, proposal.NewItems.Select(i => i.Key).ToList());
        Assert.AreEqual("pcs", proposal.NewItems[1].Unit);
        Assert.IsNull(proposal.NewItems[1].PackSize);
        Assert.IsTrue(proposal.NewItems[1].AutoSoldOut);

        Assert.HasCount(2, proposal.Recipes);
        var latte = proposal.Recipes[0];
        Assert.AreEqual(Latte, latte.CatalogItemId);
        Assert.AreEqual("recipe", latte.Kind);
        Assert.IsEmpty(latte.Warnings);
        Assert.HasCount(5, latte.Lines);
        Assert.AreEqual(1, latte.Lines[0].StockItemId);
        Assert.AreEqual("cup", latte.Lines[2].NewItemKey);
        Assert.IsNull(latte.Lines[2].StockItemId);
        CollectionAssert.AreEqual(new[] { Oat }, latte.Lines[3].OptionIds.ToList());

        var cola = proposal.Recipes[1];
        Assert.AreEqual("unit", cola.Kind);
        Assert.IsEmpty(cola.Lines);
    }

    [TestMethod]
    public void An_ingredient_already_on_the_shelf_by_name_is_not_created_and_its_lines_point_at_the_shelf()
    {
        var extraction = new RecipesExtraction(
            [Ingredient("milk", "whole  milk"), Ingredient("beans-ar", "Coffee Beans", "بُن", "g", 250, "bag")],
            [new ExtractedRecipe(Latte, "recipe", [new ExtractedRecipeLine(0, "milk", 200, [], 0), new ExtractedRecipeLine(0, "beans-ar", 18, [], 0)])],
            "");

        var proposal = RecipeProposalValidator.Validate(extraction, Requested.Take(1).ToList(), Shelf, []);

        Assert.IsEmpty(proposal.NewItems, "both fold to names on the shelf (case and spacing; Arabic diacritics)");
        var lines = proposal.Recipes[0].Lines;
        Assert.AreEqual(2, lines[0].StockItemId);
        Assert.IsNull(lines[0].NewItemKey);
        Assert.AreEqual(1, lines[1].StockItemId);
    }

    [TestMethod]
    public void Bad_lines_are_dropped_with_a_warning_on_the_item_and_a_pack_sized_serving_is_flagged()
    {
        var extraction = new RecipesExtraction(
            [Ingredient("syrup", "Vanilla Syrup", unit: "bottle")],
            [new ExtractedRecipe(Latte, "recipe",
            [
                new ExtractedRecipeLine(99, "", 10, [], 0),          // unknown shelf id
                new ExtractedRecipeLine(0, "ghost", 10, [], 0),      // unknown key
                new ExtractedRecipeLine(0, "syrup", 0, [], 0),       // no quantity
                new ExtractedRecipeLine(2, "", 1000, [777], 0),      // unknown option, and a litre of milk per latte? no: 1000 ml is under the bar
                new ExtractedRecipeLine(1, "", 5000, [], 0),         // 5 kg of beans per sale
                new ExtractedRecipeLine(1, "", 18, [], 0),           // the same beans, base, again
            ])],
            "");

        var proposal = RecipeProposalValidator.Validate(extraction, Requested.Take(1).ToList(), Shelf, []);

        Assert.IsTrue(proposal.Warnings.Any(w => w.Contains("\"bottle\"")), string.Join("; ", proposal.Warnings));

        var latte = proposal.Recipes[0];
        Assert.HasCount(2, latte.Lines, string.Join("; ", latte.Warnings));
        Assert.AreEqual(2, latte.Lines[0].StockItemId);
        Assert.IsEmpty(latte.Lines[0].OptionIds, "the unknown option was stripped, leaving a base line");
        Assert.AreEqual(1, latte.Lines[1].StockItemId);
        Assert.AreEqual(5000m, latte.Lines[1].Quantity);
        Assert.IsTrue(latte.Warnings.Any(w => w.Contains("does not exist (id 99)")));
        Assert.IsTrue(latte.Warnings.Any(w => w.Contains("\"ghost\"")));
        Assert.IsTrue(latte.Warnings.Any(w => w.Contains("no quantity")));
        Assert.IsTrue(latte.Warnings.Any(w => w.Contains("option this item does not have")));
        Assert.IsTrue(latte.Warnings.Any(w => w.Contains("looks like a pack")));
        Assert.IsTrue(latte.Warnings.Any(w => w.Contains("listed twice")));
        Assert.IsEmpty(proposal.NewItems, "the syrup ended up unused, so it is not offered for creation");
    }

    [TestMethod]
    public void Every_requested_item_gets_an_entry_and_strangers_are_ignored()
    {
        var extraction = new RecipesExtraction(
            [],
            [
                new ExtractedRecipe(Cola, "unit", []),
                new ExtractedRecipe(Cola, "recipe", [new ExtractedRecipeLine(1, "", 1, [], 0)]),
                new ExtractedRecipe(999, "unit", []),
            ],
            "Some of these are not drinks");

        var proposal = RecipeProposalValidator.Validate(extraction, Requested, Shelf, ["only 500 offered"]);

        Assert.AreEqual("only 500 offered", proposal.Warnings[0]);
        Assert.IsTrue(proposal.Warnings.Any(w => w.Contains("not asked about (id 999)")));
        Assert.IsTrue(proposal.Warnings.Any(w => w.Contains("\"Cola\" was answered twice")));
        Assert.AreEqual("Some of these are not drinks", proposal.Notes);

        Assert.HasCount(2, proposal.Recipes);
        var latte = proposal.Recipes[0];
        Assert.AreEqual(Latte, latte.CatalogItemId);
        Assert.IsEmpty(latte.Lines);
        CollectionAssert.Contains(latte.Warnings.ToList(), "The assistant proposed nothing for this item; set it up by hand.");
        Assert.AreEqual("unit", proposal.Recipes[1].Kind, "the first answer wins");
    }

    [TestMethod]
    public void Slots_pass_through_and_a_size_is_an_override_in_its_ingredients_slot()
    {
        var extraction = new RecipesExtraction(
            [Ingredient("oat-milk", "Oat Milk", "لبن شوفان")],
            [new ExtractedRecipe(Latte, "recipe",
            [
                new ExtractedRecipeLine(1, "", 18, [], 1),
                new ExtractedRecipeLine(2, "", 200, [], 2),
                new ExtractedRecipeLine(0, "oat-milk", 200, [Oat], 2),
                new ExtractedRecipeLine(1, "", 27, [Large], 1),
            ])],
            "");

        var proposal = RecipeProposalValidator.Validate(extraction, Requested.Take(1).ToList(), Shelf, []);

        var latte = proposal.Recipes[0];
        CollectionAssert.AreEqual(new[] { 1, 2, 2, 1 }, latte.Lines.Select(l => l.Slot).ToList());
        Assert.AreEqual(27m, latte.Lines[3].Quantity, "the large is the beans line again, with the bigger amount");
        Assert.IsEmpty(latte.Warnings, string.Join("; ", latte.Warnings));
    }

    [TestMethod]
    public void A_recipe_with_no_usable_lines_says_so()
    {
        var extraction = new RecipesExtraction([], [new ExtractedRecipe(Latte, "recipe", [])], "");
        var proposal = RecipeProposalValidator.Validate(extraction, Requested.Take(1).ToList(), Shelf, []);
        CollectionAssert.Contains(proposal.Recipes[0].Warnings.ToList(), "No usable ingredient lines were proposed; set it up by hand or sell it as a unit.");
    }
}
