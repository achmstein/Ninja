#nullable enable
using Chillax.AI;
using Chillax.AI.Agents;
using Chillax.AI.Fake;
using Chillax.Inventory.API.Application.Assist;
using Chillax.Inventory.API.Application.Queries;
using Chillax.Inventory.Domain.SeedWork;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Inventory.UnitTests.Application;

/// <summary>The proposer end to end over the scripted client: menu items and shelf in, proposal out.</summary>
[TestClass]
public class RecipeProposerTest
{
    private static readonly List<StockItemView> Shelf =
    [
        new(1, new LocalizedText("Beans", "بن"), "g", 1000, "bag", false, true),
    ];

    private static readonly List<MenuItemToTrack> Items =
    [
        new(10, new LocalizedText("Cola", "كولا"), null, "Drinks", 20, null),
        new(11, new LocalizedText("Latte", "لاتيه"), null, "Coffee", 45, [new(40, "Milk", new LocalizedText("Oat Milk")), new(41, "Size", new LocalizedText("Large"))]),
        new(12, new LocalizedText("Tea", "شاي"), null, "Tea", 15, null),
    ];

    private static RecipeProposer Proposer(IChatClient? client)
    {
        var services = new ServiceCollection().BuildServiceProvider();
        var factory = new ChillaxAgentFactory(Options.Create(new AIOptions()), NullLoggerFactory.Instance, services, client);
        return new RecipeProposer(factory);
    }

    private static FakeChatClient Fake() => new([new FakeAgentScriptRegistration(RecipeProposer.AgentKey, RecipeProposerFake.Respond)]);

    [TestMethod]
    public async Task The_fake_sells_the_first_item_as_a_unit_and_makes_the_rest_recipes_with_a_new_syrup()
    {
        var proposal = await Proposer(Fake()).ProposeAsync(Items, Shelf, CancellationToken.None);

        Assert.IsEmpty(proposal.Warnings);
        var syrup = Assert.ContainsSingle(proposal.NewItems);
        Assert.AreEqual(RecipeProposerFake.SyrupKey, syrup.Key);
        Assert.AreEqual(RecipeProposerFake.SyrupNameEn, syrup.Name.En);
        Assert.AreEqual("ml", syrup.Unit);
        Assert.AreEqual(1000m, syrup.PackSize);

        Assert.HasCount(3, proposal.Recipes);
        Assert.AreEqual(RecipeKinds.Unit, proposal.Recipes[0].Kind);

        var latte = proposal.Recipes[1];
        Assert.AreEqual(RecipeKinds.Recipe, latte.Kind);
        Assert.HasCount(3, latte.Lines);
        Assert.AreEqual(1, latte.Lines[0].StockItemId);
        Assert.AreEqual(RecipeProposerFake.ShelfQuantity, latte.Lines[0].Quantity);
        Assert.AreEqual(RecipeProposerFake.SyrupKey, latte.Lines[1].NewItemKey);
        CollectionAssert.AreEqual(new[] { 40 }, latte.Lines[2].OptionIds.ToList());
        CollectionAssert.AreEqual(new[] { 1, 2, 2 }, latte.Lines.Select(l => l.Slot).ToList(), "the syrup override sits in the syrup's slot");
        var scale = Assert.ContainsSingle(latte.Scales);
        Assert.AreEqual(41, scale.OptionId);
        Assert.AreEqual(RecipeProposerFake.ScaleFactor, scale.Factor);

        var tea = proposal.Recipes[2];
        Assert.HasCount(2, tea.Lines, "no options, no option line");
        Assert.IsEmpty(tea.Scales);
    }

    [TestMethod]
    public async Task Too_many_shelf_items_are_cut_with_a_warning()
    {
        var many = Enumerable.Range(1, RecipeProposer.MaxShelf + 5)
            .Select(i => new StockItemView(i, new LocalizedText($"Item {i}"), "pcs", null, null, false, true))
            .ToList();

        var proposal = await Proposer(Fake()).ProposeAsync(Items, many, CancellationToken.None);

        Assert.IsTrue(proposal.Warnings.Any(w => w.Contains($"first {RecipeProposer.MaxShelf}")), string.Join("; ", proposal.Warnings));
    }

    [TestMethod]
    public void Off_without_a_chat_client()
    {
        Assert.IsFalse(Proposer(null).IsEnabled);
        Assert.IsTrue(Proposer(Fake()).IsEnabled);
    }
}
