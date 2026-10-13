using Ninja.AI;
using Ninja.AI.Agents;
using Ninja.AI.Fake;
using Ninja.Catalog.API.Assist;
using Ninja.Catalog.API.Model;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Catalog.UnitTests.Assist;

/// <summary>The pairing suggester end to end over the scripted client, and what its checks let through.</summary>
[TestClass]
public class PairingSuggesterTest
{
    private static PairingSuggester Suggester()
    {
        var services = new ServiceCollection().BuildServiceProvider();
        var client = new FakeChatClient([new FakeAgentScriptRegistration(PairingSuggester.AgentKey, PairingSuggesterFake.Respond)]);
        var factory = new NinjaAgentFactory(Options.Create(new AIOptions()), NullLoggerFactory.Instance, services, client);
        return new PairingSuggester(factory);
    }

    private static readonly CatalogType Coffee = new(new LocalizedText("Coffee", "قهوة")) { Id = 1 };
    private static readonly CatalogType Bakery = new(new LocalizedText("Bakery", "مخبوزات")) { Id = 2 };

    private static CatalogItem Item(int id, string name, CatalogType type, decimal price) =>
        new(new LocalizedText(name, null)) { Id = id, Price = price, CatalogTypeId = type.Id, CatalogType = type };

    private static readonly CatalogItem Latte = Item(1, "Latte", Coffee, 60);
    private static readonly CatalogItem Croissant = Item(2, "Croissant", Bakery, 45);
    private static readonly CatalogItem Waffle = Item(3, "Waffle", Bakery, 70);
    private static readonly CatalogItem Cookie = Item(4, "Cookie", Bakery, 30);
    private static readonly CatalogItem Muffin = Item(5, "Muffin", Bakery, 40);
    private static readonly CatalogItem Brownie = Item(6, "Brownie", Bakery, 50);
    private static readonly CatalogItem[] Menu = [Latte, Croissant, Waffle, Cookie, Muffin, Brownie];

    [TestMethod]
    public async Task Bought_together_comes_first_and_the_list_is_filled_to_its_room()
    {
        var request = new SuggestPairingsRequest(Latte.Id, Together: [new(Waffle.Id, 30), new(Cookie.Id, 12)], TicketsWithItem: 80);

        var response = await Suggester().SuggestAsync(request, Latte, Menu, [], CancellationToken.None);

        CollectionAssert.AreEqual(new[] { Waffle.Id, Cookie.Id, Croissant.Id, Muffin.Id }, response.Items.Select(i => i.CatalogItemId).ToArray());
        Assert.AreEqual("Goes well with it", response.Items[0].Reason.En);
    }

    [TestMethod]
    public async Task Leaves_out_what_the_list_has_and_proposes_only_for_the_room_left()
    {
        var request = new SuggestPairingsRequest(Latte.Id, Current: [Croissant.Id, Waffle.Id, Cookie.Id]);

        var response = await Suggester().SuggestAsync(request, Latte, Menu, [], CancellationToken.None);

        Assert.AreEqual(Muffin.Id, Assert.ContainsSingle(response.Items).CatalogItemId);
    }

    [TestMethod]
    public void Drops_the_item_itself_what_is_not_orderable_and_repeats()
    {
        var result = new PairingsResult(
            [
                new(Latte.Id, new("Itself", "")),
                new(999, new("Not on the menu", "")),
                new(Croissant.Id, new("A pastry", "")),
                new(Croissant.Id, new("Again", "")),
            ],
            "");

        var response = PairingsPostProcessor.Apply(result, new SuggestPairingsRequest(Latte.Id), new HashSet<int> { Croissant.Id, Waffle.Id });

        Assert.AreEqual(Croissant.Id, Assert.ContainsSingle(response.Items).CatalogItemId);
        Assert.IsTrue(response.Warnings.Any(w => w.Contains("Skipped 3")), string.Join("; ", response.Warnings));
    }

    [TestMethod]
    public void An_arabic_only_business_gets_arabic_reasons_only()
    {
        var result = new PairingsResult([new(Croissant.Id, new("A pastry", "حلو مع القهوة"))], "");

        var response = PairingsPostProcessor.Apply(result, new SuggestPairingsRequest(Latte.Id, Languages: "ar"), new HashSet<int> { Croissant.Id });

        var reason = Assert.ContainsSingle(response.Items).Reason;
        Assert.IsNull(reason.En);
        Assert.AreEqual("حلو مع القهوة", reason.Ar);
    }

    [TestMethod]
    public void A_full_list_is_refused_before_the_model_is_asked()
    {
        var request = new SuggestPairingsRequest(Latte.Id, Current: [2, 3, 4, 5]);

        Assert.IsNotNull(PairingsPostProcessor.Validate(request));
    }

    [TestMethod]
    public void Examples_are_other_items_lists_in_the_owners_order()
    {
        CatalogItemPairing Pair(CatalogItem item, CatalogItem paired, int order) =>
            new() { CatalogItemId = item.Id, CatalogItem = item, PairedItemId = paired.Id, PairedItem = paired, DisplayOrder = order };

        var examples = PairingSuggester.PickExamples([Pair(Latte, Croissant, 1), Pair(Waffle, Latte, 2), Pair(Waffle, Cookie, 1)], Latte.Id);

        var waffle = Assert.ContainsSingle(examples);
        CollectionAssert.AreEqual(new[] { "Cookie", "Latte" }, waffle.SuggestedWith.ToArray());
    }
}
