using Ninja.AI;
using Ninja.AI.Agents;
using Ninja.AI.Fake;
using Ninja.Catalog.API.Assist;
using Ninja.Catalog.API.Model;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Catalog.UnitTests.Assist;

/// <summary>The scanner end to end over the scripted client: photo in, proposal out.</summary>
[TestClass]
public class MenuScannerTest
{
    private static readonly byte[] TinyPng = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==");

    private static readonly List<CatalogType> Categories =
    [
        new(new LocalizedText("Coffee", "قهوة")) { Id = 1, DisplayOrder = 1 },
        new(new LocalizedText("Juices", "عصائر")) { Id = 5, DisplayOrder = 2 },
    ];

    private static readonly List<CatalogItem> Items =
    [
        new(new LocalizedText("Turkish Coffee", "قهوة تركي")) { Id = 10 },
    ];

    private static MenuScanner Scanner()
    {
        var services = new ServiceCollection().BuildServiceProvider();
        var client = new FakeChatClient([new FakeAgentScriptRegistration(MenuScanner.AgentKey, MenuScannerFake.Respond)]);
        var factory = new NinjaAgentFactory(Options.Create(new AIOptions()), NullLoggerFactory.Instance, services, client);
        return new MenuScanner(factory);
    }

    [TestMethod]
    public async Task A_photo_becomes_a_matched_section_and_a_new_one()
    {
        var proposal = await Scanner().ScanAsync(new DataContent(TinyPng, "image/png"), Categories, Items, CancellationToken.None);

        Assert.HasCount(2, proposal.Categories);
        Assert.IsEmpty(proposal.Warnings, string.Join("; ", proposal.Warnings));

        var coffee = proposal.Categories[0];
        Assert.AreEqual(1, coffee.CatalogTypeId, "the fake puts its first section under the first category");
        Assert.AreEqual(10, coffee.Items[0].ExistingItemId, "Turkish Coffee is already on the menu");
        Assert.IsNull(coffee.Items[1].ExistingItemId);
        Assert.AreEqual(MenuScannerFake.NewDrinkEn, coffee.Items[1].Name.En);
        Assert.AreEqual(20m, coffee.Items[1].Price);

        var specials = proposal.Categories[1];
        Assert.IsNull(specials.CatalogTypeId);
        Assert.AreEqual(MenuScannerFake.NewCategoryEn, specials.Name.En);
        var lemonade = Assert.ContainsSingle(specials.Items);
        Assert.AreEqual(MenuScannerFake.NewSpecialEn, lemonade.Name.En);
        Assert.AreEqual("ليمون بالنعناع تجريبي", lemonade.Name.Ar);
        Assert.AreEqual("Fresh lemon with mint, blended with ice", lemonade.Description.En);
        Assert.AreEqual(30m, lemonade.Price);
    }

    [TestMethod]
    public void Off_without_a_chat_client()
    {
        var services = new ServiceCollection().BuildServiceProvider();
        var factory = new NinjaAgentFactory(Options.Create(new AIOptions()), NullLoggerFactory.Instance, services);

        Assert.IsFalse(new MenuScanner(factory).IsEnabled);
        Assert.IsTrue(Scanner().IsEnabled);
    }
}
