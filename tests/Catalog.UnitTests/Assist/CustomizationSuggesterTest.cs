using Ninja.AI;
using Ninja.AI.Agents;
using Ninja.AI.Fake;
using Ninja.Catalog.API.Assist;
using Ninja.Catalog.API.Model;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Catalog.UnitTests.Assist;

/// <summary>The suggester end to end over the scripted client: prompt in, proposals out.</summary>
[TestClass]
public class CustomizationSuggesterTest
{
    private static CustomizationSuggester Suggester()
    {
        var services = new ServiceCollection().BuildServiceProvider();
        var client = new FakeChatClient([new FakeAgentScriptRegistration(CustomizationSuggester.AgentKey, CustomizationSuggesterFake.Respond)]);
        var factory = new NinjaAgentFactory(Options.Create(new AIOptions()), NullLoggerFactory.Instance, services, client);
        return new CustomizationSuggester(factory);
    }

    private static readonly CatalogType Coffee = new(new LocalizedText("Coffee", "قهوة")) { Id = 1 };

    /// <summary>The item as the form has it — no id: it need not be saved yet.</summary>
    private static SuggestCustomizationsRequest Request(params LocalizedText[] existing) =>
        new(new LocalizedText("Hazelnut Coffee", "قهوة بندق"), CatalogTypeId: Coffee.Id, Price: 45m, ExistingGroups: existing);

    [TestMethod]
    public async Task Proposes_size_and_extras_for_a_bare_item()
    {
        var response = await Suggester().SuggestAsync(Request(), Coffee, [], CancellationToken.None);

        Assert.HasCount(2, response.Groups);
        Assert.AreEqual("Size", response.Groups[0].Name.En);
        Assert.AreEqual("Extras", response.Groups[1].Name.En);
        Assert.IsEmpty(response.Warnings);
    }

    [TestMethod]
    public async Task Leaves_out_what_the_item_already_has()
    {
        var size = new LocalizedText("Size", "الحجم");
        var response = await Suggester().SuggestAsync(Request(size), Coffee, [], CancellationToken.None);

        var extras = Assert.ContainsSingle(response.Groups);
        Assert.AreEqual("Extras", extras.Name.En);
        Assert.IsTrue(response.Warnings.Any(w => w.Contains("\"Size\"")), string.Join("; ", response.Warnings));
    }

    [TestMethod]
    public void Examples_are_one_per_distinct_shape_up_to_the_cap()
    {
        ItemCustomization Group(string name, params string[] options)
        {
            var group = new ItemCustomization(new LocalizedText(name));
            foreach (var (option, i) in options.Select((o, i) => (o, i)))
                group.Options.Add(new CustomizationOption(new LocalizedText(option)) { DisplayOrder = i });
            return group;
        }

        var candidates = new List<ItemCustomization>
        {
            Group("Size", "Single", "Double"),
            Group("Size", "Single", "Double"),
            Group("Size", "Small", "Medium", "Large"),
            Group("Sugar Level", "No Sugar", "Regular"),
        };
        candidates.AddRange(Enumerable.Range(0, 20).Select(i => Group($"Type {i}", "A", "B")));

        var picked = CustomizationSuggester.PickExamples(candidates);

        Assert.HasCount(CustomizationSuggester.MaxExamples, picked);
        Assert.AreEqual(2, picked.Count(g => g.Name.En == "Size"), "the same Size twice is one example; the three-size one another");
        Assert.AreEqual("Sugar Level", picked[2].Name.En);
    }

    [TestMethod]
    public void A_name_is_all_the_request_needs()
    {
        Assert.IsNull(CustomizationsPostProcessor.Validate(new SuggestCustomizationsRequest(new LocalizedText("Espresso"))));
        Assert.IsNull(CustomizationsPostProcessor.Validate(new SuggestCustomizationsRequest(new LocalizedText(string.Empty, "إسبريسو"))));
        Assert.IsNotNull(CustomizationsPostProcessor.Validate(new SuggestCustomizationsRequest(new LocalizedText(" "))));
        Assert.IsNotNull(CustomizationsPostProcessor.Validate(new SuggestCustomizationsRequest(new LocalizedText(new string('x', LocalizerPostProcessor.MaxNameLength + 1)))));
    }

    [TestMethod]
    public void Off_without_a_chat_client()
    {
        var services = new ServiceCollection().BuildServiceProvider();
        var factory = new NinjaAgentFactory(Options.Create(new AIOptions()), NullLoggerFactory.Instance, services);

        Assert.IsFalse(new CustomizationSuggester(factory).IsEnabled);
        Assert.IsTrue(Suggester().IsEnabled);
    }
}
