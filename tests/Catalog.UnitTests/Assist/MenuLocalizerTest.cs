using Chillax.AI;
using Chillax.AI.Agents;
using Chillax.AI.Fake;
using Chillax.Catalog.API.Assist;
using Chillax.Catalog.API.Model;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Catalog.UnitTests.Assist;

/// <summary>The localizer end to end over the scripted client: prompt in, response out.</summary>
[TestClass]
public class MenuLocalizerTest
{
    private static readonly List<CatalogType> Categories =
    [
        new(new LocalizedText("Coffee", "قهوة")) { Id = 1, DisplayOrder = 1 },
        new(new LocalizedText("Juices", "عصائر")) { Id = 5, DisplayOrder = 2 },
    ];

    private static MenuLocalizer Localizer()
    {
        var services = new ServiceCollection().BuildServiceProvider();
        var client = new FakeChatClient([new FakeAgentScriptRegistration(MenuLocalizer.AgentKey, MenuLocalizerFake.Respond)]);
        var factory = new ChillaxAgentFactory(Options.Create(new AIOptions()), NullLoggerFactory.Instance, services, client);
        return new MenuLocalizer(factory);
    }

    [TestMethod]
    public async Task English_in_arabic_out_with_a_suggested_category()
    {
        var request = new LocalizeRequest(LocalizeKind.MenuItem, new LocalizedText("Mango Juice"), new LocalizedText("Fresh mango"), null, SuggestCategory: true);

        var response = await Localizer().LocalizeAsync(request, Categories, CancellationToken.None);

        Assert.AreEqual("Mango Juice", response.Name.En);
        Assert.AreEqual("Mango Juice (تجريبي)", response.Name.Ar);
        Assert.AreEqual("Fresh mango (تجريبي)", response.Description!.Ar);
        Assert.AreEqual(1, response.SuggestedCatalogTypeId, "the fake picks the first category");
        CollectionAssert.AreEqual(new[] { "name.ar", "description.ar", "catalogTypeId" }, response.Filled.ToList());
    }

    [TestMethod]
    public async Task Arabic_in_english_out()
    {
        var request = new LocalizeRequest(LocalizeKind.StockItem, new LocalizedText(string.Empty, "سكر"));

        var response = await Localizer().LocalizeAsync(request, Categories, CancellationToken.None);

        Assert.AreEqual("سكر (fake)", response.Name.En);
        Assert.AreEqual("سكر", response.Name.Ar);
        Assert.IsNull(response.Description);
        CollectionAssert.AreEqual(new[] { "name.en" }, response.Filled.ToList());
    }

    [TestMethod]
    public async Task A_name_alone_gets_the_other_language_a_description_and_a_category()
    {
        var request = new LocalizeRequest(LocalizeKind.MenuItem, new LocalizedText("Mango Juice"), null, null, SuggestCategory: true, SuggestDescription: true);

        var response = await Localizer().LocalizeAsync(request, Categories, CancellationToken.None);

        Assert.AreEqual("Mango Juice (تجريبي)", response.Name.Ar);
        Assert.AreEqual("Mango Juice description (fake)", response.Description!.En);
        Assert.AreEqual("وصف Mango Juice (تجريبي)", response.Description.Ar);
        Assert.AreEqual(1, response.SuggestedCatalogTypeId);
        CollectionAssert.AreEqual(new[] { "name.ar", "description.en", "description.ar", "catalogTypeId" }, response.Filled.ToList());
    }

    [TestMethod]
    public void Off_without_a_chat_client()
    {
        var services = new ServiceCollection().BuildServiceProvider();
        var factory = new ChillaxAgentFactory(Options.Create(new AIOptions()), NullLoggerFactory.Instance, services);

        Assert.IsFalse(new MenuLocalizer(factory).IsEnabled);
        Assert.IsTrue(Localizer().IsEnabled);
    }
}
