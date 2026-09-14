using Chillax.AI;
using Chillax.AI.Agents;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Chillax.AI.UnitTests;

[TestClass]
public class ChillaxAgentTest
{
    private sealed record Answer(string Greeting, int Count);

    private static readonly AgentDefinition Definition = new(
        "greeter", "Greeter", "Says hello", "#agent: greeter\nAnswer in JSON.", Temperature: 0f, Timeout: TimeSpan.FromSeconds(5));

    private static ChillaxAgent Agent(IChatClient client, AIOptions? options = null)
    {
        var services = new ServiceCollection().BuildServiceProvider();
        var factory = new ChillaxAgentFactory(Options.Create(options ?? new AIOptions()), NullLoggerFactory.Instance, services, client);
        return factory.Create(Definition);
    }

    private static List<ChatMessage> Ask(string text) => [new ChatMessage(ChatRole.User, text)];

    [TestMethod]
    public async Task Parses_a_typed_answer_and_reports_usage()
    {
        var client = new ScriptedChatClient(["""{"greeting":"hi","count":2}"""]);

        var run = await Agent(client).RunAsync<Answer>(Ask("hello"), CancellationToken.None);

        Assert.AreEqual(new Answer("hi", 2), run.Result);
        Assert.IsFalse(run.Retried);
        Assert.AreEqual(10L, run.Usage!.InputTokenCount);
        Assert.HasCount(1, client.Calls);
    }

    [TestMethod]
    public async Task Sends_the_instructions_and_the_agent_key_with_every_call()
    {
        var client = new ScriptedChatClient(["""{"greeting":"hi","count":1}"""]);

        await Agent(client).RunAsync<Answer>(Ask("hello"), CancellationToken.None);

        var options = client.Options.Single()!;
        Assert.AreEqual(Definition.Instructions, options.Instructions);
        Assert.AreEqual("greeter", options.AdditionalProperties![ChillaxAgent.AgentKeyProperty]);
        Assert.IsNotNull(options.ResponseFormat, "the run asks for JSON");
    }

    [TestMethod]
    public async Task Strips_a_code_fence_before_parsing()
    {
        var client = new ScriptedChatClient(["```json\n{\"greeting\":\"hi\",\"count\":3}\n```"]);

        var run = await Agent(client).RunAsync<Answer>(Ask("hello"), CancellationToken.None);

        Assert.AreEqual(3, run.Result.Count);
        Assert.IsFalse(run.Retried);
    }

    [TestMethod]
    public async Task Asks_once_more_when_the_answer_is_not_json()
    {
        var client = new ScriptedChatClient(["Sure! Here you go:", """{"greeting":"hi","count":4}"""]);

        var run = await Agent(client).RunAsync<Answer>(Ask("hello"), CancellationToken.None);

        Assert.AreEqual(4, run.Result.Count);
        Assert.IsTrue(run.Retried);
        Assert.HasCount(2, client.Calls);
        // The repair round carries the bad answer and the correction
        var repair = client.Calls[1];
        Assert.AreEqual(ChatRole.Assistant, repair[^2].Role);
        Assert.AreEqual(ChatRole.User, repair[^1].Role);
        Assert.Contains("only the JSON object", repair[^1].Text);
    }

    [TestMethod]
    public async Task Gives_up_after_the_second_bad_answer()
    {
        var client = new ScriptedChatClient(["nope", "still nope"]);

        var ex = await Assert.ThrowsExactlyAsync<AIResponseException>(() => Agent(client).RunAsync<Answer>(Ask("hello"), CancellationToken.None));

        Assert.AreEqual("still nope", ex.Text);
        Assert.HasCount(2, client.Calls);
    }

    [TestMethod]
    public async Task Times_out_on_the_agent_budget()
    {
        var slow = new ScriptedChatClient(["""{"greeting":"late","count":0}"""], delay: TimeSpan.FromSeconds(30));
        var services = new ServiceCollection().BuildServiceProvider();
        var factory = new ChillaxAgentFactory(Options.Create(new AIOptions()), NullLoggerFactory.Instance, services, slow);
        var agent = factory.Create(Definition with { Timeout = TimeSpan.FromMilliseconds(200) });

        await Assert.ThrowsExactlyAsync<AITimeoutException>(() => agent.RunAsync<Answer>(Ask("hello"), CancellationToken.None));
    }

    [TestMethod]
    public async Task Json_object_mode_puts_the_schema_in_the_prompt()
    {
        var client = new ScriptedChatClient(["""{"greeting":"hi","count":5}"""]);
        var run = await Agent(client, new AIOptions { StructuredOutput = StructuredOutputMode.JsonObject }).RunAsync<Answer>(Ask("hello"), CancellationToken.None);

        Assert.AreEqual(5, run.Result.Count);
        var last = client.Calls.Single()[^1];
        Assert.Contains("JSON schema", last.Text);
        Assert.Contains("greeting", last.Text);
    }

    [TestMethod]
    public void Factory_is_off_without_a_chat_client()
    {
        var services = new ServiceCollection().BuildServiceProvider();
        var factory = new ChillaxAgentFactory(Options.Create(new AIOptions()), NullLoggerFactory.Instance, services);

        Assert.IsFalse(factory.IsEnabled);
        Assert.ThrowsExactly<AIUnavailableException>(() => factory.Create(Definition));
    }
}
