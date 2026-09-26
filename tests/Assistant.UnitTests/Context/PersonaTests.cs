using Ninja.Assistant.API.Context;
using Ninja.Assistant.API.Tools;

namespace Ninja.Assistant.UnitTests.Context;

/// <summary>The brief a chat app is handed: the platform's role and rules, with the owner's own settings folded in.</summary>
[TestClass]
public sealed class PersonaTests
{
    [TestMethod]
    public void Without_settings_it_is_a_brief_friendly_partner_that_answers_in_the_owners_language()
    {
        var brief = Persona.Write(null, null);

        StringAssert.Contains(brief, "operations partner of this café");
        StringAssert.Contains(brief, "Never guess or invent a number");
        StringAssert.Contains(brief, "confirm=true and the same requestId", "the write rule is always there");
        StringAssert.Contains(brief, "- Brief:");
        StringAssert.Contains(brief, "Friendly");
        StringAssert.Contains(brief, "in the language the owner writes in");
        Assert.DoesNotContain("owner's own notes", brief);
    }

    [TestMethod]
    public void The_owners_settings_name_it_set_its_manner_and_language_and_add_their_notes()
    {
        var brief = Persona.Write("Olive & Bean", new AssistantSettingsDto("Zein", "detailed", "formal", "ar-eg", "The terrace tables are T1 to T4."));

        StringAssert.StartsWith(brief, "You are Zein, the operations partner of Olive & Bean");
        StringAssert.Contains(brief, "- Detailed:");
        StringAssert.Contains(brief, "Formal and precise");
        StringAssert.Contains(brief, "Egyptian Arabic");
        StringAssert.Contains(brief, "you are Zein, Olive & Bean's assistant");
        StringAssert.EndsWith(brief, "The terrace tables are T1 to T4.");
        // The notes come after the rules, which they cannot unsay
        Assert.IsTrue(brief.IndexOf("The terrace tables", StringComparison.Ordinal) > brief.IndexOf("confirm=true", StringComparison.Ordinal));
    }

    [TestMethod]
    public void The_routines_name_only_tools_the_server_has()
    {
        var tools = typeof(OverviewTools).Assembly.GetTypes()
            .SelectMany(t => t.GetMethods())
            .Select(m => m.GetCustomAttributes(typeof(ModelContextProtocol.Server.McpServerToolAttribute), false).OfType<ModelContextProtocol.Server.McpServerToolAttribute>().FirstOrDefault()?.Name)
            .OfType<string>()
            .ToHashSet();
        foreach (var routine in new[] { Routines.MorningBriefing(), Routines.CloseTheDay(), Routines.WeeklyReview(), Routines.RestockCheck("2") })
        {
            var named = System.Text.RegularExpressions.Regex.Matches(routine, @"\b(get_[a-z_]+|record_expense|set_item_availability|pause_online_ordering)\b").Select(m => m.Value);
            foreach (var tool in named) Assert.IsTrue(tools.Contains(tool), $"{tool} is not a tool of this server");
        }
        StringAssert.Contains(Routines.RestockCheck("2"), "for branch 2");
    }
}
