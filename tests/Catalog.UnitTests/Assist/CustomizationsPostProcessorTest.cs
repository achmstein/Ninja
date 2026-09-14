using Chillax.Catalog.API.Assist;
using Chillax.Catalog.API.Model;

namespace Catalog.UnitTests.Assist;

[TestClass]
public class CustomizationsPostProcessorTest
{
    /// <summary>The item as the form sends it, with the names of the groups it already has.</summary>
    private static SuggestCustomizationsRequest Latte(params LocalizedText[] existing) =>
        new(new LocalizedText("Latte", "لاتيه"), Price: 60m, ExistingGroups: existing);

    private static CustomizationGroupResult Size(decimal doublePrice = 10m) => new(
        new LocalizedPair("Size", "الحجم"), IsRequired: true, AllowMultiple: false,
        [
            new CustomizationOptionResult(new LocalizedPair("Single", "سنجل"), 0m, true),
            new CustomizationOptionResult(new LocalizedPair("Double", "دبل"), doublePrice, false),
        ]);

    private static CustomizationGroupResult Extras() => new(
        new LocalizedPair("Extras", "إضافات"), IsRequired: false, AllowMultiple: true,
        [new CustomizationOptionResult(new LocalizedPair("Whipped Cream", "كريمة"), 5m, false)]);

    [TestMethod]
    public void Clean_groups_pass_through_in_the_form_shape()
    {
        var response = CustomizationsPostProcessor.Apply(new CustomizationsResult([Size(), Extras()], ""), Latte());

        Assert.HasCount(2, response.Groups);
        Assert.IsEmpty(response.Warnings);

        var size = response.Groups[0];
        Assert.AreEqual("Size", size.Name.En);
        Assert.AreEqual("الحجم", size.Name.Ar);
        Assert.IsTrue(size.IsRequired);
        Assert.IsFalse(size.AllowMultiple);
        Assert.AreEqual(10m, size.Options[1].PriceAdjustment);
        Assert.IsTrue(size.Options[0].IsDefault);

        var extras = response.Groups[1];
        Assert.IsTrue(extras.AllowMultiple);
        Assert.HasCount(1, extras.Options, "an add-on group may have a single option");
    }

    [TestMethod]
    public void A_group_the_item_already_has_is_dropped_by_either_language()
    {
        var existing = new LocalizedText("Serving Size", "الحجم");
        var response = CustomizationsPostProcessor.Apply(new CustomizationsResult([Size(), Extras()], ""), Latte(existing));

        Assert.HasCount(1, response.Groups);
        Assert.AreEqual("Extras", response.Groups[0].Name.En);
        Assert.IsTrue(response.Warnings.Any(w => w.Contains("already has")), string.Join("; ", response.Warnings));
    }

    [TestMethod]
    public void A_single_choice_group_keeps_one_default_and_needs_two_options()
    {
        var twoDefaults = Size() with
        {
            Options =
            [
                new CustomizationOptionResult(new LocalizedPair("Single", "سنجل"), 0m, true),
                new CustomizationOptionResult(new LocalizedPair("Double", "دبل"), 10m, true),
                new CustomizationOptionResult(new LocalizedPair("  double ", "دبل"), 10m, false),
            ],
        };
        var lonely = new CustomizationGroupResult(new LocalizedPair("Cup", "الكوباية"), false, false,
            [new CustomizationOptionResult(new LocalizedPair("Cup", "كوباية"), 0m, true)]);

        var response = CustomizationsPostProcessor.Apply(new CustomizationsResult([twoDefaults, lonely], ""), Latte());

        var size = Assert.ContainsSingle(response.Groups);
        Assert.HasCount(2, size.Options, "the duplicate option is dropped");
        Assert.IsTrue(size.Options[0].IsDefault);
        Assert.IsFalse(size.Options[1].IsDefault);
        Assert.IsTrue(response.Warnings.Any(w => w.Contains("\"Cup\"") && w.Contains("at least 2")), string.Join("; ", response.Warnings));
    }

    [TestMethod]
    public void Prices_are_rounded_and_absurd_ones_zeroed_with_a_warning()
    {
        var pricey = Size(doublePrice: 500m) with
        {
            Options =
            [
                new CustomizationOptionResult(new LocalizedPair("Single", "سنجل"), -70m, true),
                new CustomizationOptionResult(new LocalizedPair("Double", "دبل"), 500m, false),
                new CustomizationOptionResult(new LocalizedPair("Triple", "تريبل"), 12.345m, false),
            ],
        };

        var response = CustomizationsPostProcessor.Apply(new CustomizationsResult([pricey], ""), Latte());

        var options = response.Groups[0].Options;
        Assert.AreEqual(0m, options[0].PriceAdjustment, "below free");
        Assert.AreEqual(0m, options[1].PriceAdjustment, "more than double the item");
        Assert.AreEqual(12.35m, options[2].PriceAdjustment);
        Assert.HasCount(2, response.Warnings);
    }

    [TestMethod]
    public void Missing_arabic_is_flagged_and_notes_become_a_warning()
    {
        var english = new CustomizationGroupResult(new LocalizedPair("Milk", ""), false, false,
            [
                new CustomizationOptionResult(new LocalizedPair("Regular", ""), 0m, true),
                new CustomizationOptionResult(new LocalizedPair("Oat", ""), 15m, false),
            ]);

        var response = CustomizationsPostProcessor.Apply(new CustomizationsResult([english], "Not much to add to a latte."), Latte());

        var milk = Assert.ContainsSingle(response.Groups);
        Assert.IsNull(milk.Name.Ar);
        Assert.IsTrue(response.Warnings.Any(w => w.Contains("missing Arabic")), string.Join("; ", response.Warnings));
        Assert.Contains("Assistant: Not much to add to a latte.", response.Warnings);
    }

    [TestMethod]
    public void Only_the_first_five_groups_are_kept()
    {
        var groups = Enumerable.Range(1, 7)
            .Select(i => Size() with { Name = new LocalizedPair($"Group {i}", $"مجموعة {i}") })
            .ToList();

        var response = CustomizationsPostProcessor.Apply(new CustomizationsResult(groups, ""), Latte());

        Assert.HasCount(CustomizationsPostProcessor.MaxGroups, response.Groups);
        Assert.IsTrue(response.Warnings.Any(w => w.Contains("more than 5")), string.Join("; ", response.Warnings));
    }
}
