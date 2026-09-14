using Chillax.AI.Agents;
using Chillax.AI.Fake;
using Microsoft.Extensions.AI;

namespace Chillax.AI.UnitTests;

[TestClass]
public class FakeChatClientTest
{
    private static FakeChatClient Client() => new(
    [
        new FakeAgentScriptRegistration("echo", r => $"{{\"echo\":\"{r.UserText}\",\"images\":{r.Images.Count}}}"),
        new FakeAgentScriptRegistration("other", _ => "{}"),
    ]);

    [TestMethod]
    public async Task Picks_the_script_by_the_agent_key_in_the_options()
    {
        var options = new ChatOptions { AdditionalProperties = new AdditionalPropertiesDictionary { [ChillaxAgent.AgentKeyProperty] = "echo" } };

        var response = await Client().GetResponseAsync([new ChatMessage(ChatRole.User, "hello")], options);

        Assert.AreEqual("""{"echo":"hello","images":0}""", response.Text);
        Assert.AreEqual("fake", response.ModelId);
        Assert.IsNotNull(response.Usage);
    }

    [TestMethod]
    public async Task Falls_back_to_the_agent_line_of_the_instructions()
    {
        var options = new ChatOptions { Instructions = "#agent: echo\nBe brief." };

        var response = await Client().GetResponseAsync([new ChatMessage(ChatRole.User, "hi")], options);

        Assert.AreEqual("""{"echo":"hi","images":0}""", response.Text);
    }

    [TestMethod]
    public async Task Hands_the_last_user_message_text_and_images_to_the_script()
    {
        var options = new ChatOptions { Instructions = "#agent: echo" };
        var messages = new List<ChatMessage>
        {
            new(ChatRole.User, "first"),
            new(ChatRole.Assistant, "ok"),
            new(ChatRole.User, [new TextContent("see"), new DataContent(new byte[] { 1, 2, 3 }, "image/png"), new TextContent("this")]),
        };

        var response = await Client().GetResponseAsync(messages, options);

        Assert.AreEqual("{\"echo\":\"see\nthis\",\"images\":1}", response.Text);
    }

    [TestMethod]
    public async Task Unknown_agent_is_a_loud_failure()
    {
        var options = new ChatOptions { Instructions = "#agent: nobody" };

        await Assert.ThrowsExactlyAsync<InvalidOperationException>(() => Client().GetResponseAsync([new ChatMessage(ChatRole.User, "x")], options));
    }
}
