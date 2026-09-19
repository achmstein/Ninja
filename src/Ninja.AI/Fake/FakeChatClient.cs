using System.Runtime.CompilerServices;
using Ninja.AI.Agents;
using Microsoft.Extensions.AI;

namespace Ninja.AI.Fake;

/// <summary>What a scripted stand-in gets to look at when it plays a model.</summary>
/// <param name="AgentKey">Which agent is asking (from ChatOptions or the "#agent:" line).</param>
/// <param name="Instructions">The agent's system prompt.</param>
/// <param name="UserText">The text parts of the last user message, joined.</param>
/// <param name="Images">Any images on the last user message.</param>
public sealed record FakeAgentRequest(string AgentKey, string Instructions, string UserText, IReadOnlyList<DataContent> Images);

/// <summary>Returns the JSON the model would have returned.</summary>
public delegate string FakeAgentScript(FakeAgentRequest request);

/// <summary>A script for one agent key; registered by the service that owns the agent.</summary>
public sealed record FakeAgentScriptRegistration(string AgentKey, FakeAgentScript Script);

/// <summary>
/// The chat client under test: no network, no key, a deterministic answer
/// per agent. Scripts live beside the agents they stand in for, so this
/// class knows nothing about any schema.
/// </summary>
public sealed class FakeChatClient(IEnumerable<FakeAgentScriptRegistration> scripts) : IChatClient
{
    private readonly Dictionary<string, FakeAgentScript> _scripts =
        scripts.ToDictionary(s => s.AgentKey, s => s.Script, StringComparer.Ordinal);

    private readonly ChatClientMetadata _metadata = new("fake", defaultModelId: "fake");

    public Task<ChatResponse> GetResponseAsync(IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken cancellationToken = default)
    {
        var request = Describe(messages, options);
        if (!_scripts.TryGetValue(request.AgentKey, out var script))
            throw new InvalidOperationException($"No fake script registered for agent '{request.AgentKey}'");

        var json = script(request);
        var response = new ChatResponse(new ChatMessage(ChatRole.Assistant, json))
        {
            ModelId = "fake",
            Usage = new UsageDetails
            {
                InputTokenCount = request.UserText.Length / 4,
                OutputTokenCount = json.Length / 4,
                TotalTokenCount = (request.UserText.Length + json.Length) / 4,
            },
        };
        return Task.FromResult(response);
    }

    public async IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(IEnumerable<ChatMessage> messages, ChatOptions? options = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var response = await GetResponseAsync(messages, options, cancellationToken);
        foreach (var update in response.ToChatResponseUpdates())
            yield return update;
    }

    public object? GetService(Type serviceType, object? serviceKey = null)
        => serviceKey is null && serviceType.IsInstanceOfType(_metadata) ? _metadata
         : serviceKey is null && serviceType.IsInstanceOfType(this) ? this
         : null;

    public void Dispose()
    {
    }

    private static FakeAgentRequest Describe(IEnumerable<ChatMessage> messages, ChatOptions? options)
    {
        var instructions = options?.Instructions ?? string.Empty;
        var key = options?.AdditionalProperties?.TryGetValue(NinjaAgent.AgentKeyProperty, out var value) == true
            ? value?.ToString() ?? string.Empty
            : KeyFromInstructions(instructions);

        var lastUser = messages.LastOrDefault(m => m.Role == ChatRole.User);
        var text = lastUser is null ? string.Empty : string.Join("\n", lastUser.Contents.OfType<TextContent>().Select(t => t.Text));
        var images = lastUser is null
            ? []
            : lastUser.Contents.OfType<DataContent>().Where(d => d.HasTopLevelMediaType("image")).ToList();

        return new FakeAgentRequest(key, instructions, text, images);
    }

    /// <summary>Every agent's instructions start with "#agent: {key}".</summary>
    private static string KeyFromInstructions(string instructions)
    {
        var firstLine = instructions.Split('\n', 2)[0].Trim();
        const string prefix = "#agent:";
        return firstLine.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) ? firstLine[prefix.Length..].Trim() : string.Empty;
    }
}
