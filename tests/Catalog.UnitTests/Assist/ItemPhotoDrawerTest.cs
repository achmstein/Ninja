using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Ninja.AI;
using Ninja.Catalog.API.Assist;

namespace Catalog.UnitTests.Assist;

[TestClass]
public class ItemPhotoDrawerTest
{
    private static DrawItemPhotoRequest Koshary(string? style = null, string? note = null)
        => new("Koshary", "كشري", "Rice, lentils and pasta with a spicy tomato sauce", "Mains", style, note);

    [TestMethod]
    public void The_prompt_names_the_item_in_both_languages_with_what_it_is()
    {
        var prompt = ItemPhotoPrompt.For(Koshary());

        StringAssert.Contains(prompt, "Koshary (كشري)");
        StringAssert.Contains(prompt, "It is: Rice, lentils and pasta");
        StringAssert.Contains(prompt, "From the menu's Mains.");
        StringAssert.Contains(prompt, "No text, no labels, no logos, no hands, no people.");
    }

    [TestMethod]
    public void Each_look_is_its_own_photograph_and_an_unknown_one_is_the_studio()
    {
        var prompts = ItemPhotoPrompt.Styles.Select(style => ItemPhotoPrompt.For(Koshary(style))).ToList();

        Assert.AreEqual(ItemPhotoPrompt.Styles.Length, prompts.Distinct().Count());
        StringAssert.Contains(ItemPhotoPrompt.For(Koshary("overhead")), "straight from above");
        Assert.AreEqual(ItemPhotoPrompt.For(Koshary("studio")), ItemPhotoPrompt.For(Koshary("neon")));
        Assert.AreEqual(ItemPhotoPrompt.For(Koshary("studio")), ItemPhotoPrompt.For(Koshary(null)));
    }

    [TestMethod]
    public void The_owners_note_is_added_and_kept_short()
    {
        StringAssert.Contains(ItemPhotoPrompt.For(Koshary(note: "with crispy onions on top")), "Also: with crispy onions on top.");

        var prompt = ItemPhotoPrompt.For(Koshary(note: new string('x', 500)));
        StringAssert.Contains(prompt, new string('x', ItemPhotoDrawer.MaxNoteLength));
        Assert.IsFalse(prompt.Contains(new string('x', ItemPhotoDrawer.MaxNoteLength + 1)));
    }

    [TestMethod]
    public async Task Under_test_it_draws_a_webp_without_a_model()
    {
        var drawer = new ItemPhotoDrawer(new ServiceCollection().BuildServiceProvider(), Options.Create(new AIOptions { UseFake = true }));

        Assert.IsTrue(drawer.IsEnabled);
        var picture = await drawer.DrawAsync(Koshary("moody"), CancellationToken.None);

        // RIFF....WEBP
        CollectionAssert.AreEqual("RIFF"u8.ToArray(), picture[..4]);
        CollectionAssert.AreEqual("WEBP"u8.ToArray(), picture[8..12]);
    }

    [TestMethod]
    public void Without_a_model_or_the_stand_in_it_is_off()
    {
        var drawer = new ItemPhotoDrawer(new ServiceCollection().BuildServiceProvider(), Options.Create(new AIOptions()));

        Assert.IsFalse(drawer.IsEnabled);
    }
}
