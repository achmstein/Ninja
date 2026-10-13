#nullable enable
using Ninja.AI;
using Ninja.AI.Agents;
using Ninja.AI.Fake;
using Ninja.Inventory.API.Application.Assist;
using Ninja.Inventory.Domain.SeedWork;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Inventory.UnitTests.Application;

/// <summary>The menu advisor over the scripted client, and what its checks let through.</summary>
[TestClass]
public class MenuAdvisorTest
{
    private static MenuAdvisor Advisor()
    {
        var services = new ServiceCollection().BuildServiceProvider();
        var client = new FakeChatClient([new FakeAgentScriptRegistration(MenuAdvisor.AgentKey, MenuAdvisorFake.Respond)]);
        var factory = new NinjaAgentFactory(Options.Create(new AIOptions()), NullLoggerFactory.Instance, services, client);
        return new MenuAdvisor(factory);
    }

    private static MenuAdviceItem Item(int id, string name, string menuClass) =>
        new(id, new LocalizedText(name, null), null, 60, 20, 30, menuClass);

    private static readonly MenuAdviceRequest Request = new(
        [Item(1, "Latte", "star"), Item(2, "Tea", "plowhorse"), Item(3, "Waffle", "puzzle"), Item(4, "Soup", "dog")],
        Days: 30,
        AverageMargin: 28);

    [TestMethod]
    public async Task One_move_per_item_worth_changing_and_the_stars_left_alone()
    {
        var advice = await Advisor().AdviseAsync(Request, CancellationToken.None);

        CollectionAssert.AreEqual(
            new[] { (2, "raise-price"), (3, "promote"), (4, "remove") },
            advice.Items.Select(d => (d.CatalogItemId, d.Action)).ToArray());
        Assert.AreEqual("Your stars carry the menu.", advice.Summary.En);
    }

    [TestMethod]
    public void Drops_advice_for_unknown_items_repeats_and_unknown_moves()
    {
        var result = new MenuAdviceResult(
            new LocalizedPair("Summary", ""),
            [
                new(2, "Raise-Price", new LocalizedPair("Raise it", "")),
                new(2, "promote", new LocalizedPair("Again", "")),
                new(99, "remove", new LocalizedPair("Not on the menu", "")),
                new(3, "discount-forever", new LocalizedPair("Unknown move", "")),
            ],
            "");

        var advice = MenuAdvisor.Apply(result, Request, "both");

        var only = Assert.ContainsSingle(advice.Items);
        Assert.AreEqual((2, "raise-price"), (only.CatalogItemId, only.Action));
        Assert.IsTrue(advice.Warnings.Any(w => w.Contains("Skipped 3")), string.Join("; ", advice.Warnings));
    }

    [TestMethod]
    public void An_arabic_only_business_gets_arabic_advice_only()
    {
        var result = new MenuAdviceResult(
            new LocalizedPair("Summary", "الملخص"),
            [new(2, "raise-price", new LocalizedPair("Raise it", "زوّد سعره"))],
            "");

        var advice = MenuAdvisor.Apply(result, Request, "ar");

        Assert.IsNull(advice.Summary.En);
        Assert.AreEqual("زوّد سعره", advice.Items[0].Advice.Ar);
        Assert.IsNull(advice.Items[0].Advice.En);
    }

    [TestMethod]
    public void Refuses_an_empty_matrix_and_an_unknown_class()
    {
        Assert.IsNotNull(MenuAdvisor.Validate(Request with { Items = [] }));
        Assert.IsNotNull(MenuAdvisor.Validate(Request with { Items = [Item(1, "Latte", "unicorn")] }));
        Assert.IsNull(MenuAdvisor.Validate(Request));
    }
}
